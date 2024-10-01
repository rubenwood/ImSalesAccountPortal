import { authenticateSessionTicket } from "../PlayFabManager.js";
import { fetchUsersByID } from "../db/db-front.js";

document.addEventListener('DOMContentLoaded', async() => {
    await getSuffixMappings();
    await getReportFolders();
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    console.log("QP: ", params);
    if(params == undefined){ return; }
    if(params.SessionTicket == undefined){ return; }

    let userSuffixFolderName = await getUserFolderName(params.SessionTicket);
    //console.log("USER FOLDER / SUFFIX: ", userSuffixFolderName);
    document.getElementById('loginButton').addEventListener('click', () => submitPass(userSuffixFolderName));
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

async function submitPass(userSuffix) {
    let inPass = document.getElementById('password').value;
    
    try {
        let response = await fetch('/reporting/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pass: inPass })
        });
        let result = await response.json();
        
        if (result != true) {
            console.log("Access denied");
            document.getElementById('error-txt').innerHTML = 'Incorrect password. Please try again.';
            return;
        }
        
        document.getElementById('loginModal').style.display = 'none';
        getReports(userSuffix);

        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        startDateInput.addEventListener('change', function () {
            filterReports(startDateInput.value, endDateInput.value);
        });
        endDateInput.addEventListener('change', function () {
            filterReports(startDateInput.value, endDateInput.value);
        });
    
    } catch (err) {
        console.error("Error during authentication", err);
        document.getElementById('error-loading').innerHTML = 'Oops! An error occurred. Please try again later.';
    }
}

let suffixMap = [];
async function getSuffixMappings(){
    const suffixMappingResp = await fetch('/reporting/get-suffix-mappings');
    suffixMap = await suffixMappingResp.json();
    //console.log(suffixMap);
}

let reportFolderNames = [];
async function getReportFolders(){
    const folderResp = await fetch('/reporting/get-report-folders');
    reportFolderNames = await folderResp.json();
    //console.log(reportFolderNames);
}

async function getUserFolderName(sessionTicket){
    let userFolderName;
    const authData = await authenticateSessionTicket(sessionTicket);
    
    if(authData == undefined || authData == null){ 
        console.log("Invalid session");
        return;
    }

    const playFabId = authData.data.UserInfo.PlayFabId;
    const rowData = await fetchUsersByID([playFabId]);
    const combinedData = { accountData: rowData.accountData[0].AccountDataJSON, usageData: rowData.usageData[0].UsageDataJSON };
    //console.log(combinedData);
    const linkedAccounts = combinedData.accountData.LinkedAccounts;
    //console.log(linkedAccounts);
    for(let linkedAcc of linkedAccounts){
        //console.log(linkedAcc);
        if(linkedAcc.Platform == "PlayFab"){
            userFolderName = isValidEmail(linkedAcc.Email);
        }else if(linkedAcc.Platform == "OpenIdConnect"){
            userFolderName = isValidPlatform(linkedAcc.PlatformUserId);
        }
    }

    return userFolderName;
}

function isValidEmail(linkedAccEmail){
    for(let folderName of reportFolderNames){
        let suffix = folderName.replace("/","");
        if(linkedAccEmail.includes(suffix)){
            return suffix;
        }
    }
    return "";
}
function isValidPlatform(linkedAccPlatformId){
    for(let folderName of reportFolderNames){
        let suffix = folderName.replace("/","");
        let platformId = suffix[suffix];
        if(linkedAccPlatformId.includes(platformId)){
            return suffix;
        }
    }
    return "";
}

// Get Reports
let reportResponse = undefined;
async function getReports(suffix) {
    const inPass = document.getElementById('password').value;
    const response = await fetch(`/reporting/reports/${suffix}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-secret-key': inPass
        }
    });

    const result = await response.json();
    reportResponse = result;
    //console.log(result);
    formatHTMLOutput(reportResponse);
}

// format HTML
function formatHTMLOutput(reports) {
    let sectionHtml = {
        login: '<ul>',
        insights: '<ul>',
        progress: '<ul>',
        usage: '<ul>',
        combined: '<ul>'
    };

    reports = SortByDate(reports, "newest");
    
    reports.forEach(file => {
        const listItem = `<li><a href="${file.url}" download="${file.filename}">${file.filename}<i class="fa fa-download" aria-hidden="true"></i></a></li>`;
        if (file.filename.includes('-Login-')) {
            sectionHtml.login += listItem;
        } else if (file.filename.includes('-Insights-')) {
            sectionHtml.insights += listItem;
        } else if (file.filename.includes('-Progress-')) {
            sectionHtml.progress += listItem;
        } else if (file.filename.includes('-Usage-')) {
            sectionHtml.usage += listItem;
        } else if (file.filename.includes('-Combined-')) {
            sectionHtml.combined += listItem;
        }
    });

    for (const key in sectionHtml) {
        sectionHtml[key] += '</ul>';
    }
    document.getElementById('login').innerHTML = sectionHtml.login;
    document.getElementById('insights').innerHTML = sectionHtml.insights;
    document.getElementById('progress').innerHTML = sectionHtml.progress;
    document.getElementById('usage').innerHTML = sectionHtml.usage;
    document.getElementById('combined').innerHTML = sectionHtml.combined;
}

// Sort reports, newest to oldest (or vice versa)
function SortByDate(reports, order = 'newest') {
    return reports.sort((a, b) => {
        let dateA = new Date(a.filename.match(/\d{4}-\d{2}-\d{2}/)[0]);
        let dateB = new Date(b.filename.match(/\d{4}-\d{2}-\d{2}/)[0]);

        // Sort based on the provided order
        if (order === 'newest') {
            return dateB - dateA; // Newest to oldest
        } else if (order === 'oldest') {
            return dateA - dateB; // Oldest to newest
        }
    });
}

// Filter Reports
function filterReports(startDate, endDate) {
    // Convert the input dates to Date objects for comparison
    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;

    let reportsMatchingDate = reportResponse.filter(report => {
        let filename = report.filename;
        let dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/); // Regex to match the date part

        if (dateMatch) {
            let reportDate = new Date(dateMatch[0]);

            if ((start === null || reportDate >= start) && (end === null || reportDate <= end)) {
                return true;
            }
        }
        return false;
    });

    console.log("Reports matching date range: ", reportsMatchingDate);
    
    if (reportsMatchingDate.length <= 0) {
        setNoReportHTML();
    } else {
        formatHTMLOutput(reportsMatchingDate);
    }
}

function setNoReportHTML(){
    // Set "No Reports HTML here" if no reports match
    const noReportHTML = "<h1>No Reports</h1>";
    document.getElementById('login').innerHTML = noReportHTML;
    document.getElementById('insights').innerHTML = noReportHTML;
    document.getElementById('progress').innerHTML = noReportHTML;
    document.getElementById('usage').innerHTML = noReportHTML;
    document.getElementById('combined').innerHTML = noReportHTML;
}