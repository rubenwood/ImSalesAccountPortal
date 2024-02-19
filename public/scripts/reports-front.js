import {getPlayerCountInSegment} from './segments.js';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
    document.getElementById('get-google-report-btn').addEventListener('click', fetchDevKPIReport);
    document.getElementById('get-apple-report-btn').addEventListener('click', fetchSubReport);
});
window.onload = function() {
    //document.getElementById('loginModal').style.display = 'block';
};

export function GoogleLoginClicked(){
    //redirect to google login endpoint
    window.location.href = '/google/google-login';
}

function fetchDevKPIReport() {
    fetch('/google/get-kpi-report')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(respJson => {
        //const html = csvToHtmlTable(csvText);
        setupReportTable(respJson);
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    });
}

function setupReportTable(jsonInput){
    let table = document.getElementById('reportTable');
    
    if (jsonInput.userRetention) { // done (User Retention)
        let dataCell = table.querySelector("#userRetention");
        let day1Ret = jsonInput.userRetention[1].metricValues[0].value;
        let day2Ret = jsonInput.userRetention[2].metricValues[0].value;
        let day30Ret = jsonInput.userRetention[30].metricValues[0].value;
        let day1Perc = (day1Ret * 100).toFixed(2);
        let day2Perc = (day2Ret * 100).toFixed(2);
        let day30Perc = (day30Ret * 100).toFixed(2);
        if (dataCell) dataCell.innerText = `Day 1: ${day1Perc}%\nDay 2: ${day2Perc}%\nDay 30: ${day30Perc}%`;
    }

    if (jsonInput.userRetention30Day) { // done (30 Day Retention)
        let dataCell = table.querySelector("#userRetention30Days");
        if (dataCell) dataCell.innerText = jsonInput.userRetention30Day;
    }

    if (jsonInput.newUsersPerWeek) { // done (New Users Per Week)
        let dataCell = table.querySelector("#newUsersPerWeek");
        if (dataCell) dataCell.innerText = jsonInput.newUsersPerWeek;
    }

    if (jsonInput.returningUsersPerWeek) { // done (Returning Users Per Week DAU)
        let returningValue = calcReturning(jsonInput.returningUsersPerWeek);
        let dataCell = table.querySelector("#returningUsersPerWeek");
        if (dataCell) dataCell.innerText = returningValue;
    }

    if (jsonInput.activeUsersPerMonth) { // done (MAU)
        let dataCell = table.querySelector("#MAU");
        // last months MAU
        let thisMonthMAU = jsonInput.activeUsersPerMonth[jsonInput.activeUsersPerMonth.length-1];
        let lastMonthMAU = jsonInput.activeUsersPerMonth[jsonInput.activeUsersPerMonth.length-2];
        if (dataCell) dataCell.innerText = JSON.stringify(lastMonthMAU);
    }

    if (jsonInput.averageActiveUsageTime) { // done (Active User Useage Time)
        let dataCell = table.querySelector("#averageActiveUsageTime");
        let averageUsageTime = calcAverageUsageTime(jsonInput.averageActiveUsageTime);
        if (dataCell) dataCell.innerText = averageUsageTime.toFixed(2);
    }

    if (jsonInput.sessionsPerUserPerWeek) { // done (Total Sessions Per Active User)
        let dataCell = table.querySelector("#sessionsPerUserPerWeek");
        let sessionsPerUserPerWeek = parseFloat(jsonInput.sessionsPerUserPerWeek);
        if (dataCell) dataCell.innerText = sessionsPerUserPerWeek.toFixed(2);
    }

    if (jsonInput.activitiesLaunchedPerWeek) { // done (Total Experiences Played)
        let dataCell = table.querySelector("#activitiesLaunchedPerWeek");
        if (dataCell) dataCell.innerText = jsonInput.activitiesLaunchedPerWeek;
    }

    //document.getElementById('output-area').innerHTML = JSON.stringify(jsonInput.averageActiveUsageTime);
}

function calcReturning(rowData) {
    let totalReturningUsers = 0;  
    // Iterate over each row in the input JSON object
    rowData.forEach(row => {
      // Check if the dimension value indicates a returning user
      const isReturning = row.dimensionValues.some(dimension => dimension.value === 'returning');      
      // If the user is returning, add their count to the total
      if (isReturning) { totalReturningUsers += parseInt(row.metricValues[0].value, 10); }
    });
  
    //console.log("Total Returning Users:", totalReturningUsers);
    return totalReturningUsers;
}

