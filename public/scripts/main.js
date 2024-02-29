import { canAccess } from './access-check.js';
import { Login, RegisterUserEmailAddress, UpdateUserDataServer, getPlayerEmailAddr } from './PlayFabManager.js';
import { showInsightsModal, closeInsightsModal, getTotalPlayTime, findPlayersWithMostPlayTime, findPlayersWithMostPlays, findPlayersWithMostUniqueActivitiesPlayed, findMostPlayedActivities, getUserAccessPerPlatform } from './insights.js';
import { fetchUserData, fetchUserAccInfoById, fetchUserAccInfoByEmail, formatTime, formatTimeToHHMMSS, formatActivityData, getAcademicAreas } from './utils.js';
import { playerProfiles, getSegmentsClicked, getPlayersInSegmentClicked, fetchPlayersBySuffix } from './segments.js';
import { generateReportByClickId } from './click-id.js';

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
        await getSegmentPlayersButtonClicked();
        document.getElementById('totalPlayersSegment').innerHTML = 'Total players in segment: ' + playerProfiles.length;
    });

    // player id text area
    document.getElementById('toggleIdsButton').addEventListener('click', togglePlayerIdsTextArea);

    // reports
    document.getElementById('generateReportButton').addEventListener('click', generateReportByEmail);
    document.getElementById('generateReportByIdButton').addEventListener('click', generateReportById);
    document.getElementById('generateReportBySuffixButton').addEventListener('click', generateReportBySuffix);
    document.getElementById('generateReportByClickIDButton').addEventListener('click', generateReportByClickId);
    
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

