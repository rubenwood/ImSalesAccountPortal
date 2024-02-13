document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
    document.getElementById('get-google-report-btn').addEventListener('click', fetchGoogleReport);
    document.getElementById('get-apple-report-btn').addEventListener('click', fetchAppleReport);
});
window.onload = function() {
    //document.getElementById('loginModal').style.display = 'block';
};

export function GoogleLoginClicked(){
    //redirect to google login endpoint
    window.location.href = '/google/google-login';
}

function fetchGoogleReport() {
    /*fetch('/google/get-google-report')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(csvText => {
        // Convert the CSV text to an HTML table
        const html = csvToHtmlTable(csvText);
        document.getElementById('output-area').innerHTML = html;
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    });*/

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
        let day1Perc = (day1Ret * 100).toFixed(2);
        let day2Perc = (day2Ret * 100).toFixed(2);
        if (dataCell) dataCell.innerText = 'Day 1: ' + day1Perc + '%\nDay 2: ' + day2Perc + '%';
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
        console.log(sessionsPerUserPerWeek);
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
  
    console.log("Total Returning Users:", totalReturningUsers);
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
    console.log(totalAverage);
    // Overall average usage time across all days
    let overallAverage = (totalAverage / (daysCount-1)) / 60;
    overallAverage = overallAverage;
    return overallAverage;
}


function fetchAppleReport() {
    fetch('/apple/get-subscription-report')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        // Assuming the output is a string or text
        return response.text();
    })
    .then(text => {
        // Display the response in some part of your webpage
        document.getElementById('output-area').textContent = text;
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    });
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
