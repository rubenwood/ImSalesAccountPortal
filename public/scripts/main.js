import { canAccess } from './access-check.js';
import { Login, RegisterUserEmailAddress, UpdateUserDataServer, getPlayerEmailAddr} from './PlayFabManager.js';
import { showInsightsModal, closeInsightsModal, getTotalPlayTime, findPlayersWithMostPlayTime, findPlayersWithMostPlays, findPlayersWithMostUniqueActivitiesPlayed, findMostPlayedActivities } from './insights.js';
import { fetchUserData, fetchUserAccInfoById, fetchUserAccInfoByEmail, formatTime, formatTimeToHHMMSS, formatActivityData, getAcademicAreas } from './utils.js';
import { playerProfiles, getSegmentsClicked, getPlayersInSegmentClicked } from './segments.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', Login);
    // Sign Up / Modify Form
    document.getElementById('signUpFormRadio').addEventListener('change', toggleForms);
    document.getElementById('modifyFormRadio').addEventListener('change', toggleForms);
    toggleForms(); // set initial state
    document.getElementById('registerButton').addEventListener('click', RegisterUserEmailAddress);
    document.getElementById('updateButton').addEventListener('click', UpdateUserDataServer);
    document.getElementById('generatePassword').addEventListener('click', generatePass);
    // segments
    document.getElementById('getSegmentsButton').addEventListener('click', ()=>getSegmentsClicked(document.getElementById('segmentSelection')));
    document.getElementById('getSegmentPlayersButton').addEventListener('click', async ()=>
    { 
        await getSegmentPlayersButton();
        document.getElementById('totalPlayersSegment').innerHTML = 'Total players in segment: ' + playerProfiles.length;
    });

    // player id text area
    document.getElementById('toggleIdsButton').addEventListener('click', togglePlayerIdsTextArea);

    // reports
    document.getElementById('generateReportByIdButton').addEventListener('click', generateReportById);
    document.getElementById('generateReportButton').addEventListener('click', generateReportByEmail);
    document.getElementById('exportReportButton').addEventListener('click', exportToExcel);
    document.getElementById('closePlayerDataModal').addEventListener('click', closePlayerDataModal);    
    // insights modal
    document.getElementById('insightsButton').addEventListener('click', ()=>showInsightsModal(reportData));
    document.getElementById('closeInsightsButton').addEventListener('click', closeInsightsModal);
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('playerIDList').style.display = 'none';
};

// Function to toggle between sign up and modify existing forms
function toggleForms() {
    const isSignUpSelected = document.getElementById('signUpFormRadio').checked;
    const signUpForm = document.getElementById('signup-container');
    const modifyForm = document.getElementById('modify-existing-container');

    if (isSignUpSelected) {
        signUpForm.style.display = 'flex'; // or 'flex' or whatever is appropriate
        modifyForm.style.display = 'none';
    } else {
        signUpForm.style.display = 'none';
        modifyForm.style.display = 'flex'; // or 'flex' or whatever is appropriate
    }
}

export function generatePass() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const allCharacters = alphabet + digits;
    // Randomly choose a length between 8 and 12
    const length = Math.floor(Math.random() * 5) + 8;
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
async function initializeDropdown(selectElement) {
    try {
        const academicAreas = await getAcademicAreas();
        if (academicAreas) {
            
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
initializeDropdown(document.getElementById('academicArea'));
initializeDropdown(document.getElementById('academicAreaUpdate'));

// GENERATE REPORT
// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export let reportData = [];
export async function generateReportById() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    const playerIDText = document.getElementById("playerIDList").value;
    const playerIDList = playerIDText.split('\n').filter(Boolean);
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = ''; // Clear out the existing rows

    reportData = []; // reset the report data
    exportData = [];

    let userAccInfo;
    let userData;
    
    // Create an array of promises for fetching user data
    const fetchPromises = playerIDList.map(async (playerID, index) => {
        try {
            await delay(index * 700); // Delay
            userAccInfo = await fetchUserAccInfoById(playerID);
            userData = await fetchUserData(userAccInfo.data.UserInfo.PlayFabId);
            await handleData(userData, userAccInfo, tableBody); // Awaiting handleData
        } catch (error) {
            console.error('Error:', error);
            const row = tableBody.insertRow();
            row.insertCell().textContent = 'Error for email: ' + playerID;
            row.insertCell().textContent = error.message;
            row.insertCell().colSpan = 4; // empty columns
            row.style.color = 'white';
            row.style.fontWeight = 'bold';
            row.style.backgroundColor = '#700000';
            row.style.textAlign = 'center';
        }
    });
    // Wait for all the fetch calls to settle
    Promise.allSettled(fetchPromises).then(results => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    });
}

// Function to generate the report
export async function generateReportByEmail() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    const emailListText = document.getElementById("emailList").value;
    const emailList = emailListText.split('\n').filter(Boolean); // Split by newline and filter out empty strings
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = ''; // Clear out the existing rows

    reportData = []; // reset the report data
    exportData = [];

    let userAccInfo;
    let userData;

    const fetchPromises = emailList.map(async (email, index) => {
        try {
            await delay(index * 700); // Delay
            userAccInfo = await fetchUserAccInfoByEmail(email);
            userData = await fetchUserData(userAccInfo.data.UserInfo.PlayFabId);
            await handleData(userData, userAccInfo, tableBody); // Awaiting handleData
        } catch (error) {
            console.error('Error:', error);
            const row = tableBody.insertRow();
            row.insertCell().textContent = 'Error for email: ' + playerID;
            row.insertCell().textContent = error.message;
            row.insertCell().colSpan = 4; // empty columns
            row.style.color = 'white';
            row.style.fontWeight = 'bold';
            row.style.backgroundColor = '#700000';
            row.style.textAlign = 'center';
        }
    });

    // Wait for all the fetch calls to settle
    Promise.allSettled(fetchPromises).then(results => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    });
}

