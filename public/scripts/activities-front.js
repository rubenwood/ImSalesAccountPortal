import {canAccess} from './access-check.js';
import {Login} from './PlayFabManager.js';
import {formatTimeToHHMMSS,updateButtonText} from './utils.js';
import {showActivitiesInsightsModal} from './activities-insights.js';
import { initializeDarkMode } from './themes/dark-mode.js';

let countryNameMap = {};

// Fetch the country codes JSON
function loadCountryNames() {
    return fetch('../scripts/other/countries.json')
        .then(response => response.json())
        .then(data => {
            data.forEach(country => {
                countryNameMap[country.alpha2.toUpperCase()] = country.en;
            });
        })
        .catch(error => {
            console.error('Error loading country codes:', error);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    
    loadCountryNames().then(() => {
        document.getElementById('loginButton').addEventListener('click', Login);
        document.getElementById('generateByActivityTitleButton').addEventListener('click', fetchActivityReportByTitle);
        document.getElementById('generateByActivityIdButton').addEventListener('click', fetchActivityReportById);
        document.getElementById('genActivityInsightsButton').addEventListener('click', ()=>showActivitiesInsightsModal('test'));
        document.getElementById('genReportByActivityIdButton').addEventListener('click', ()=>exportActivityReport(dataToExport));
    });
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

let dataToExport;
async function fetchActivityReportById() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    // update the button text, so we can see something is happening
    const button = document.getElementById('generateByActivityIdButton');
    const tickUpdater = updateButtonText(button, "Search by Activity ID", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    let activityIdsText = document.getElementById("activityList").value;
    let activityIdsList = activityIdsText.split('\n').filter(Boolean);
    const resp = await fetch(`/activities/get-users-by-activity-id?activities=${activityIdsList}`);
    let dbOutput = await resp.json();
    console.log(dbOutput);

    let reportBody = document.getElementById("reportTableBody");
    reportBody.innerHTML = '';
    processReportOutput(dbOutput, reportBody);
    
    clearInterval(tickInterval); // Stop the ticking animation
    button.value = "Search by Activity ID"; 
}

async function fetchActivityReportByTitle(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    // update the button text, so we can see something is happening
    const button = document.getElementById('generateByActivityTitleButton');
    const tickUpdater = updateButtonText(button, "Search by Activity Title", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    let activityIdsText = document.getElementById("activityList").value;
    let activityTitleList = activityIdsText.split('\n').filter(Boolean);
    const resp = await fetch(`/activities/get-users-by-activity-title?activities=${activityTitleList}`);
    const dbOutput = await resp.json();
    console.log(dbOutput);

    let reportBody = document.getElementById("reportTableBody");
    reportBody.innerHTML = '';
    processReportOutput(dbOutput, reportBody);
    
    clearInterval(tickInterval); // Stop the ticking animation
    button.value = "Search by Activity Title"; 
}

function processReportOutput(dbOutput, reportBody) {
    dbOutput.forEach(element => {
        console.log(element);
        let totalPlayTimerPerActivity = formatTimeToHHMMSS(calcTotalPlayTime(element, element.activityID));

        let row = reportBody.insertRow();
        row.style.textAlign = "center";

        let cellActivityID = row.insertCell(0);
        cellActivityID.appendChild(document.createTextNode(element.activityID || 'N/A'));
        let cellActivityName = row.insertCell(1);
        cellActivityName.appendChild(document.createTextNode(element.activityName || 'N/A'));
        let cellUniquePlays = row.insertCell(2);
        cellUniquePlays.appendChild(document.createTextNode(element.uniquePlays || 'N/A'));
        let cellTotalPlayTime = row.insertCell(3);
        cellTotalPlayTime.appendChild(document.createTextNode(totalPlayTimerPerActivity || 'N/A'));
        let cellPlays = row.insertCell(4);
        cellPlays.appendChild(document.createTextNode(element.plays || 'N/A'));

        let cellLocations = row.insertCell(5);
        let locsButton = document.createElement('input');
        locsButton.type = 'button';
        locsButton.value = 'Locations';
        locsButton.textContent = 'Show Locations';
        locsButton.onclick = () => showLocationsModal(element.users); // get locations from users
        cellLocations.appendChild(locsButton);

        let cellUsers = row.insertCell(6);
        let usersButton = document.createElement('input');
        usersButton.type = 'button';
        usersButton.value = 'Users';
        usersButton.textContent = 'Show Users';
        usersButton.onclick = () => showUsersModal(element.users);
        cellUsers.appendChild(usersButton);
    });

    dataToExport = dbOutput;
}

function calcTotalPlayTime(element, activityID){
    let users = element.users;
    let totalPlayTime = 0;

    users.forEach(user =>{
        let playerDataRAW =  user.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
        let playerDataNewLauncherRAW =  user.UsageDataJSON?.Data?.PlayerDataNewLauncher?.Value ?? undefined;
        totalPlayTime += processPlayTime(playerDataRAW, activityID);
        totalPlayTime += processPlayTime(playerDataNewLauncherRAW, activityID);
    });

    console.log("Total playTime for ", activityID, " is ", totalPlayTime);
    return totalPlayTime;
}
function processPlayTime(inputPlayerData, activityID) {
    if (inputPlayerData === undefined) { return 0; }

    let totalPlayTime = 0;
    try {
        let playerData = JSON.parse(inputPlayerData);
        let playerActivities = playerData.activities;

        playerActivities.forEach(activity => {
            if (activity.activityID == activityID) {
                let plays = activity.plays;
                plays.forEach(play => totalPlayTime += play.sessionTime);
            }
        });
    } catch (err) {
        console.error('Error parsing player data:', err);
    }

    return totalPlayTime;
}

function showLocationsModal(users) {
    const modal = document.getElementById('locModal');
    const locList = document.getElementById('modalLocList');
    const closeButton = modal.querySelector('.close');

    locList.innerHTML = '';
    let countries = {};

    // Populate the countries object with user counts
    users.forEach(user => {
        let lastLoginLoc = user.AccountDataJSON.Locations?.LastLogin;
        if (lastLoginLoc && lastLoginLoc.CountryCode) {
            let country = lastLoginLoc.CountryCode;
            if (!countries[country]) {
                countries[country] = { country, count: 1 };
            } else {
                countries[country].count++;
            }
        }
    });

    // Calculate total count
    let totalUsers = Object.values(countries).reduce((sum, { count }) => sum + count, 0);

    // Add total count to the modal
    let totalItem = document.createElement('li');
    totalItem.textContent = `Total Users: ${totalUsers}`;
    totalItem.style.fontWeight = 'bold';
    locList.appendChild(totalItem);

    // Sort countries by count (descending) and add them to the modal
    Object.values(countries)
        .sort((a, b) => b.count - a.count)
        .forEach(({ country, count }) => {
            let countryName = countryNameMap[country.toUpperCase()] || country;
            let listItem = document.createElement('li');
            listItem.textContent = `${countryName}: ${count}`;
            locList.appendChild(listItem);
        });

    console.log(countries);
    console.log(`Total Users: ${totalUsers}`);

    // Modal
    modal.style.display = "block";
    closeButton.onclick = function () {
        modal.style.display = "none";
    }
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

function showUsersModal(users) {
    const modal = document.getElementById('userModal');
    const userList = document.getElementById('modalUserList');
    const closeButton = modal.querySelector('.close');

    userList.innerHTML = '';
    users.forEach(user => {
        let li = document.createElement('li');        
        let button = document.createElement('input');
        button.type = 'button';
        button.value = 'Inspect';
        button.style.width = '70px';
        button.style.height = '30px'; 
        button.style.marginRight = '5px';
        button.style.padding = '5px';
        button.addEventListener('click', () => inspectUserClicked(user));

        li.appendChild(button);
        li.append(` ${user.UsageDataJSON.PlayFabId}`);
        
        userList.appendChild(li);
    });

    // Modal
    modal.style.display = "block";
    closeButton.onclick = function() {
        modal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

export function inspectUserClicked(user) {
    console.log(user);
    let playerData = user.UsageDataJSON?.Data?.PlayerData?.Value;
    console.log(user.UsageDataJSON.PlayFabId + " Inspect clicked");
    console.log(playerData);    
}

// EXPORT REPORT
export function exportActivityReport(exportData){
    console.log("called");
    let workbook = XLSX.utils.book_new();
    //let insightsWorksheet = XLSX.utils.json_to_sheet(insightsExportData);
    //XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");

    let activityDataWorksheet = XLSX.utils.json_to_sheet(exportData);    
    XLSX.utils.book_append_sheet(workbook, activityDataWorksheet, "Report");

    let today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `ActivityReport-${today}.xlsx`);
}