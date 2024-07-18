import { canAccess } from './access-check.js';
import { closePlayerDataModal } from './user-report-formatting.js';
import { Login, RegisterUserEmailAddress, UpdateUserDataServer, getPlayerEmailAddr } from './PlayFabManager.js';
import { showInsightsModal, closeInsightsModal, getTotalPlayTime, findPlayersWithMostPlayTime, findPlayersWithMostPlays, findPlayersWithMostUniqueActivitiesPlayed, findMostPlayedActivities, getUserAccessPerPlatform } from './insights.js';
import { formatTimeToHHMMSS, formatActivityData, getAcademicAreas } from './utils.js';
import { playerProfiles, getSegmentsClicked, getPlayersInSegmentClicked } from './segments.js';
import { fetchPlayersBySuffixList } from './suffix-front.js';
import { populateForm, sortAndCombineData, fetchAllUsersByArea } from './academic-area.js';
import { fetchUsersByID, fetchUsersByEmail } from './db/db-front.js';
import { fetchUsersByClickIDList } from './click-id-front.js';
import { getLessonStats } from './lesson-insights.js';
import { getSimStats } from './sim-insights.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

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
        document.getElementById('totalPlayersSegment').innerHTML = `Total players in segment: ${playerProfiles.length}`;
    });

    // player id text area
    document.getElementById('toggleIdsButton').addEventListener('click', togglePlayerIdsTextArea);

    // reports
    document.getElementById('generateReportButton').addEventListener('click', generateReportByEmailDB);
    document.getElementById('generateReportByIdButton').addEventListener('click', generateReportByIdDB);
    document.getElementById('generateReportBySuffixButton').addEventListener('click', generateReportBySuffixDB);
    document.getElementById('generateReportByAreaButton').addEventListener('click', fetchAllUsersByArea);
    document.getElementById('generateReportByClickIDButton').addEventListener('click', fetchUsersByClickIDList);
    
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


// GET LAST DATABASE UPDATE DATE
function getDatabaseLastUpdated() {
    var xhr = new XMLHttpRequest();    
    xhr.open('GET', '../DatabaseLastUpdated.json', true);
    
    xhr.onreadystatechange = function() {
        // Check if the request is complete (readyState 4) and was successful (status 200)
        if (xhr.readyState === 4 && xhr.status === 200) {
            var jsonResponse = JSON.parse(xhr.responseText);
            var lastUpdateDate = jsonResponse.LastUpdatedDate;
            document.getElementById('dbLastUpdated').innerHTML = `Database last updated on: ${lastUpdateDate}`;
        } else if (xhr.readyState === 4 && xhr.status !== 200) {
            console.error('Failed to retrieve the update date. Status:', xhr.status);
        }
    };
    
    xhr.send();
}
getDatabaseLastUpdated();

// GENERATE REPORT
// Helper function to delay execution
//const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export let reportData = [];

// Generate report by email suffix (Database)
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
        doConfetti();
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
        doConfetti();
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
        doConfetti();
    });
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
    const totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(exportData);
    const playersWithMostPlayTime = findPlayersWithMostPlayTime(exportData, 1, 3);
    const playersWithMostPlays = findPlayersWithMostPlays(exportData, 1, 3);
    const playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayed(reportData, 1, 3);
    const mostPlayedActivities = findMostPlayedActivities(exportData, 1, 10);
    const userAccessPerPlatform = getUserAccessPerPlatform(exportData);

    let insightsExportData = [
        { insight: 'Total Play Time Across All Users', value: formatTimeToHHMMSS(totalPlayTimeAcrossAllUsersSeconds) }
    ];
    playersWithMostPlayTime.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Play Time', value:`${player.email} - ${formatTimeToHHMMSS(player.totalPlayTime)}` });
    });
    playersWithMostPlays.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Plays', value:`${player.email} - ${player.totalPlays}` });
    });
    playersWithMostUniqueActivities.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Unique Activities', value:`${player.email} - ${player.uniqueActivitiesCount}` });
    });
    mostPlayedActivities.forEach(activity => {
        insightsExportData.push({ insight: 'Most Played Activities', value:`${activity.activityTitle} - ${activity.totalPlays}` });
    });
    insightsExportData.push({insight: 'User Access Android', value: userAccessPerPlatform.totalAndroid});
    insightsExportData.push({insight: 'User Access iOS', value: userAccessPerPlatform.totalIOS});
    insightsExportData.push({insight: 'User Access Web', value: userAccessPerPlatform.totalWeb});

    // Lesson insights
    const lessonStats = getLessonStats(reportData);
    console.log(lessonStats);
    let lessonInsightsData = [
        { insight: 'Total Lesson Play Time', value: formatTimeToHHMMSS(lessonStats.totalLessonPlayTime) },
        { insight: 'Total Lessons Attempted', value: lessonStats.totalLessonsAttempted },
        { insight: 'Total Lesson Plays', value: lessonStats.totalLessonPlays }
    ];
    lessonStats.mostPlayedLessons.forEach(lesson => {
        lessonInsightsData.push({ insight: 'Most Played Lessons', value: `${lesson.title} - ${lesson.count}` });
    });
    lessonStats.highestPlayTimeLessons.forEach(lesson => {
        lessonInsightsData.push({ insight: 'Most Played Lessons (Play Time)', value: `${lesson.title} - ${formatTimeToHHMMSS(lesson.totalTime)}` });
    });
    // Sim insights
    const simStats = getSimStats(reportData);
    let simInsightsData = [
        { insight: 'Total Simulation Play Time', value: formatTimeToHHMMSS(simStats.totalSimPlayTime) },
        { insight: 'Total Simulations Attempted', value: simStats.totalSimsAttempted },
        { insight: 'Total Simulations Plays', value: simStats.totalSimsAttempted }        
    ];
    simStats.mostPlayedSims.forEach(sim => {
       simInsightsData.push({ insight: 'Most Played Simulations', value: `${sim.title} - ${sim.count}` });
    });
    simStats.highestPlayTimeSims.forEach(sim => {
        simInsightsData.push({ insight: 'Most Played Simulations (Play Time)', value: `${sim.title} - ${formatTimeToHHMMSS(sim.totalTime)}` });
    });
    
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

    const workbook = XLSX.utils.book_new();
    const insightsWorksheet = XLSX.utils.json_to_sheet(insightsExportData);
    const lessonInsightsWorksheet = XLSX.utils.json_to_sheet(lessonInsightsData);
    const simInsightsWorksheet = XLSX.utils.json_to_sheet(simInsightsData);
    const userDataWorksheet = XLSX.utils.json_to_sheet(userData);
    XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");
    XLSX.utils.book_append_sheet(workbook, lessonInsightsWorksheet, "Lesson Insights");
    XLSX.utils.book_append_sheet(workbook, simInsightsWorksheet, "Sim Insights");
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