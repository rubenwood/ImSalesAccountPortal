import {canAccess} from './access-check.js';
import {Login} from './PlayFabManager.js';
import {formatTimeToHHMMSS,updateButtonText} from './utils.js';

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
    loadCountryNames().then(() => {
        document.getElementById('loginButton').addEventListener('click', Login);
        document.getElementById('generateByActivityIdButton').addEventListener('click', fetchActivityReport);
    });
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

async function fetchActivityReport(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    // update the button text, so we can see something is happening
    const button = document.getElementById('generateByActivityIdButton');
    const tickUpdater = updateButtonText(button, "Search by Activity ID", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    console.log("working");

    let activityIdsText = document.getElementById("activityIDList").value;
    let activityIdsList = activityIdsText.split('\n').filter(Boolean);
    const resp = await fetch(`/activities/get-users-by-activity?activities=${activityIdsList}`);
    let output = await resp.json();
    console.log(output);

    let reportBody = document.getElementById("reportTableBody");
    reportBody.innerHTML = '';
    
    output.forEach(element => {
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
        locsButton.onclick = () => showLocationsModal(element.users);
        cellLocations.appendChild(locsButton);

        let cellUsers = row.insertCell(6);
        let usersButton = document.createElement('input');
        usersButton.type = 'button';
        usersButton.value = 'Users';
        usersButton.textContent = 'Show Users';
        usersButton.onclick = () => showUsersModal(element.users);
        cellUsers.appendChild(usersButton);
    });
    
    clearInterval(tickInterval); // Stop the ticking animation
    button.value = "Search by Activity ID"; 
}

function calcTotalPlayTime(element, activityID){
    let users = element.users;
    let totalPlayTime = 0;

    users.forEach(user =>{
        let playerDataRAW =  user.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
        let playerData = JSON.parse(playerDataRAW);
        let playerActivities = playerData.activities;
        playerActivities.forEach(activity =>{
            if(activity.activityID == activityID){
                let plays = activity.plays;
                let playTime = 0;
                plays.forEach(play => playTime += play.sessionTime);
                totalPlayTime += playTime;
            }
        })
    });

    console.log("Total playTime for ", activityID, " is ", totalPlayTime);
    return totalPlayTime;
}

function showLocationsModal(users) {
    const modal = document.getElementById('locModal');
    const locList = document.getElementById('modalLocList');
    const span = document.getElementsByClassName("close")[0];

    locList.innerHTML = '';
    let countries = {};

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
    let totalUsers = 0;
    Object.entries(countries).forEach(([country, { count }]) => {
        totalUsers += count;
        let countryName = countryNameMap[country.toUpperCase()] || country;
        let listItem = document.createElement('li');
        listItem.textContent = `${countryName}: ${count}`;
        locList.appendChild(listItem);
    });

    // Add total count to the modal
    let totalItem = document.createElement('li');
    totalItem.textContent = `Total Users: ${totalUsers}`;
    totalItem.style.fontWeight = 'bold';
    locList.appendChild(totalItem);

    console.log(countries);
    console.log(`Total Users: ${totalUsers}`);

    // Modal
    modal.style.display = "block";
    span.onclick = function () {
        modal.style.display = "none";
    }
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}

function showUsersModal(users){
    const modal = document.getElementById('userModal');
    const userList = document.getElementById('modalUserList');
    const span = document.getElementsByClassName("close")[0];

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
    span.onclick = function() {
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

//