import {getPlayerCountInSegment} from './segments.js';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
    document.getElementById('get-google-report-btn').addEventListener('click', fetchDevKPIReport);
    document.getElementById('get-apple-report-btn').addEventListener('click', fetchSubReport);
    document.getElementById('get-b2b-report-btn').addEventListener('click', fetchB2BReport);
});

export function GoogleLoginClicked(){
    window.location.href = '/google/google-login';
}

function updateButtonText(button, text, maxTicks) {
    let tickCount = 0; 
    return function() {
        let dots = ".".repeat(tickCount % (maxTicks + 1));
        button.value = `${text}${dots}`;
        tickCount++;
    };
}

// KPI REPORT
let fetchingKPIReport = false;
async function fetchDevKPIReport() {
    if(fetchingKPIReport){ console.log("in progress"); return; }

    fetchingKPIReport = true;
    // loading animation on button
    const button = document.getElementById('get-google-report-btn');
    const tickUpdater = updateButtonText(button, "Getting Dev KPIs", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    fetch('/google/get-kpi-report')
    .then(response => {
        if (!response.ok) {
            console.log(response);
            if(response.status == 401){ throw new Error('Not logged in'); }
            throw new Error(`Response was not ok: ${response.statusText}`);
        }
        return response.json();
    })
    .then(respJson => {
        setupReportTable(respJson);
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    })
    .finally(() => {
        clearInterval(tickInterval); // Stop the ticking animation
        button.value = "Get Dev KPI report";
        fetchingKPIReport = false;
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
        let day1DropOff = (day2Perc/day1Perc * 100).toFixed(2);

        if (dataCell) dataCell.innerText = `Day 1: ${day1Perc}%\nDay 2: ${day2Perc}%\nDay1-2 drop off: ${day1DropOff}%\nDay 30: ${day30Perc}%`;
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
        if (dataCell){ dataCell.innerText = JSON.stringify(lastMonthMAU) + "\n" + JSON.stringify(thisMonthMAU); }
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
let fetchingSubReport = false;
async function fetchSubReport() {
    if(fetchingSubReport){ console.log("in progress"); return; }

    fetchingSubReport = true;

    const button = document.getElementById('get-apple-report-btn');
    const tickUpdater = updateButtonText(button, "Getting Sub report", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    let allPlayersSeg = await getPlayerCountInSegment("1E7B6EA6970A941D");
    console.log(allPlayersSeg.ProfilesInSegment);

    try {        
        // Execute both requests concurrently and wait for both of them to complete
        const [googleReport, googlePurchasers, appleReport, stripeActiveSubs] = await Promise.all([
            fetchGoogleReport(),
            fetchGooglePurchasers(),
            fetchAppleReport(),
            fetchStripeReport()
        ]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        // GOOGLE
        let googleReportJSON = JSON.parse(googleReport);
        let googleMonthlyJSON = googleReportJSON.monthlyReport;
        let googleYearlyJSON = googleReportJSON.yearlyReport;
        let androidSubs = [];
        let androidTrials = [];
        googleMonthlyJSON.forEach((element) =>{
            if(element.offerID == ""){
                androidSubs.push(element);
            }
        });
        googleYearlyJSON.forEach((element) =>{
            if(element.offerID == ""){
                androidSubs.push(element);
            }
        });
        console.log(androidSubs);

        // APPLE
        let formattedAppleReport = formatDecompressedData(appleReport);
        let appleFullArr = [];
        formattedAppleReport.forEach(element =>{
            let rowSplit = element.split(',');
            appleFullArr.push(rowSplit);
        });
        let appleFreeTrials = [];
        let appleIntroductory = [];
        console.log(appleFullArr);
        appleFullArr.forEach(row => {
            // Convert the values at index 19 and 22 to integers and check if either is greater than 0
            if (parseInt(row[19], 10) > 0 || parseInt(row[22], 10) > 0) {
                appleFreeTrials.push(row);
            }
            if (parseInt(row[20], 10) != 0 ||  parseInt(row[23], 10) != 0) {
                appleIntroductory.push(row);
            }
        });

        // STRIPE
        let stripeJSON = JSON.parse(stripeActiveSubs);

        // OUTPUT
        //let totalSubs = parseInt(googlePurchasers[0].metricValues[0].value)+parseInt(formattedAppleReport.length-2)+parseInt(stripeJSON.length);
        let totalSubs = parseInt(androidSubs.length)+parseInt(formattedAppleReport.length-2)+parseInt(stripeJSON.length);

        let table = document.getElementById('reportTable');
        let totalUsersPlayfabCell = table.querySelector("#totalUsersPlayfab");
        if (totalUsersPlayfabCell) totalUsersPlayfabCell.innerText = allPlayersSeg.ProfilesInSegment;

        let googleSubsCell = table.querySelector("#googleSubs");
        //if (googleSubsCell) googleSubsCell.innerText = googlePurchasers[0].metricValues[0].value;
        if (googleSubsCell) googleSubsCell.innerText = androidSubs.length;

        let appleSubsCell = table.querySelector("#appleSubs");
        if (appleSubsCell) appleSubsCell.innerText = appleFullArr.length-2;

        let appleTrialsCell = table.querySelector("#appleTrials");
        if (appleTrialsCell) appleTrialsCell.innerText = appleFreeTrials.length;

        let stripeSubsCell = table.querySelector("#stripeSubs");
        if (stripeSubsCell) stripeSubsCell.innerText = stripeJSON.length;        

        let totalSubsCell = table.querySelector("#totalSubs");
        if (totalSubsCell) totalSubsCell.innerText = totalSubs;

        // sub conversion rate of total users
        // sub conversion rate of active users
    } catch (error) {        
        let errorMessage = error.message;
        if(error.response && error.response.data && error.response.data.error){
            errorMessage = error.response.data.error;
        }
        console.error('There has been a problem with the combined fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + errorMessage;
    } finally {
        clearInterval(tickInterval); // Stop the ticking animation
        button.value = "Get Sub report";
        fetchingSubReport = false;
    }
}
// B2B REPORT
let fetchingB2BReport = false;
async function fetchB2BReport(){
    if(fetchingB2BReport){ console.log("in progress"); return; }

    fetchingB2BReport = true;

    const button = document.getElementById('get-b2b-report-btn');
    const tickUpdater = updateButtonText(button, "Getting B2B report", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    try{
        const [ b2bUsers ] = await Promise.all([
            fetchB2BUsersReport()
        ]);
        
        let table = document.getElementById('reportTable');

        let totalB2BUsersCell = table.querySelector("#totalB2BUsers");
        if(totalB2BUsersCell) totalB2BUsersCell.innerText = b2bUsers;
    }catch(error){
        let errorMessage = error.message;
        if(error.response && error.response.data && error.response.data.error){
            errorMessage = error.response.data.error;
        }
        console.error('There has been a problem with the combined fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + errorMessage;
    }finally{
        clearInterval(tickInterval); // Stop the ticking animation
        button.value = "Get B2B report";
        fetchingB2BReport = false;
    }    
}

async function fetchAppleReport() {
    const response = await fetch('/apple/get-subscription-report');
    if (!response.ok) { responseNotOk(response); }

    const outputText = await response.text();
    return outputText;
}
async function fetchGoogleReport() {
    const response = await fetch('/google/get-google-report');
    if (!response.ok) { responseNotOk(response); }

    const outputText = await response.text();
    return outputText;
}
async function fetchGooglePurchasers() {
    const response = await fetch('/google/get-google-purchasers');
    if (!response.ok) { responseNotOk(response); }

    const outputText = await response.json();
    return outputText;
}
async function fetchStripeReport() {
    const getAllCustResponse = await fetch('/stripe/get-stripe-customers');
    if (!getAllCustResponse.ok) { responseNotOk(getAllCustResponse); }
    
    const response = await fetch('/stripe/get-stripe-active-subs');
    if (!response.ok) { responseNotOk(response); }

    const outputText = await response.text();
    return outputText;
}
async function fetchB2BUsersReport() {
    const response = await fetch('/b2b/get-total-users');
    if (!response.ok) { responseNotOk(response); }

    const outputText = await response.text();
    return outputText;
}
function responseNotOk(response) {
    console.log(response);
    if(response.status == 401){ throw new Error('Not logged in'); }
    throw new Error(`Response was not ok: ${response.statusText}`);
}

function formatDecompressedData(decompressed) {
    let output = decompressed.split('\n');
    let formattedOutput = output.map(line => line.replace(/\t/g, ','));
    return formattedOutput;
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