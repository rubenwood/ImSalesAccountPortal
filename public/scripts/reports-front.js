import {getPlayerCountInSegment} from './segments.js';
import {updateButtonText} from './utils.js';
import {getPlayFabDailyTotalsReport, getPlayFab30DayReport, getPlayFabMonthlyTotalsReport} from './playfab_reporting/playfab-reports.js';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
    document.getElementById('get-google-report-btn').addEventListener('click', fetchDevKPIReport);
    document.getElementById('get-apple-report-btn').addEventListener('click', fetchSubReport);
    document.getElementById('get-b2b-report-btn').addEventListener('click', fetchB2BReport);
});

export function GoogleLoginClicked(){
    window.location.href = '/google/google-login';
}

// KPI REPORT
let fetchingKPIReport = false;
async function fetchDevKPIReport() {
    if (fetchingKPIReport) { console.log("in progress"); return; }

    fetchingKPIReport = true;
    const button = document.getElementById('get-google-report-btn');
    const tickUpdater = updateButtonText(button, "Getting Dev KPIs", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    try {
        let table = document.getElementById('reportTable');

        let allPlayersSeg = await getPlayerCountInSegment("1E7B6EA6970A941D");
        let totalUsersPlayfabCell = table.querySelector("#totalUsersPlayfab");
        if (totalUsersPlayfabCell) totalUsersPlayfabCell.innerText = allPlayersSeg.ProfilesInSegment;

        // Get Daily totals for the past 7 days
        const daysToGoBack = 7;
        const playFabDailyTotalsPromises = Array.from({ length: daysToGoBack }, (_, monthIndex) => {
            const today = new Date();
            const yesterday = new Date(today.setDate(today.getDate() - 1));
            const day = yesterday.getDate() - monthIndex;
            const month = yesterday.getMonth() + 1;
            const year = yesterday.getFullYear();
        
            return getPlayFabDailyTotalsReport(day, month, year);
        });
        // Get 30 day retention report
        const playFab30DayReportPromise = getPlayFab30DayReport();

        // Get Monthly totals for the past 12 Months
        const monthsToGoBack = 12;
        const playFabMonthlyTotalsPromises = Array.from({ length: monthsToGoBack }, (_, monthIndex) => {
            const targetDate = new Date();
            targetDate.setDate(1); // Set the date to the first to avoid issues with months having different numbers of days
            targetDate.setMonth(targetDate.getMonth() - monthIndex - 1);
            const month = targetDate.getMonth() + 1; // months are zero-indexed
            const year = targetDate.getFullYear();

            console.log(`month index: ${monthIndex}`);
            console.log(`target date: ${month} ${year} -- ${targetDate}`);
            
            return getPlayFabMonthlyTotalsReport(month, year);
        });

        const googleKPIPromise = fetch('/google/get-kpi-report').then(async response => {
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Not logged in');
                }
                throw new Error(`Google KPI Response was not ok: ${response.statusText}`);
            }
            return response.json();
        });

        const [playFabDailyTotalsReport, playFab30DayReport, monthlyTotalsReports, googleKPIReport] = await Promise.all([
            Promise.all(playFabDailyTotalsPromises),
            playFab30DayReportPromise,
            Promise.all(playFabMonthlyTotalsPromises),
            googleKPIPromise
        ]);

        // Update retention data
        let retentionDataCell = table.querySelector("#userRetentionPlayfab");
        let day1Perc = parseInt(playFab30DayReport[1]?.Percent_Retained);
        let day2Perc = parseInt(playFab30DayReport[2]?.Percent_Retained);
        let day30Perc = parseInt(playFab30DayReport[30]?.Percent_Retained);
        let day1DropOff = (day2Perc/day1Perc * 100).toFixed(2); //TODO: check this
        if (retentionDataCell) {
            retentionDataCell.innerText = `Day 1: ${playFab30DayReport[1]?.Percent_Retained ?? 'N/A'}%
            Day 2: ${playFab30DayReport[2]?.Percent_Retained ?? 'N/A'}%
            Day 30: ${playFab30DayReport[30]?.Percent_Retained ?? 'N/A'}%`;
        }

        // Process Monthly Total Report
        let MAUs = monthlyTotalsReports.map((report, index) => {
            return `<b>${report[0].Ts.replace("T00:00:00.0000000", "")}</b>: ${report[0].Unique_Logins}`;
        });
        let newUsers = monthlyTotalsReports.map((report, index) => {
            return `<b>${report[0].Ts.replace("T00:00:00.0000000", "")}</b>: ${report[0].New_Users}`;
        });
        // Process Daily Totals Report
        let totalDAUPer7Days = 0
        let DAUPast7Days = playFabDailyTotalsReport.map((report, index) =>{
            totalDAUPer7Days += parseInt(report[0].Unique_Logins, 10);
            return `<b>${report[0].Ts.replace("T00:00:00.0000000", "")}</b>: ${report[0].Unique_Logins}`;
        });

        // Update MAU cell
        let mauDataCell = table.querySelector("#MAUPlayfab");
        if (mauDataCell) { mauDataCell.innerHTML = MAUs.join('<br>'); }
        // Update New Users cell
        let newUsersDataCell = table.querySelector("#NewUsersPerMonthPlayfab");
        if (newUsersDataCell) { newUsersDataCell.innerHTML = newUsers.join('<br>'); }
        // Update DAU cell
        let DAUDataCell = table.querySelector("#DAUPlayfab");
        if (DAUDataCell) { 
            DAUDataCell.innerHTML = DAUPast7Days.join('<br>'); 
            DAUDataCell.innerHTML += `<br><b>Total</b>: ${totalDAUPer7Days}
            <br><b>Average</b>:${parseInt(totalDAUPer7Days/7, 10)}`; 
        }

        // Setup the Google KPI report table
        setupReportTable(googleKPIReport);

    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    } finally {
        clearInterval(tickInterval);
        button.value = "Get Dev KPI report";
        fetchingKPIReport = false;
        doConfetti();
    }
}

