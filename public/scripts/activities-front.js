import {formatTimeToHHMMSS,updateButtonText} from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('generateByActivityIdButton').addEventListener('click', fetchActivityReport);
});

async function fetchActivityReport(){
    // update the button text, so we can see something is happening
    const button = document.getElementById('generateByActivityIdButton');
    const tickUpdater = updateButtonText(button, "Search by Activity ID", 3);
    tickUpdater();
    const tickInterval = setInterval(tickUpdater, 500);

    console.log("working");

    let activityIdsText = document.getElementById("activityIDList").value;
    let activityIdsList = activityIdsText.split('\n').filter(Boolean);
    console.log(activityIdsList);
    const resp = await fetch(`/activities/get-activity-report-id?activities=${activityIdsList}`);
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
        let usersButton = document.createElement('button');
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
        let playerData = JSON.parse(user.PlayerDataJSON.Data.PlayerData.Value);
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
        li.textContent = `${user.PlayerDataJSON.PlayFabId} , ${user}`;
        userList.appendChild(li);
    });

    // Show the modal
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