function calcAverageUsageTime(rowData) {
    let totalAverage = 0;
    let daysCount = rowData.length;
  
    rowData.forEach(item => {
      const users = parseInt(item.metricValues[0].value, 10); // Number of users
      const totalUsageTime = parseInt(item.metricValues[1].value, 10); // Total usage time for all users
  
      const dailyAverage = totalUsageTime / users; // Average usage time per day
      totalAverage += dailyAverage; // Summing up the daily averages
    });
    //console.log(totalAverage);
    // Overall average usage time across all days
    let overallAverage = (totalAverage / (daysCount-1)) / 60;
    overallAverage = overallAverage;
    return overallAverage;
}


// SUB REPORT
async function fetchSubReport() {
    let allPlayersSeg = await getPlayerCountInSegment("1E7B6EA6970A941D");
    console.log(allPlayersSeg.ProfilesInSegment);

    let allPlayserHTMLString = "Total users: " + allPlayersSeg.ProfilesInSegment;

    try {
        // Execute both requests concurrently and wait for both of them to complete
        const [googleReport, googlePurchasers, appleReport] = await Promise.all([
            fetchGoogleReport(),
            fetchGooglePurchasers(),
            fetchAppleReport()
        ]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        // Format google report
        let googleRepArray = googleReport.split('\n');
        // Decode HTML entities for each line in the array
        let decodedGoogleRepArray = googleRepArray.map(line => {
            let tempDiv = document.createElement('div');
            tempDiv.innerHTML = line;
            return tempDiv.textContent || tempDiv.innerText || "";
        });
        //console.log(decodedGoogleRepArray);

        // Filter for nonFreeTrials and freeTrials with dates within the last 14 days
        let nonFreeTrials = decodedGoogleRepArray.filter(line => {
            const lineDate = line.split(',')[0];
            return !line.toLowerCase().includes("freetrial") && lineDate >= sevenDaysAgoStr;
        });
        let freeTrials = decodedGoogleRepArray.filter(line => {
            const lineDate = line.split(',')[0];
            return line.toLowerCase().includes("freetrial") && lineDate >= sevenDaysAgoStr;
        });
        // console.log(nonFreeTrials);
        // console.log(freeTrials);
        // console.log(nonFreeTrials.length);
        // console.log(freeTrials.length);

        console.log(googlePurchasers);
        let googleHTMLString = "Total google subs: " + googlePurchasers[0].metricValues[0].value;

        // format apple report
        let formattedAppleReport = formatDecompressedData(appleReport);
        let appleFullArr = [];
        formattedAppleReport.forEach(element =>{
            let rowSplit = element.split(',');
            appleFullArr.push(rowSplit);
        })
        console.log(formattedAppleReport);
        console.log(appleFullArr);
        let appleFreeTrials = [];
        appleFullArr.forEach(row => {
            // Convert the values at index 19 and 22 to integers and check if either is greater than 0
            // Note: Using parseInt to ensure the comparison is done with numeric values
            if (parseInt(row[19], 10) > 0 || parseInt(row[22], 10) > 0) {
                appleFreeTrials.push(row); // Add the row to appleFreeTrials if the condition is met
            }
        });
        console.log(appleFreeTrials.length);

        let appleHTMLString = 'Total apple subs: ' + (formattedAppleReport.length-1) + '<br/>';
        // formattedAppleReport.forEach(element => {
        //      appleHTMLString += "<br/>" + element + "<br/>";
        // });
        
        const combinedHTML = allPlayserHTMLString +"<br/><br/>"+ googleHTMLString +"<br/><br/>"+ appleHTMLString;
        document.getElementById('output-area').innerHTML = combinedHTML;
    } catch (error) {
        console.error('There has been a problem with the combined fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    }
}

async function fetchAppleReport() {
    const response = await fetch('/apple/get-subscription-report');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const outputText = await response.text();
    return outputText;
}
async function fetchGoogleReport() {
    const response = await fetch('/google/get-google-report');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const outputText = await response.text();
    return outputText;
}
async function fetchGooglePurchasers() {
    const response = await fetch('/google/get-google-purchasers');
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const outputText = await response.json();
    return outputText;
}

function csvToHtmlTable(csvText) {
    const rows = csvText.split('\n');
    let html = '<table>';

    for (let row of rows) {
        html += '<tr>';
        const cells = row.split(',');

        for (let cell of cells) {
            html += `<td>${cell}</td>`;
        }
        html += '</tr>';
    }

    html += '</table>';
    return html;
}

function formatDecompressedData(decompressed) {
    let output = decompressed.split('\n');
    let formattedOutput = output.map(line => line.replace(/\t/g, ','));
    return formattedOutput;
}
