import { canAccess, Login, RegisterUserEmailAddress } from './PlayFabManager.js';
import { getTotalPlayTime } from './insights.js';
import { formatTime, formatTimeToHHMMSS, formatActivityData, getAcademicAreas } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('registerButton').addEventListener('click', RegisterUserEmailAddress);
    document.getElementById('generatePassword').addEventListener('click', generatePass);
    document.getElementById('generateReportButton').addEventListener('click', generateReport);
    document.getElementById('exportReportButton').addEventListener('click', exportToExcel);
    document.getElementById('closePlayerDataModal').addEventListener('click', closePlayerDataModal);
    document.getElementById('getSegmentsButton').addEventListener('click', getSegmentsClicked);
    document.getElementById('getSegmentPlayersButton').addEventListener('click', getPlayersInSegmentClicked);
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

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
async function initializeDropdown() {
    try {
        const academicAreas = await getAcademicAreas();
        if (academicAreas) {
            const selectElement = document.getElementById('academicArea');
            academicAreas.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.id;
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}
initializeDropdown();

// Function to fetch user data for a given email
function fetchUserAccInfoByEmail(email) {
    const url = `/get-user-acc-info-email/${email}`;

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
function fetchUserAccInfoById(playFabID) {
    const url = `/get-user-acc-info-id/${playFabID}`;

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

// GENERATE REPORT
export let reportData = [];
// Function to generate the report
export async function generateReport() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    reportData = []; // reset the report data
    exportData = [];

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
            .then(() => fetchUserAccInfoByEmail(email))
            .then(respData => { userAccInfo = respData; })
            .then(() => fetchUserData(userAccInfo.data.UserInfo.PlayFabId))
            .then(respData => {
                userData = respData;
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
                        activityContent +=`<tr><td><b>Activity Name</b></td><td>${activity.activityTitle}</td></tr>`;
                        activityContent += `<tr><td><b>Plays</b></td><td>${activity.plays.length}</td></tr>`;
                        let totalSessionTime = 0;
                        let bestScore = 0;
                        totalPlays += activity.plays.length;
                        activity.plays.forEach(play => {
                            totalSessionTime += Math.round(Math.abs(play.sessionTime));
                            totalPlayTime += totalSessionTime;
                            if(play.normalisedScore > bestScore){
                                bestScore = Math.round(play.normalisedScore * 100);
                            }
                        });
                        activityContent += `<tr><td><b>Total Session Length</b></td><td>${formatTime(totalSessionTime)}</td></tr><br />`;
                        activityContent += `<tr><td><b>Best Score</b></td><td>${bestScore} %</td></tr><br />`;
                        activityContent += "</table>";
                        playerDataContent += activityContent;

                        // add the unformatted data for the report
                        let userActivityData = {                             
                            activityID:activity.activityID,
                            activityTitle: activity.activityTitle,
                            plays:activity.plays,
                            playCount:activity.plays.length,
                            totalSessionTime:totalSessionTime,
                            bestScore:bestScore
                        };
                        activityDataForReport.push(userActivityData);
                    });
                    playerDataContent += `<h1>Total Plays: ${totalPlays}</h1>`;
                    playerDataContent += `<h1>Total Activities Played: ${playerData.activities.length}</h1>`;
                    playerDataContent += `<h1>Total Play Time: ${formatTime(totalPlayTime)}</h1>`;
                    let averageTimePerPlay = Math.round(totalPlayTime / totalPlays); 
                    playerDataContent += `<h1>Avg. Time per activity: ${formatTime(averageTimePerPlay)}</h1>`;
                    addCellToRow(row, 'Expand Player Data', 1, true, playerDataContent);
                    
                    // add to stored data
                    let playerDataForReport = { // (per user)
                        userPlayFabId: userAccInfo.data.UserInfo.PlayFabId, // hide from exported report
                        email:email,
                        createdDate: createdDate.toDateString(),
                        lastLoginDate: lastLoginDate.toDateString(),
                        daysSinceCreation: daysSinceCreation,
                        accountExpiryDate: accountExpiryDate,
                        daysToExpire: daysToExpire, 
                        createdBy: createdBy, // hide from exported report
                        createdFor: createdFor, // hide from exported report
                        activityData: activityDataForReport, // hide from exported report
                        activityDataFormatted: formatActivityData(activityDataForReport),
                        totalPlays,
                        totalPlayTime,
                        averageTimePerPlay

                    };
                    reportData.push(playerDataForReport);

                    // slightly different data for export
                    let userExportData = {
                        email:email,
                        createdDate: createdDate.toDateString(),
                        lastLoginDate: lastLoginDate.toDateString(),
                        daysSinceCreation: daysSinceCreation,
                        accountExpiryDate: accountExpiryDate,
                        daysToExpire: daysToExpire, 
                        activityDataFormatted: formatActivityData(activityDataForReport),
                        totalPlays,
                        totalPlayTime,
                        averageTimePerPlay
                    }                    
                    exportData.push(userExportData);
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

// SEGMENT RELATED
async function getSegmentsClicked(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    let segmentResponse = await fetchSegments();
    let segments = segmentResponse.data.Segments;
    //console.log(segments);
    populateSegmentsDropdown(segments);
}
function populateSegmentsDropdown(segments) {
    const dropdown = document.getElementById("segmentSelection");
    dropdown.innerHTML = '';

    segments.forEach(segment => {
        const option = document.createElement("option");
        option.value = segment.Id;
        option.textContent = segment.Name;
        dropdown.appendChild(option);
    });
}

function fetchSegments(){
    const url = `/get-segments`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
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

async function getPlayersInSegmentClicked(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    // Get the selected segment ID from the dropdown
    const selectedSegmentId = document.getElementById("segmentSelection").value;
    if (!selectedSegmentId) {
        console.log("No segment selected");
        return;
    }

    let data = await fetchSegmentPlayers(selectedSegmentId);
    let playerProfiles = data.data.PlayerProfiles;

     // Use map to transform each profile into a promise of email address
     const emailPromises = playerProfiles.map(profile => getPlayerEmailAddr(profile.PlayerId));

     // Wait for all promises to resolve
     const emailList = await Promise.all(emailPromises);
     //console.log(emailList);
     const emailListString = emailList.join('\n');
    // Set the email list string as the value of the textarea
    document.getElementById("emailList").value = emailListString;
}
async function getPlayerEmailAddr(playFabId) {
    try{
        let playerData = await fetchUserAccInfoById(playFabId);
        let userEmail = playerData.data.UserInfo.PrivateInfo.Email;
        return userEmail;
    } catch (error) {
        console.error(`Error fetching email for PlayFab ID ${playFabId}:`, error);
        return null; // or some default value or error indicator
    }    
}
function fetchSegmentPlayers(reqSegmentID){
    const url = `/get-segment-players/${reqSegmentID}`;
    let segmentID = reqSegmentID;
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segmentID })
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

// EXPORT REPORT
let exportData;
function exportToExcel() {
    let workbook = XLSX.utils.book_new();

    // add any relevant insights data
    let totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(reportData);
    let totalPlayTimeAcrossAllUsersSecondsFormatted = formatTime(totalPlayTimeAcrossAllUsersSeconds);
    let insightsExportDataJSON = {
        totalPlayTimeAcrossAllUsers: formatTimeToHHMMSS(totalPlayTimeAcrossAllUsersSeconds)
    }
    let insightsExportData = [];
    insightsExportData.push(insightsExportDataJSON);

    let allData = [];
    exportData.forEach(dataToExport => {
        let isFirstActivity = true; // Flag to check if it's the first activity for the user

        dataToExport.activityDataFormatted.forEach(activity => {
            let row = {
                activityID: activity.activityID,
                activityTitle: activity.activityTitle,
                playDate: activity.playDate,
                score: (activity.score * 100) + '%',
                sessionTime: formatTimeToHHMMSS(activity.sessionTime)
            };

            if (isFirstActivity) {
                // Include user data only for the first activity
                row = {                    
                    email: dataToExport.email,
                    createdDate: dataToExport.createdDate,
                    lastLoginDate: dataToExport.lastLoginDate,
                    daysSinceCreation: dataToExport.daysSinceCreation,
                    accountExpiryDate: dataToExport.accountExpiryDate,
                    daysToExpire: dataToExport.daysToExpire,
                    totalPlays: dataToExport.totalPlays,
                    totalPlayTime: formatTimeToHHMMSS(dataToExport.totalPlayTime),
                    averageTimePerPlay: formatTimeToHHMMSS(dataToExport.averageTimePerPlay),
                    ...row, // Activity data
                };
                isFirstActivity = false; // Set the flag to false after adding user data
            }
            allData.push(row);
        });
        allData.push({});
    });

    let insightsWorksheet = XLSX.utils.json_to_sheet(insightsExportData);
    let userDataWorksheet = XLSX.utils.json_to_sheet(allData);    

    XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");
    XLSX.utils.book_append_sheet(workbook, userDataWorksheet, "Report");
    XLSX.writeFile(workbook, "Report.xlsx");
}