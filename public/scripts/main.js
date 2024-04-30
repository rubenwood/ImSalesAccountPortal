import { canAccess } from './access-check.js';
import { populateAccDataRow, populateUsageData, populateLoginData, calcDaysSinceLastLogin, calcDaysSinceCreation, calcDaysToExpiry, checkForContactEmailAddrSuffix, closePlayerDataModal } from './user-report-formatting.js';
import { Login, RegisterUserEmailAddress, UpdateUserDataServer, getPlayerEmailAddr } from './PlayFabManager.js';
import { showInsightsModal, closeInsightsModal, getTotalPlayTime, findPlayersWithMostPlayTime, findPlayersWithMostPlays, findPlayersWithMostUniqueActivitiesPlayed, findMostPlayedActivities, getUserAccessPerPlatform } from './insights.js';
import { fetchUserData, fetchUserAccInfoById, fetchUserAccInfoByEmail, formatTimeToHHMMSS, formatActivityData, getAcademicAreas } from './utils.js';
import { playerProfiles, getSegmentsClicked, getPlayersInSegmentClicked } from './segments.js';
import { fetchPlayersBySuffixList } from './suffix-front.js';
import { populateForm, sortAndCombineData, fetchAllUsersByArea } from './academic-area.js';
import { fetchUsersByID, fetchUsersByEmail } from './db/db-front.js';
import { fetchUsersByClickIDList } from './click-id-front.js';

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
    //document.getElementById('generateReportButton').addEventListener('click', generateReportByEmail);
    document.getElementById('generateReportButton').addEventListener('click', generateReportByEmailDB);
    //document.getElementById('generateReportByIdButton').addEventListener('click', generateReportById);
    document.getElementById('generateReportByIdButton').addEventListener('click', generateReportByIdDB);
    //document.getElementById('generateReportBySuffixButton').addEventListener('click', generateReportBySuffix);
    document.getElementById('generateReportBySuffixButton').addEventListener('click', generateReportBySuffixDB);
    document.getElementById('generateReportByAreaButton').addEventListener('click', fetchAllUsersByArea);
    document.getElementById('generateReportByClickIDButton').addEventListener('click', ()=>fetchUsersByClickIDList(1));
    
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

