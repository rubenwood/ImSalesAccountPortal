import { fetchUserAccess } from "./PlayFabManager.js";
import { Login, RegisterUserEmailAddress } from './PlayFabManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Bind event listeners
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('registerButton').addEventListener('click', RegisterUserEmailAddress);
    document.getElementById('generatePassword').addEventListener('click', generatePass);
    document.getElementById('generateReportButton').addEventListener('click', generateReport);
    document.getElementById('exportReportButton').addEventListener('click', exportToExcel);
    document.getElementById('closePlayerDataModal').addEventListener('click', closePlayerDataModal);
});

let lessonInfo;
let pracInfo;

window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};
function getLessonInfo(){
    const url = `/getLessonInfo`;
    let area = "ucla";
  
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ area }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        return response.json();
    })
    .then(data =>{
        lessonInfo = data;
    })
  }
  function getPracInfo(){
    const url = `/getPracInfo`;
    let area = "ucla";
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ area }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        return response.json();
    })
    .then(data =>{        
        pracInfo = data;
    })
  }
  getLessonInfo();
  getPracInfo();


// public button event, when clicked, updates confluence page
export function callUpdateConfluencePage(email, pass, area, expiry, createdBy, createdFor){
    const pageId = '929333296'; // Replace with your page ID
    const url = `/update-confluence-page/${pageId}`;

    fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, pass, area, expiry, createdBy, createdFor }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        document.getElementById("resultOutput").innerHTML = "Account Created, Data added, confluence page updated:\nhttps://immersify.atlassian.net/wiki/spaces/DEVTeam/pages/929333296/Test+Accounts+Automated";
        document.getElementById("registerButton").value  = "Register";
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

export function generatePass() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const allCharacters = alphabet + digits;

    // Randomly choose a length between 8 and 12
    const length = Math.floor(Math.random() * 5) + 8; // Will generate a number between 8 and 12

    let password = '';

    // Ensure at least one digit is included
    password += digits[Math.floor(Math.random() * digits.length)];

    // Generate the rest of the password
    for (let i = 1; i < length; i++) {
        password += allCharacters[Math.floor(Math.random() * allCharacters.length)];
    }

    // Shuffle to randomize the position of the digit
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    document.getElementById("emailSignUpPassword").value = password;
    return password;
}

// POPULATE DROP DOWN (ACADEMIC AREA)
function populateDropdown(data) {
    const selectElement = document.getElementById('academicArea');
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.id;
        selectElement.appendChild(option);
    });
}

// Function to fetch and process JSON data
function fetchAndPopulate() {
    const url = `/getAcademicAreas`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            populateDropdown(data.academicAreas);
        })
        .catch(error => console.error('Error fetching data:', error));
}
// Fetch and populate on page load
fetchAndPopulate();

// Function to fetch user data for a given email
function fetchUserAccInfo(email) {
    const url = `/get-user-acc-info/${email}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}
function fetchUserData(playFabID) {
    const url = `/get-user-data/${playFabID}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playFabID }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}