async function handleData(respData, userAccInfo, tableBody){
    let userData = respData;
    //console.log(userData);
    let email = await getPlayerEmailAddr(userAccInfo.data.UserInfo.PlayFabId);
    let createdDate = new Date(userAccInfo.data.UserInfo.TitleInfo.Created);
    let lastLoginDate =  new Date(userAccInfo.data.UserInfo.TitleInfo.LastLogin);
    let today = new Date();
    let diffTime = Math.abs(today - createdDate);
    let daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let diffTimeLastLogin = Math.abs(today - lastLoginDate);
    let daysSinceLastLogin = Math.ceil(diffTimeLastLogin / (1000 * 60 * 60 * 24));

    let accountExpiryDate = userData.data.Data.TestAccountExpiryDate !== undefined ? new Date(userData.data.Data.TestAccountExpiryDate.Value) : "No Expiry Date";
    let daysToExpire;
    if (accountExpiryDate instanceof Date && !isNaN(accountExpiryDate)) {
        let diffTime2 = Math.abs(today - accountExpiryDate);
        daysToExpire = Math.ceil(diffTime2 / (1000 * 60 * 60 * 24));
        accountExpiryDate = accountExpiryDate.toDateString(); // Convert to string if it's a valid date
    } else {
        daysToExpire = "No Expiry Date";
        accountExpiryDate = "No Expiry Date";
    }

    let createdBy = userData.data.Data.CreatedBy !== undefined ? userData.data.Data.CreatedBy.Value : "";
    let createdFor = userData.data.Data.CreatedFor !== undefined ? userData.data.Data.CreatedFor.Value : "";
    let averageTimePerPlay = 0;

    // Append data to the table
    const row = tableBody.insertRow();
    row.className = 'report-row';
    addCellToRow(row, email, false);
    addCellToRow(row, createdDate.toDateString(), false);
    addCellToRow(row, lastLoginDate.toDateString(), false);
    addCellToRow(row, daysSinceLastLogin, false);
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
        averageTimePerPlay = Math.round(totalPlayTime / totalPlays); 
        playerDataContent += `<h1>Avg. Time per activity: ${formatTime(averageTimePerPlay)}</h1>`;
        addCellToRow(row, 'Expand Player Data', 1, true, playerDataContent);
    }else{
        addCellToRow(row, 'No Player Data', false);
    }

    // add to stored data
    let playerDataForReport = { // (per user)
        userPlayFabId: userAccInfo.data.UserInfo.PlayFabId, // hide from exported report
        email:email,
        createdDate: createdDate.toDateString(),
        lastLoginDate: lastLoginDate.toDateString(),
        daysSinceLastLogin: daysSinceLastLogin,
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
        daysSinceLastLogin: daysSinceLastLogin,
        daysSinceCreation: daysSinceCreation,
        accountExpiryDate: accountExpiryDate,
        daysToExpire: daysToExpire, 
        activityDataFormatted: formatActivityData(activityDataForReport),
        totalPlays,
        totalPlayTime,
        averageTimePerPlay
    }                    
    exportData.push(userExportData);
    
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