// Generate report by email suffix (Database)
export async function generateReportBySuffix() {
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    let suffixes = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if(suffixes.length < 1){ return; }

    resetButtonTexts();
    document.getElementById('generateReportBySuffixButton').value = "Generating Report By Email Suffix...";

    // fetch from database
    let output = await fetchPlayersBySuffixList(suffixes.toString());
    //console.log(output);
    
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';
    
    resetExportData();

    let playerIDList = [];
    let index = 0;
    // SHOULD BE ABLE TO REMOVE ALL THIS SHIT
    for(const element of output.matchedUsers){
        let email = "no email";
        // can replace this with: getUserEmailFromAccData
        if(element.LinkedAccounts !== undefined && element.LinkedAccounts.length > 0){
            let gotAcc = false;
            element.LinkedAccounts.forEach(linkedAcc =>{
                if(linkedAcc.Platform == "PlayFab"){
                    suffixes.forEach(suffix => {
                        if(linkedAcc.Email.includes(suffix)){
                            email = linkedAcc.Email;
                            gotAcc = true;
                        }
                    });
                }else{
                    if(!gotAcc){
                        let contactEmail = checkForContactEmailAddrSuffix(element, suffixes);
                        email = contactEmail == undefined ? "no email" : contactEmail;
                    }
                }
            })
        }else{ // if there are no linked accounts, just get the contact email   
            let contactEmail = checkForContactEmailAddrSuffix(element, suffixes);
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
            // TODO: fetch data from DB
            let userData = await fetchUserData(element.PlayerId);
            playerIDList.push(element.PlayerId);

            // FIX DUPLICATE CODE
            let accountExpiryDate = userData.data.Data.TestAccountExpiryDate !== undefined ? new Date(userData.data.Data.TestAccountExpiryDate.Value) : undefined;
            let accountExpiryDateString = accountExpiryDate !== undefined ? accountExpiryDate.toDateString() : "N/A";
            let daysToExpire = calcDaysToExpiry(accountExpiryDate);

            let createdBy = userData.data.Data.CreatedBy !== undefined ? userData.data.Data.CreatedBy.Value : "";
            let createdFor = userData.data.Data.CreatedFor !== undefined ? userData.data.Data.CreatedFor.Value : "";

            let linkedAccounts = element.LinkedAccounts ? element.LinkedAccounts.map(acc => acc.Platform).join(", ") : "N/A";

            // Account Data
            populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, 
                accountExpiryDateString, "", "", "", linkedAccounts);
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
            let newDataState = populateUsageData(playerData, loginData, playerDataState, row);
            let averageTimePerPlay = newDataState.averageTimePerPlay;
            let totalPlays = newDataState.totalPlays;
            let totalPlayTime = newDataState.totalPlayTime;
            let activityDataForReport = newDataState.activityDataForReport;

            writeDataForReport(element.PlayerId, email, createdDate, lastLoginDate, daysSinceLastLogin,
                daysSinceCreation, accountExpiryDateString, daysToExpire, createdBy, createdFor, linkedAccounts, activityDataForReport,
                totalPlays, totalPlayTime, averageTimePerPlay, loginData);      
        } catch(error) {
            let errorStr = `Error fetching data for user: ${error.message}`;
            console.error(errorStr);
            while (row.firstChild) { row.removeChild(row.firstChild); } // clear out any cells that may have been added
            row.style.backgroundColor = '#ff8c8cab'; // Highlight the cell in red
            // re-add the rows, but with the error string
            populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, errorStr, 
                "", "", "", "");
        }

        index++;        
        document.getElementById('generateReportBySuffixButton').value = `Generating Report By Email Suffix... ${index}/${output.matchedUsers.length}`;
        document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + output.matchedUsers.length;
        updateIDList(playerIDList);
    };
    
    // confetti & confirmation of completion
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}
export async function generateReportBySuffixDB(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    let suffixes = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if(suffixes.length < 1){ return; }

    resetButtonTexts();
    document.getElementById('generateReportBySuffixButton').value = "Generating Report By Email Suffix...";
    
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';
    
    resetExportData();

    let playerIDList = [];
    const fetchPromises = [];
   
    let totalPages = 1;        
    for (let page = 1; page <= totalPages; page++) {
        fetchPromises.push(fetchPlayersBySuffixList(suffixes.toString(), page));
    }
    const results = await Promise.all(fetchPromises);
    // update the player ID field 
    results.forEach(element => {
        element.accountData.forEach(acc => {
            playerIDList.push(acc.PlayFabId);
        })            
    })
    updateIDList(playerIDList);

    let sortedData = sortAndCombineData(results); 
    document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + sortedData.length;
    await populateForm(sortedData);

    Promise.allSettled(fetchPromises).then(results => {
        resetButtonTexts();
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
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

    resetExportData();

    // Create an array of promises for fetching user data
    const fetchPromises = playerIDList.map(async (playerID, index) => {
        try {
            await delay(index * 700); // Delay (remove once we get from DB)
            // TODO: fetch data from DB
            let userAccInfo = await fetchUserAccInfoById(playerID);
            // TODO: fetch data from DB
            let userData = await fetchUserData(userAccInfo.data.UserInfo.PlayFabId);
            await handleData(userData, userAccInfo, tableBody);
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
// Generate report by ID (Database)
export async function generateReportByIdDB() {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

    resetButtonTexts();
    document.getElementById('generateReportByIdButton').value = `Generating Report By Ids...`;  

    const playerIDText = document.getElementById("playerIDList").value;
    const playerIDList = playerIDText.split('\n').filter(Boolean);
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';

    resetExportData();

    const fetchPromises = [];
    
    try {
        let totalPages = 1;        
        for (let page = 1; page <= totalPages; page++) {
            fetchPromises.push(fetchUsersByID(playerIDList, page));
        }
        const results = await Promise.all(fetchPromises);
        // sorts and combines the accountData and usageData from the results
        let sortedData = sortAndCombineData(results); 
        document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + sortedData.length;
        await populateForm(sortedData);
    } catch (error) {
        console.error('Error:', error);
        const row = tableBody.insertRow();
        row.insertCell().textContent = 'Error fetching data';
        row.insertCell().textContent = error.message;
        row.insertCell().colSpan = 4; // assuming 4 columns for simplicity
        row.style.color = 'white';
        row.style.fontWeight = 'bold';
        row.style.backgroundColor = '#700000';
        row.style.textAlign = 'center';
    }

    Promise.allSettled(fetchPromises).then(results => {
        resetButtonTexts();
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

    resetExportData();

    const fetchPromises = emailList.map(async (email, index) => {
        try {
            await delay(index * 700);
            // TODO: Get data from db
            let userAccInfo = await fetchUserAccInfoByEmail(email);
            if(userAccInfo.error){ throw new Error(userAccInfo.message);}  
            playerIDList.push(userAccInfo.data.UserInfo.PlayFabId);
            // TODO: Get data from db
            let userData = await fetchUserData(userAccInfo.data.UserInfo.PlayFabId);
            //console.log(userData);
            //console.log(userAccInfo);
            await handleData(userData, userAccInfo, tableBody);
        } catch (error) {
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
        document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + fetchPromises.length;
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
// Generate report by email list (Database)
export async function generateReportByEmailDB() {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

    resetButtonTexts();
    document.getElementById('generateReportButton').value = `Generating Report By Email List...`;  

    let playerIDList = [];// clear this, we will repopulate later...
    const emailListText = document.getElementById("emailList").value;
    const emailList = emailListText.split('\n').filter(Boolean); // Split by newline and filter out empty strings
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';

    resetExportData();

    const fetchPromises = [];

    try {
        let count = 0;
        let totalPages = 1;        
        for (let page = 1; page <= totalPages; page++) {
            fetchPromises.push(fetchUsersByEmail(emailList, page));
            count++;
        }     

        const results = await Promise.all(fetchPromises);        
        // update the player ID field 
        results.forEach(element => {
            element.accountData.forEach(acc => {
                playerIDList.push(acc.PlayFabId);
            })            
        })
        updateIDList(playerIDList);

        let sortedData = sortAndCombineData(results);
        document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + sortedData.length;        
        await populateForm(sortedData);
        //await populateForm(output);
    } catch (error) {
        console.error('Error:', error);
        const row = tableBody.insertRow();
        row.insertCell().textContent = 'Error fetching data';
        row.insertCell().textContent = error.message;
        row.insertCell().colSpan = 4; // assuming 4 columns for simplicity
        row.style.color = 'white';
        row.style.fontWeight = 'bold';
        row.style.backgroundColor = '#700000';
        row.style.textAlign = 'center';
    }

    Promise.allSettled(fetchPromises).then(results => {
        resetButtonTexts();
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
        accountExpiryDateString, daysToExpire, createdBy, createdFor, "");
    
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
    let newDataState = populateUsageData(playerData, loginData, playerDataState, row);
    let averageTimePerPlay = newDataState.averageTimePerPlay;
    let totalPlays = newDataState.totalPlays;
    let totalPlayTime = newDataState.totalPlayTime;
    let activityDataForReport = newDataState.activityDataForReport;

    // add to stored data
    writeDataForReport(userAccInfo.data.UserInfo.PlayFabId, email, createdDate, lastLoginDate,
        daysSinceLastLogin,daysSinceCreation,accountExpiryDateString,daysToExpire,createdBy,
        createdFor, "", activityDataForReport,totalPlays,totalPlayTime,averageTimePerPlay, loginData);
    
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

// Clears exportData, required when producing a new report
export function resetExportData(){
    reportData = [];
    exportData = [];
}

export function writeDataForReport(pID, pEmail, pCreatedDate,
                            pLastLoginDate, pDaysSinceLastLogin, pDaysSinceCreation,
                            pAccountExpiryDate, pDaysToExpire, pCreatedBy, pCreatedFor, pLinkedAccounts,
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
        activityData: pActivityDataForReport,
        linkedAccounts: pLinkedAccounts,
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
        linkedAccounts: pLinkedAccounts,
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
    document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + playerEmailAddrList.length;

    // Update the page with the player IDs and email addresses
    updateIDList(playerIdList);
    if(document.getElementById("emailList")){ document.getElementById("emailList").value = playerEmailAddrList.join('\n') }
}

// UPDATE ID LIST
export function updateIDList(playerIdList){
    document.getElementById("playerIDList").value = "";
    if(document.getElementById("playerIDList")){ document.getElementById("playerIDList").value = playerIdList.join('\n') }
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
        linkedAccounts: dataToExport.linkedAccounts,
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
        if (dataToExport.activityDataFormatted != undefined && dataToExport.activityDataFormatted.length > 0){
            let isFirstActivity = true;
            dataToExport.activityDataFormatted.forEach(activity => {
                let activityRow = {
                    activityID: activity.activityID,
                    activityTitle: activity.activityTitle,
                    playDate: activity.playDate,
                    score: Math.round(activity.score * 100) + '%',
                    sessionTime: formatTimeToHHMMSS(Math.abs(activity.sessionTime))
                };
                userData.push(createUserRow(dataToExport, activityRow, isFirstActivity));
                isFirstActivity = false;
            });
        }else{
            userData.push(createUserRow(dataToExport, {}, true));
        }
        userData.push({}); // Add an empty row to divide user data chunks
    });

    let workbook = XLSX.utils.book_new();
    let insightsWorksheet = XLSX.utils.json_to_sheet(insightsExportData);
    let userDataWorksheet = XLSX.utils.json_to_sheet(userData);
    XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");
    XLSX.utils.book_append_sheet(workbook, userDataWorksheet, "Report");
    XLSX.writeFile(workbook, "Report.xlsx");
}

// RESET BUTTONS
export function resetButtonTexts() {
    const generateReportButton = document.getElementById('generateReportButton');
    generateReportButton ? generateReportButton.value = "Generate Report By Email List" : null;

    const generateReportByIdButton = document.getElementById('generateReportByIdButton');
    generateReportByIdButton ? generateReportByIdButton.value = "Generate Report By Ids" : null;

    const generateReportBySuffixButton = document.getElementById('generateReportBySuffixButton');
    generateReportBySuffixButton ? generateReportBySuffixButton.value = "Generate Report By Suffix" : null;

    const generateReportByAreaButton = document.getElementById('generateReportByAreaButton');
    generateReportByAreaButton ? generateReportByAreaButton.value = "Generate Report By Academic Area" : null;

    const generateReportByClickIDButton = document.getElementById('generateReportByClickIDButton');
    generateReportByClickIDButton ? generateReportByClickIDButton.value = "Generate Report By Click ID" : null;
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