function setupReportTable(jsonInput){
    let table = document.getElementById('reportTable');
    
    if (jsonInput.userRetention) {
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

    if (jsonInput.userRetention30Day) { // (30 Day Retention)
        let dataCell = table.querySelector("#userRetention30Days");
        if (dataCell) dataCell.innerText = jsonInput.userRetention30Day;
    }

    if (jsonInput.newUsersPerWeek) { // (New Users Per Week)
        let dataCell = table.querySelector("#newUsersPerWeek");
        if (dataCell) dataCell.innerText = jsonInput.newUsersPerWeek;
    }

    if (jsonInput.returningUsersPerWeek) { // (Returning Users Per Week DAU)
        let returningValue = calcReturning(jsonInput.returningUsersPerWeek);
        let dataCell = table.querySelector("#returningUsersPerWeek");
        if (dataCell) dataCell.innerText = returningValue;
    }

    if (jsonInput.activeUsersPerMonth) { // (MAU)
        let dataCell = table.querySelector("#MAU");
        // last months MAU
        let thisMonthMAU = jsonInput.activeUsersPerMonth[jsonInput.activeUsersPerMonth.length-1];
        let lastMonthMAU = jsonInput.activeUsersPerMonth[jsonInput.activeUsersPerMonth.length-2];
        if (dataCell){ dataCell.innerText = JSON.stringify(lastMonthMAU) + "\n" + JSON.stringify(thisMonthMAU); }
    }

    if (jsonInput.averageActiveUsageTime) { // (Active User Useage Time)
        let dataCell = table.querySelector("#averageActiveUsageTime");
        let averageUsageTime = calcAverageUsageTime(jsonInput.averageActiveUsageTime);
        if (dataCell) dataCell.innerText = averageUsageTime.toFixed(2);
    }

    if (jsonInput.sessionsPerUserPerWeek) { // (Total Sessions Per Active User)
        let dataCell = table.querySelector("#sessionsPerUserPerWeek");
        let sessionsPerUserPerWeek = parseFloat(jsonInput.sessionsPerUserPerWeek);
        if (dataCell) dataCell.innerText = sessionsPerUserPerWeek.toFixed(2);
    }

    if (jsonInput.activitiesLaunchedPerWeek) { // (Total Experiences Played)
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

    try {
        // Execute all requests concurrently and wait for all of them to complete
        const [googleReport, googlePurchasers, appleReport, stripeSubs] = await Promise.all([
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

        // APPLE
        let formattedAppleReport = formatDecompressedData(appleReport);
        let appleFullArr = [];
        formattedAppleReport.forEach(element =>{
            let rowSplit = element.split(',');
            appleFullArr.push(rowSplit);
        });
        let appleFreeTrials = [];
        let appleIntroductory = [];
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
        let stripeJSON = JSON.parse(stripeSubs);
        let stripeActiveSubs = stripeJSON.totalActiveSubs;
        let stripeActiveTrials = stripeJSON.totalActiveTrials;
        let stripePastDueUnpaid = stripeJSON.totalPastDueUnpaid;
        let stripeNonSubs = stripeJSON.totalNonSubs;
        console.log(stripeJSON);

        // OUTPUT
        //let totalSubs = parseInt(googlePurchasers[0].metricValues[0].value)+parseInt(formattedAppleReport.length-2)+parseInt(stripeJSON.length);
        let totalSubs = parseInt(androidSubs.length)+parseInt(formattedAppleReport.length-2)+parseInt(stripeActiveSubs);

        let table = document.getElementById('reportTable');

        let googleSubsCell = table.querySelector("#googleSubs");
        //if (googleSubsCell) googleSubsCell.innerText = googlePurchasers[0].metricValues[0].value;
        if (googleSubsCell) googleSubsCell.innerText = androidSubs.length;

        let appleSubsCell = table.querySelector("#appleSubs");
        if (appleSubsCell) appleSubsCell.innerText = appleFullArr.length-2;

        let appleTrialsCell = table.querySelector("#appleTrials");
        if (appleTrialsCell) appleTrialsCell.innerText = appleFreeTrials.length;

        let stripeSubsCell = table.querySelector("#stripeSubs");
        if (stripeSubsCell) stripeSubsCell.innerText = `Active Subs: ${stripeActiveSubs}\nActive Trials: ${stripeActiveTrials}\nPast Due/ Unpaid: ${stripePastDueUnpaid}\nNon Subs (cancelled): ${stripeNonSubs}`;

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

        doConfetti();
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

    try {
        const [ b2bUsers ] = await Promise.all([
            fetchB2BUsersReport()
        ]);
        
        let table = document.getElementById('reportTable');

        let totalB2BUsersCell = table.querySelector("#totalB2BUsers");
        if(totalB2BUsersCell) totalB2BUsersCell.innerText = b2bUsers;
    } catch(error) {
        let errorMessage = error.message;
        if(error.response && error.response.data && error.response.data.error){
            errorMessage = error.response.data.error;
        }
        console.error('There has been a problem with the combined fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + errorMessage;
    } finally {
        clearInterval(tickInterval);
        button.value = "Get B2B report";
        fetchingB2BReport = false;
        doConfetti();
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

function doConfetti(){
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}