// GET PLAYERS IN SEGMENT BUTTON CLICKED
async function getSegmentPlayersButton() {
    let playersInSegOutput = await getPlayersInSegmentClicked(document.getElementById('segmentSelection').value);

    let playerIdList = [];
    let playerEmailPromises = [];

    playersInSegOutput.forEach((playerJson) => {
        playerIdList.push(playerJson.PlayerId);
        // Create a promise for each getPlayerEmailAddr call and add it to the array
        playerEmailPromises.push(getPlayerEmailAddr(playerJson.PlayerId));
    });

    // Wait for all getPlayerEmailAddr calls to complete
    let playerEmailAddrList = await Promise.all(playerEmailPromises);
    playerEmailAddrList = playerEmailAddrList.filter(Boolean); // filter out empty results
    document.getElementById('totalPlayersReport').innerHTML = 'Total players in report: ' + playerEmailAddrList.length;

    //console.log(playerIdList);
    //console.log(playerEmailAddrList);

    // Update the page with the player IDs and email addresses
    if(document.getElementById("playerIDList")){ document.getElementById("playerIDList").value = playerIdList.join('\n') }
    if(document.getElementById("emailList")){ document.getElementById("emailList").value = playerEmailAddrList.join('\n') }
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
let exportData;
function createUserRow(dataToExport, activity, isFirstActivity) {
    let userRow = {
        email: dataToExport.email,
        createdDate: dataToExport.createdDate,
        lastLoginDate: dataToExport.lastLoginDate,
        daysSinceLastLogin: dataToExport.daysSinceLastLogin,
        daysSinceCreation: dataToExport.daysSinceCreation,
        accountExpiryDate: dataToExport.accountExpiryDate,
        daysToExpire: dataToExport.daysToExpire,
        totalPlays: dataToExport.totalPlays,
        totalPlayTime: formatTimeToHHMMSS(dataToExport.totalPlayTime),
        averageTimePerPlay: formatTimeToHHMMSS(dataToExport.averageTimePerPlay)
    };
    return isFirstActivity ? { ...userRow, ...activity } : activity;
}

function exportToExcel() {
    let workbook = XLSX.utils.book_new();

    // add any relevant insights data
    let totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(exportData); // use reportData rather than exportData??
    let playersWithMostPlayTime = findPlayersWithMostPlayTime(exportData, 1, 3); // use reportData rather than exportData??
    let playersWithMostPlays = findPlayersWithMostPlays(exportData, 1, 3);
    let playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayed(reportData, 1, 3);
    let mostPlayedActivities = findMostPlayedActivities(exportData, 1, 10); // use reportData rather than exportData??

    let insightsExportData = [
        { insight: 'Total Play Time Across All Users', value: formatTimeToHHMMSS(totalPlayTimeAcrossAllUsersSeconds) }
    ];

    playersWithMostPlayTime.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Play Time', value: player.email + ' - ' + formatTimeToHHMMSS(player.totalPlayTime) });
    });
    playersWithMostPlays.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Plays', value: player.email + ' - ' + player.totalPlays });
    });
    playersWithMostUniqueActivities.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Unique Activities', value: player.email + ' - ' + player.uniqueActivitiesCount });
    });
    mostPlayedActivities.forEach(activity => {
        insightsExportData.push({ insight: 'Most Played Activities', value: activity.activityTitle + ' - ' + activity.totalPlays });
    });

    // add user data
    let userData = [];
    exportData.forEach(dataToExport => {
        if (dataToExport.activityDataFormatted && dataToExport.activityDataFormatted.length > 0) {
            let isFirstActivity = true;
            dataToExport.activityDataFormatted.forEach(activity => {
                let activityRow = {
                    activityID: activity.activityID,
                    activityTitle: activity.activityTitle,
                    playDate: activity.playDate,
                    score: Math.round(activity.score * 100) + '%',
                    sessionTime: formatTimeToHHMMSS(activity.sessionTime)
                };
                userData.push(createUserRow(dataToExport, activityRow, isFirstActivity));
                isFirstActivity = false;
            });
        } else {
            userData.push(createUserRow(dataToExport, {}, true));
        }
        userData.push({}); // Add an empty row to divide user data chunks
    });

    let insightsWorksheet = XLSX.utils.json_to_sheet(insightsExportData);
    let userDataWorksheet = XLSX.utils.json_to_sheet(userData);

    XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");
    XLSX.utils.book_append_sheet(workbook, userDataWorksheet, "Report");
    XLSX.writeFile(workbook, "Report.xlsx");
}


// TOGGLE PLAYER ID TEXT
async function togglePlayerIdsTextArea(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }
    
    var textarea = document.getElementById('playerIDList');
    if (textarea.style.display === 'none') {
        textarea.style.display = 'block';
    } else {
        textarea.style.display = 'none';
    }
}