let reportData = [];
// Function to generate the report
export async function generateReport() {
    let accessCheckResponse = await fetchUserAccess();
    if(accessCheckResponse == undefined){ return; }
    if (!accessCheckResponse.isAuthorized) { return; }

    reportData = []; // reset the report data

    const emailListText = document.getElementById("emailList").value;
    const emailList = emailListText.split('\n').filter(Boolean); // Split by newline and filter out empty strings
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = ''; // Clear out the existing rows

    // Helper function to delay execution
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    let userAccInfo;
    let userData;

    // Create an array of promises for fetching user data
    const fetchPromises = emailList.map((email, index) => {
        return delay(index * 1000) // Delay
            .then(() => fetchUserAccInfo(email))
            .then(respData => { userAccInfo = respData; })
            .then(() => fetchUserData(userAccInfo.data.UserInfo.PlayFabId))
            .then(respData => {
                userData = respData;
                //console.log("USER DATA:");
                //console.log(userData);
                let createdDate = new Date(userAccInfo.data.UserInfo.TitleInfo.Created);
                let lastLoginDate =  new Date(userAccInfo.data.UserInfo.TitleInfo.LastLogin);
                let today = new Date();
                let diffTime = Math.abs(today - createdDate);
                let daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let accountExpiryDate = userData.data.Data.TestAccountExpiryDate !== undefined ? new Date(userData.data.Data.TestAccountExpiryDate.Value) : "No Expiry Date";
                let daysToExpire;
                if (accountExpiryDate instanceof Date && !isNaN(accountExpiryDate)) {
                    let diffTime2 = Math.abs(today - accountExpiryDate);
                    daysToExpire = Math.ceil(diffTime2 / (1000 * 60 * 60 * 24));
                    accountExpiryDate = accountExpiryDate.toDateString(); // Convert to string if it's a valid date
                } else {
                    daysToExpire = "No Expiry Date";
                    accountExpiryDate = "No Expiry Date"; // Use the string directly
                }

                let createdBy = userData.data.Data.CreatedBy !== undefined ? userData.data.Data.CreatedBy.Value : "";
                let createdFor = userData.data.Data.CreatedFor !== undefined ? userData.data.Data.CreatedFor.Value : "";

                // Append data to the table
                const row = tableBody.insertRow();
                row.className = 'report-row';
                addCellToRow(row, email, false);
                addCellToRow(row, createdDate.toDateString(), false);
                addCellToRow(row, lastLoginDate.toDateString(), false);
                addCellToRow(row, daysSinceCreation, false);
                addCellToRow(row, accountExpiryDate, false);
                addCellToRow(row, daysToExpire, false);
                addCellToRow(row, createdBy, false);
                addCellToRow(row, createdFor, false);
                
                // process PlayerData
                let playerData = userData.data.Data.PlayerData !== undefined ? JSON.parse(userData.data.Data.PlayerData.Value) : undefined;
                let totalPlays = 0;
                let totalPlayTime = 0;
                let activityDataForReport = [];
                if(playerData !== undefined){
                    let playerDataContent = '';
                    playerData.activities.forEach(activity => {
                        let activityContent =`<table><tr><td><b>Activity ID</b></td><td>${activity.activityID}</td></tr>`;
                        activityContent += `<tr><td><b>Plays</b></td><td>${activity.plays.length}</td></tr>`;
                        let totalSessionTime = 0;
                        let bestScore = 0;
                        totalPlays += activity.plays.length;
                        activity.plays.forEach(play => {
                            totalSessionTime += Math.round(play.sessionTime);
                            totalPlayTime += totalSessionTime;
                            if(play.normalisedScore > bestScore){
                                bestScore = Math.round(play.normalisedScore * 100);
                            }
                        });
                        activityContent += `<tr><td><b>Total Session Length</b></td><td>${totalSessionTime} seconds</td></tr><br />`;
                        activityContent += `<tr><td><b>Best Score</b></td><td>${bestScore} %</td></tr><br />`;
                        activityContent += "</table>";
                        playerDataContent += activityContent;

                        // add the unformatted data for the report
                        let activityData = { 
                            activityID:activity.activityID,
                            plays:activity.plays.length,
                            totalSessionTime:totalSessionTime,
                            bestScore:bestScore
                        };
                        activityDataForReport.push(activityData);
                    });
                    playerDataContent += `<h1>Total Plays: ${totalPlays}</h1>`;
                    playerDataContent += `<h1>Total Play Time: ${formatTime(totalPlayTime)}</h1>`;
                    let averageTimePerPlay = Math.round(totalPlayTime / totalPlays); 
                    playerDataContent += `<h1>Avg. Time per activity: ${formatTime(averageTimePerPlay)}</h1>`;
                    addCellToRow(row, 'Expand Player Data', 1, true, playerDataContent);
                    
                    // add to stored data
                    //console.log(activityDataForReport);
                    let playerDataForReport = {
                        email: email,
                        createdDate: createdDate.toDateString(),
                        lastLoginDate: lastLoginDate.toDateString(),
                        daysSinceCreation: daysSinceCreation,
                        accountExpiryDate: accountExpiryDate,
                        daysToExpire: daysToExpire,
                        createdBy: createdBy,
                        createdFor: createdFor,
                        activityData: formatActivityData(activityDataForReport)
                    };
                    reportData.push(playerDataForReport);
                }else{
                    addCellToRow(row, 'No Player Data', false);
                }
                
                // highlight rules
                if(!isNaN(daysToExpire) && daysToExpire < 7)
                {
                    row.style.backgroundColor = '#ffa500'; // Orange color
                    row.addEventListener('mouseenter', e => showTooltip(e, 'Account is expiring soon.'));
                    row.addEventListener('mouseleave', hideTooltip);
                }

                if (daysSinceCreation >= 2 && createdDate.toDateString() === lastLoginDate.toDateString())
                {
                    row.style.backgroundColor = '#fa8c8cab'; // Highlight the cell in red
                    row.addEventListener('mouseenter', e => showTooltip(e, 'Its been a while since this account was created and the user hasnt logged in.'));
                    row.addEventListener('mouseleave', hideTooltip);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                const row = tableBody.insertRow();
                row.insertCell().textContent = 'Error for email: ' + email;
                row.insertCell().textContent = error.message;
                row.insertCell().colSpan = 4; // empty columns
                row.style.color = 'white';
                row.style.fontWeight = 'bold';
                row.style.backgroundColor = '#700000';
                row.style.textAlign = 'center';
            });
    });

    // Wait for all the fetch calls to settle
    Promise.allSettled(fetchPromises).then(results => {
        console.log('All fetch calls have been processed');
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    });
}
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minutes, ${remainingSeconds} seconds`;
}
function formatActivityData(activityData) {
    return activityData.map(activity => {
      return `Activity ID: ${activity.activityID}, Plays: ${activity.plays}, Total Session Time: ${activity.totalSessionTime} seconds, Best Score: ${activity.bestScore}%`;
    }).join("\n"); // Join each activity's string with a newline
  }

function addCellToRow(row, text, colSpan = 1, isCollapsible = false, collapsibleContent = '') {
    const cell = row.insertCell();
    if(!isCollapsible){     
        cell.textContent = text;
        cell.style.textAlign = 'center';
        cell.colSpan = colSpan;
    }else{
        const collapseButton = document.createElement('button');
        collapseButton.textContent = text;
        collapseButton.onclick = function() {
            //this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none';
            showPlayerDataModal(collapsibleContent);
        };
        collapseButton.className = 'collapsible-button';

        const collapsibleDiv = document.createElement('div');
        collapsibleDiv.style.display = 'none';
        collapsibleDiv.innerHTML = collapsibleContent;

        cell.appendChild(collapseButton);
        cell.appendChild(collapsibleDiv);
        collapsibleDiv.className = 'collapsible-content';

        cell.appendChild(collapseButton);
    }    
}

// PLAYER DATA MODAL
function showPlayerDataModal(content) {
    document.getElementById('playerDataModalBody').innerHTML = content;
    document.getElementById('playerDataModal').style.display = 'block';
}

function closePlayerDataModal() {
    document.getElementById('playerDataModal').style.display = 'none';
}

// REPORT TOOLTIPS
function showTooltip(event, message) {
    // Create tooltip element if it doesn't exist
    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
    }

    // Set message and position of tooltip
    tooltip.textContent = message;
    tooltip.style.left = event.pageX + 'px';
    tooltip.style.top = event.pageY + 'px';
    tooltip.classList.add('visible');
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

// EXPORT REPORT
function exportToExcel() {
    let workbook = XLSX.utils.book_new();

    // Convert reportData to a worksheet
    let worksheet = XLSX.utils.json_to_sheet(reportData);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, "Report.xlsx");
}
