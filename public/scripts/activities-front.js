import {canAccess} from './access-check.js';
import {Login} from './PlayFabManager.js';
import {formatTimeToHHMMSS,updateButtonText} from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('generateByActivityIdButton').addEventListener('click', fetchActivityReport);
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
        let cellUsers = row.insertCell(5);
        let usersButton = document.createElement('input');
        usersButton.type = 'button';
        usersButton.value = 'Users';
        usersButton.textContent = 'Show Users';
        usersButton.onclick = () => showModal(element.users);
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

function showModal(users) {
    const modal = document.getElementById('userModal');
    const userList = document.getElementById('modalUserList');
    const span = document.getElementsByClassName("close")[0];

    // Clear previous list
    userList.innerHTML = '';
    // Populate list with users
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

export function inspectUserClicked(user){
    console.log(user);
    let playerData = user.UsageDataJSON?.Data?.PlayerData?.Value;
    console.log(user.UsageDataJSON.PlayFabId + " Inspect clicked");
    console.log(playerData);
    
}

//