// Generate report by email suffix
export async function generateReportBySuffix() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    resetButtonTexts();
    document.getElementById('generateReportBySuffixButton').value = "Generating Report By Email Suffix...";

    let suffix = document.getElementById("emailList").value;

    let output = await fetchPlayersBySuffix(suffix);
    console.log("total users with suffix: " + output.length);
    //console.log(output);
    
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = ''; // Clear out the existing rows

    reportData = []; // reset the report data
    exportData = [];

    let playerIDList = [];

    let index = 0;
    for(const element of output){
        // if linked accounts includes Platform=="PlayFab" then get login email
        // if linked accounts does not include Platform, get the contact email addresses
        // if neither login nor contact emails are set, leave empty 
        let email = "no email";
        if(element.LinkedAccounts !== undefined && element.LinkedAccounts.length > 0){
            element.LinkedAccounts.forEach(linkedAcc =>{
                if(linkedAcc.Platform == "PlayFab"){
                    if(linkedAcc.Email.includes(suffix)){
                        email = linkedAcc.Email;
                    }
                }else if(linkedAcc.Platform == "OpenIdConnect"){
                    let contactEmail = checkForContactEmailAddr(element, suffix)
                    email = contactEmail == undefined ? "no email" : contactEmail;
                }
            })
        }else{
            let contactEmail = checkForContactEmailAddr(element, suffix)
            email = contactEmail == undefined ? "no email" : contactEmail;
        }

        let createdDate = new Date(element.Created);
        let lastLoginDate = new Date(element.LastLogin);        
        let daysSinceCreation = calcDaysSinceCreation(createdDate);
        let daysSinceLastLogin = calcDaysSinceLastLogin(lastLoginDate);

        // make a new row
        const row = tableBody.insertRow();
        row.className = 'report-row';

        try {
            await delay(500); // delay for each fetch req
            let userData = await fetchUserData(element.PlayerId);
            playerIDList.push(element.PlayerId);

            // FIX DUPLICATE CODE
            let accountExpiryDate = userData.data.Data.TestAccountExpiryDate !== undefined ? new Date(userData.data.Data.TestAccountExpiryDate.Value) : undefined;
            let accountExpiryDateString = accountExpiryDate !== undefined ? accountExpiryDate.toDateString() : "N/A";
            let daysToExpire = calcDaysToExpiry(accountExpiryDate);

            let createdBy = userData.data.Data.CreatedBy !== undefined ? userData.data.Data.CreatedBy.Value : "";
            let createdFor = userData.data.Data.CreatedFor !== undefined ? userData.data.Data.CreatedFor.Value : "";

            // Account Data
            populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, accountExpiryDateString, undefined, "", "");
            // Login Data per platform
            let loginData = populateLoginData(userData.data.Data);
            // Player / Activity Data
            let playerData = userData.data.Data.PlayerData !== undefined ? JSON.parse(userData.data.Data.PlayerData.Value) : undefined;
            let playerDataState = {
                averageTimePerPlay: 0,
                totalPlays: 0,
                totalPlayTime: 0,
                activityDataForReport: []
            };
            let newDataState = populateUseageData(playerData, loginData, playerDataState, row);
            let averageTimePerPlay = newDataState.averageTimePerPlay;
            let totalPlays = newDataState.totalPlays;
            let totalPlayTime = newDataState.totalPlayTime;
            let activityDataForReport = newDataState.activityDataForReport;

            writeDataForReport(element.PlayerId, email, createdDate, lastLoginDate, daysSinceLastLogin,
                daysSinceCreation, accountExpiryDateString, daysToExpire, createdBy, createdFor, activityDataForReport,
                totalPlays, totalPlayTime, averageTimePerPlay, loginData);      
        } catch (error) {
            let errorStr = `Error fetching data for user ${element.PlayerId}: ${error.message}`;
            console.error(errorStr);
            while (row.firstChild) { row.removeChild(row.firstChild); } // clear out any cells that may have been added
            row.style.backgroundColor = '#ff8c8cab'; // Highlight the cell in red
            // re-add the rows, but with the error string
            populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, errorStr, undefined, "", "");
        }

        index++;        
        document.getElementById('generateReportBySuffixButton').value = `Generating Report By Email Suffix... ${index}/${output.length}`;
    };
    updateIDList(playerIDList);

    // confetti & confirmation of completion
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// Generate report by ID
export async function generateReportById() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    resetButtonTexts();

    const playerIDText = document.getElementById("playerIDList").value;
    const playerIDList = playerIDText.split('\n').filter(Boolean);
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = ''; // Clear out the existing rows

    reportData = []; // reset the report data
    exportData = [];

    //let userAccInfo;
    //let userData;
    
    // Create an array of promises for fetching user data
    const fetchPromises = playerIDList.map(async (playerID, index) => {
        try {
            await delay(index * 700); // Delay
            let userAccInfo = await fetchUserAccInfoById(playerID);
            let userData = await fetchUserData(userAccInfo.data.UserInfo.PlayFabId);
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

// Generate report by email list
export async function generateReportByEmail() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    resetButtonTexts();

    let playerIDList = [];
    const emailListText = document.getElementById("emailList").value;
    const emailList = emailListText.split('\n').filter(Boolean); // Split by newline and filter out empty strings
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';

    reportData = [];
    exportData = [];

    //let userAccInfo;
    //let userData;
    //let userIDList = [];

    const fetchPromises = emailList.map(async (email, index) => {
        try {
            await delay(index * 700);
            let userAccInfo = await fetchUserAccInfoByEmail(email);
            if(userAccInfo.error){ throw new Error(userAccInfo.message);}  
            playerIDList.push(userAccInfo.data.UserInfo.PlayFabId);
            let userData = await fetchUserData(userAccInfo.data.UserInfo.PlayFabId);
            await handleData(userData, userAccInfo, tableBody);
        } catch (error) {
            //console.log(email);
            console.error(`Error: ${email}`, error);
            const row = tableBody.insertRow();
            row.insertCell().textContent = 'Error for email: ' + email;
            row.insertCell().textContent = error.message;
            row.insertCell().colSpan = 4; // empty columns
            row.style.color = 'white';
            row.style.fontWeight = 'bold';
            row.style.backgroundColor = '#700000';
            row.style.textAlign = 'center';
        }
        let count = index;
        count++;
        document.getElementById('generateReportButton').value = `Generating Report By Email List...${count}/${fetchPromises.length}`;
        updateIDList(playerIDList);
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

// HANDLE DATA (populate report)
async function handleData(respData, userAccInfo, tableBody){
    let userData = respData;

    let email = await getPlayerEmailAddr(userAccInfo.data.UserInfo.PlayFabId);
    let createdDate = new Date(userAccInfo.data.UserInfo.TitleInfo.Created);
    let lastLoginDate =  new Date(userAccInfo.data.UserInfo.TitleInfo.LastLogin);
    //let today = new Date();
    let daysSinceCreation = calcDaysSinceCreation(createdDate);
    let daysSinceLastLogin = calcDaysSinceLastLogin(lastLoginDate);

    let accountExpiryDate = userData.data.Data.TestAccountExpiryDate !== undefined ? new Date(userData.data.Data.TestAccountExpiryDate.Value) : undefined;
    let accountExpiryDateString = accountExpiryDate !== undefined ? accountExpiryDate.toDateString() : "N/A";
    let daysToExpire = calcDaysToExpiry(accountExpiryDate);

    let createdBy = userData.data.Data.CreatedBy !== undefined ? userData.data.Data.CreatedBy.Value : "";
    let createdFor = userData.data.Data.CreatedFor !== undefined ? userData.data.Data.CreatedFor.Value : "";
    
    // Append account data to the table
    const row = tableBody.insertRow();
    row.className = 'report-row';
    populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, 
        accountExpiryDateString, daysToExpire, createdBy, createdFor);
    
    // get last login dates per platform
    let loginData = populateLoginData(userData.data.Data);

    // process PlayerData
    let playerData = userData.data.Data.PlayerData !== undefined ? JSON.parse(userData.data.Data.PlayerData.Value) : undefined;
    // need this to preserve the data state, so it can be mutated by populatePlayerData, 
    // and then written to export data further down
    let playerDataState = {
        averageTimePerPlay: 0,
        totalPlays: 0,
        totalPlayTime: 0,
        activityDataForReport: []
    };
    let newDataState = populateUseageData(playerData, loginData, playerDataState, row);
    let averageTimePerPlay = newDataState.averageTimePerPlay;
    let totalPlays = newDataState.totalPlays;
    let totalPlayTime = newDataState.totalPlayTime;
    let activityDataForReport = newDataState.activityDataForReport;

    // add to stored data
    writeDataForReport(userAccInfo.data.UserInfo.PlayFabId, email, createdDate, lastLoginDate,
        daysSinceLastLogin,daysSinceCreation,accountExpiryDateString,daysToExpire,createdBy,
        createdFor,activityDataForReport,totalPlays,totalPlayTime,averageTimePerPlay, loginData);
    
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
function populateUseageData(playerData, loginData, state, row){
    if(playerData == undefined){ addCellToRow(row, 'No Useage Data', false); return state; }

    let playerDataContent = '';
    playerDataContent += `<b>Last Login Android:</b> ${loginData.lastLoginAndr} <br/>
                        <b>Last Login iOS:</b> ${loginData.lastLoginIOS} <br/> 
                        <b>Last Login Web:</b> ${loginData.lastLoginWeb} <br/>`;
    
    playerData.activities.forEach(activity => {
        let activityContent =`<table><tr><td><b>Activity ID</b></td><td>${activity.activityID}</td></tr>`;
        activityContent +=`<tr><td><b>Activity Name</b></td><td>${activity.activityTitle}</td></tr>`;
        activityContent += `<tr><td><b>Plays</b></td><td>${activity.plays.length}</td></tr>`;
        let totalSessionTime = 0;
        let bestScore = 0;
        state.totalPlays += activity.plays.length;
        activity.plays.forEach(play => {
            totalSessionTime += Math.round(Math.abs(play.sessionTime));
            state.totalPlayTime += totalSessionTime;
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
        state.activityDataForReport.push(userActivityData);
    });

    playerDataContent += `<h1>Total Plays: ${state.totalPlays}</h1>`;
    playerDataContent += `<h1>Total Activities Played: ${playerData.activities.length}</h1>`;
    playerDataContent += `<h1>Total Play Time: ${formatTime(state.totalPlayTime)}</h1>`;
    state.averageTimePerPlay = Math.round(state.totalPlayTime / state.totalPlays); 
    playerDataContent += `<h1>Avg. Time per activity: ${formatTime(state.averageTimePerPlay)}</h1>`;
    addCellToRow(row, 'Expand Useage Data', 1, true, playerDataContent);    

    return state;
}
function populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, 
    daysSinceCreation, expiryDateString, daysToExpire, createdBy, createdFor){
        
    addCellToRow(row, email, false);
    addCellToRow(row, createdDate.toDateString(), false);
    addCellToRow(row, lastLoginDate.toDateString(), false);
    addCellToRow(row, daysSinceLastLogin, false);
    addCellToRow(row, daysSinceCreation, false);
    addCellToRow(row, expiryDateString, false);
    addCellToRow(row, daysToExpire, false);
    addCellToRow(row, createdBy, false);
    addCellToRow(row, createdFor, false);
}
function calcDaysSinceLastLogin(lastLoginDate){
    let today = new Date();
    let diffTimeLastLogin = Math.abs(today - lastLoginDate);
    let daysSinceLastLogin = Math.ceil(diffTimeLastLogin / (1000 * 60 * 60 * 24));
    return daysSinceLastLogin;
}
function calcDaysSinceCreation(createdDate){
    let today = new Date();
    let diffTime = Math.abs(today - createdDate);
    let daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysSinceCreation;
}
function calcDaysToExpiry(accountExpiryDate){
    let today = new Date();
    let daysToExpire;
    if (accountExpiryDate instanceof Date && !isNaN(accountExpiryDate)) {
        let diffTime2 = Math.abs(today - accountExpiryDate);
        daysToExpire = Math.ceil(diffTime2 / (1000 * 60 * 60 * 24));
    } else {
        daysToExpire = "N/A";
        accountExpiryDate = "N/A";
    }
    return daysToExpire;
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
function populateLoginData(userData){
    let lastLoginAndr = userData.LastLoginDateAndroid !== undefined ? userData.LastLoginDateAndroid.Value : undefined;
    let lastLoginIOS = userData.LastLoginDateiOS !== undefined ? userData.LastLoginDateiOS.Value : undefined;
    let lastLoginWeb = userData.LastLoginDateWeb !== undefined ? userData.LastLoginDateWeb.Value : undefined;
    return {lastLoginAndr,lastLoginIOS,lastLoginWeb};    
}

function writeDataForReport(pID, pEmail, pCreatedDate,
                            pLastLoginDate, pDaysSinceLastLogin, pDaysSinceCreation,
                            pAccountExpiryDate, pDaysToExpire, pCreatedBy, pCreatedFor,
                            pActivityDataForReport, pTotalPlays, pTotalPlayTime, pAveragePlayTimePerPlay, pLoginData){
    
    let playerDataForReport = { // (per user)
        userPlayFabId: pID, // hide from exported report
        email:pEmail,
        createdDate: pCreatedDate.toDateString(),
        lastLoginDate: pLastLoginDate.toDateString(),
        daysSinceLastLogin: pDaysSinceLastLogin,
        daysSinceCreation: pDaysSinceCreation,
        accountExpiryDate: pAccountExpiryDate,
        daysToExpire: pDaysToExpire, 
        createdBy: pCreatedBy, // hide from exported report
        createdFor: pCreatedFor, // hide from exported report
        activityData: pActivityDataForReport, // hide from exported report
        activityDataFormatted: formatActivityData(pActivityDataForReport),
        totalPlays: pTotalPlays,
        totalPlayTime: pTotalPlayTime,
        averageTimePerPlay: pAveragePlayTimePerPlay,
        loginData: pLoginData
    };
    reportData.push(playerDataForReport);

    // slightly different data for export (not all report data needs to be exported)
    let userExportData = {
        email:pEmail,
        createdDate: pCreatedDate.toDateString(),
        lastLoginDate: pLastLoginDate.toDateString(),
        daysSinceLastLogin: pDaysSinceLastLogin,
        daysSinceCreation: pDaysSinceCreation,
        accountExpiryDate: pAccountExpiryDate,
        daysToExpire: pDaysToExpire, 
        activityDataFormatted: formatActivityData(pActivityDataForReport),
        totalPlays: pTotalPlays,
        totalPlayTime: pTotalPlayTime,
        averageTimePerPlay: pAveragePlayTimePerPlay,
        loginData: pLoginData
    }                    
    exportData.push(userExportData);
}

// GET PLAYERS IN SEGMENT BUTTON CLICKED
async function getSegmentPlayersButtonClicked() {
    resetButtonTexts();

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
    document.getElementById('totalPlayersReport').innerHTML = 'Total users in email list: ' + playerEmailAddrList.length;

    // Update the page with the player IDs and email addresses
    updateIDList(playerIdList);
    if(document.getElementById("emailList")){ document.getElementById("emailList").value = playerEmailAddrList.join('\n') }
}

// UPDATE ID LIST
function updateIDList(playerIdList){
    document.getElementById("playerIDList").value = "";
    if(document.getElementById("playerIDList")){ document.getElementById("playerIDList").value = playerIdList.join('\n') }
}

// GET CONTACT EMAIL (from ContactEmailAddresses (playfab field))
function checkForContactEmailAddr(input, suffix){
    let emailAddr;
    if(input.ContactEmailAddresses !== undefined && input.ContactEmailAddresses.length > 0){
        input.ContactEmailAddresses.forEach(contactEmail =>{
            if(contactEmail.EmailAddress.includes(suffix)){
                emailAddr = contactEmail.EmailAddress;
            }
        })
    }
    return emailAddr;
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
        lastLoginAndroid: dataToExport.loginData.lastLoginAndr,
        lastLoginIOS: dataToExport.loginData.lastLoginIOS,
        lastLoginWeb: dataToExport.loginData.lastLoginWeb,
        totalPlays: dataToExport.totalPlays,
        totalPlayTime: formatTimeToHHMMSS(dataToExport.totalPlayTime),
        averageTimePerPlay: formatTimeToHHMMSS(dataToExport.averageTimePerPlay)
    };
    return isFirstActivity ? { ...userRow, ...activity } : activity;
}
function exportToExcel() {
    let workbook = XLSX.utils.book_new();

    // add any relevant insights data
    let totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(exportData);
    let playersWithMostPlayTime = findPlayersWithMostPlayTime(exportData, 1, 3);
    let playersWithMostPlays = findPlayersWithMostPlays(exportData, 1, 3);
    let playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayed(reportData, 1, 3);
    let mostPlayedActivities = findMostPlayedActivities(exportData, 1, 10);
    let userAccessPerPlatform = getUserAccessPerPlatform(exportData);

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
    insightsExportData.push({insight: 'User Access Android', value: userAccessPerPlatform.totalAndroid});
    insightsExportData.push({insight: 'User Access iOS', value: userAccessPerPlatform.totalIOS});
    insightsExportData.push({insight: 'User Access Web', value: userAccessPerPlatform.totalWeb});

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

// RESET BUTTONS
function resetButtonTexts(){
    document.getElementById('generateReportButton').value = "Generate Report By Email List";
    document.getElementById('generateReportByIdButton').value = "Generate Report By Ids";
    document.getElementById('generateReportBySuffixButton').value = "Generate Report By Suffix";
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