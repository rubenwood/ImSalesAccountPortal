import { canAccess } from './access-check.js';
import { closePlayerDataModal, formatSessionsForExport } from './user-report-formatting.js';
import { Login, RegisterUserEmailAddress, UpdateUserDataServer, getPlayerEmailAddr } from './PlayFabManager.js';
import { showInsightsModal, closeInsightsModal, getTotalPlayTime, 
    findPlayersWithMostPlayTime, findPlayersWithMostPlays, findPlayersWithMostUniqueActivitiesPlayed,
     findMostPlayedActivities, getUserAccessPerPlatform, getTotalLogins, getTotalLoginsPerMonth } from './insights.js';
import { formatTimeToHHMMSS, formatActivityData, generatePass, fetchS3JSONFile } from './utils.js';
import { playerProfiles, getSegmentsClicked, getPlayersInSegmentClicked } from './segments.js';
import { fetchPlayersBySuffixList } from './suffix-front.js';
import { fetchTopicReportByTitle } from './topics-front.js';
import { populateForm, sortAndCombineData, fetchAllUsersByArea } from './academic-area.js';
import { fetchUsersByID, fetchUsersByEmail } from './db/db-front.js';
//import { fetchUsersByClickIDList } from './click-id-front.js';
import { getLessonStats } from './lesson-insights.js';
import { getSimStats } from './sim-insights.js';
import { initializeDarkMode } from './themes/dark-mode.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from './immersifyapi/immersify-api.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }
let emailBlacklist;

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');

    document.getElementById('loginButton').addEventListener('click', Login);

    // setup segment section toggle
    document.getElementById('segment-toggle-btn').addEventListener('click', toggleSegmentSection)
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
    document.getElementById('generateReportByTopicButton').addEventListener('click', generateReportByTopicDB);
    document.getElementById('generateReportByAreaButton').addEventListener('click', fetchAllUsersByArea);
    //document.getElementById('generateReportByClickIDButton').addEventListener('click', fetchUsersByClickIDList);
    
    document.getElementById('exportReportButton').addEventListener('click', exportToExcel);
    document.getElementById('closePlayerDataModal').addEventListener('click', closePlayerDataModal);    
    // insights modal
    document.getElementById('insightsButton').addEventListener('click', ()=>showInsightsModal(reportData));
    document.getElementById('closeInsightsButton').addEventListener('click', closeInsightsModal);

    // wait for login
    await waitForJWT();
    emailBlacklist = await fetchS3JSONFile("Analytics/EmailBlackList.json");
    //console.log(emailBlacklist);
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('playerIDList').style.display = 'none';
    document.getElementById('segments-section').style.display = 'none';
};

// TOGGLE SEGMENT SECTION
function toggleSegmentSection(){
    const segmentSection = document.getElementById('segments-section');
    if(segmentSection.style.display == 'block'){
        segmentSection.style.display = 'none';
    }else{
        segmentSection.style.display = 'block';
    }
}
// GET LAST DATABASE UPDATE DATE
async function getDatabaseLastUpdated() {
    try {
        // Fetch the file from the backend route
        const response = await fetch('/database-last-updated');
        
        if (!response.ok) {
            throw new Error(`Failed to retrieve the update date. Status: ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        const lastUpdateDate = jsonResponse.LastUpdatedDate;
        
        document.getElementById('dbLastUpdated').innerHTML = `Database last updated on: ${lastUpdateDate}`;
    } catch (error) {
        console.error(error.message);
    }
}
getDatabaseLastUpdated();

// GENERATE REPORT
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

// Generates a report by topic name (Database)
export async function generateReportByTopicDB() {
    const hasAccess = await canAccess();
    if (!hasAccess) { return; }

    document.getElementById('generateReportByTopicButton').value = `Generating Report By Topic...`;  

    const inputTopics = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if (inputTopics.length < 1) { return; }
    console.log(`Generating report by topic for: ${inputTopics}`);

    // Search the analytics database for users how have the topic (external) title
    const output = await fetchTopicReportByTitle(inputTopics);
    const playFabIdsFromDBSearch = output.map(entry => entry.PlayFabId);

    // Search by assigned topics
    const searchByAssignTopicResult = await searchByAssignedTopic(inputTopics);    
    const outputPlayFabIds = [...playFabIdsFromDBSearch, ...searchByAssignTopicResult.playfabIds];
    // ensure unique ids (filter out duplicates)
    const uniqueIds = [...new Set(outputPlayFabIds)];
    // join it all together (as a string seperated by new lines)
    const playFabIdsJoined = uniqueIds.join('\n');
    // Set this to the id list (1 PlayFabId per line)
    document.getElementById("playerIDList").value = playFabIdsJoined;
    generateReportByIdDB();
}
async function searchByAssignedTopic(inputTopics) {
    const topicIds = await imAPIGet("topics");
    const topicBrondons = await getTopicBrondons(topicIds);
    // Find matching entries based on externalTitle
    const matchingEntries = topicBrondons.filter(entry =>
        inputTopics.some(topic => topic.trim().toLowerCase() === entry.brondon?.externalTitle.trim().toLowerCase())
    );
    console.log("Matching Entries:", matchingEntries);

    // currently, can only search for 1 topic at a time
    // currently, only works for assigned / floating topics
    // TODO: modify this so we can search for multiple topics
    // Extract playFabIds from the matching entries (assuming each topic has associated playFabIds)
    const playFabIdsAssigned = await imAPIGet(`structure/${matchingEntries[0].topicId}/assigned/playFabUser`);
    return playFabIdsAssigned;
}


// Generate report by ID (Database)
export async function generateReportByIdDB() {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

    //resetButtonTexts();
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

// Write data for report to reportData and exportData objects
export async function writeDataForReport(pID, pEmail, pCreatedDate,
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
        linkedAccounts: pLinkedAccounts,
        activityData: pActivityDataForReport,        
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
        activityData: pActivityDataForReport,
        activityDataFormatted: formatActivityData(pActivityDataForReport),
        totalPlays: pTotalPlays,
        totalPlayTime: pTotalPlayTime,
        averageTimePerPlay: pAveragePlayTimePerPlay,
        loginData: pLoginData
    }
    
    // remove certain emails from the report data
    let blacklistedEmails = emailBlacklist.blacklistedEmails;
    if(!blacklistedEmails.includes(userExportData.email)){
        exportData.push(userExportData);
    }
}

// EXPORT REPORT
let exportData;
function createLoginRow(dataToExport) {
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
        averageTimePerPlay: formatTimeToHHMMSS(dataToExport.averageTimePerPlay),
        // new login data
        //totalLogins: dataToExport.loginData.totalLogins,
    };

    // add logins per month
    // dataToExport.loginData.loginsPerMonth.forEach(entry => {
    //     userRow[`${entry.month}Logins`] = entry.logins;
    // });
    // session data
    //userRow['sessionData'] = formatSessionsForExport(dataToExport.loginData.sessionsString);

    return userRow;
}
function createUsageRow(dataToExport, activity, isFirstActivity){
    let userRow = {
        email: dataToExport.email,
    };
    return isFirstActivity ? { ...userRow, ...activity } : activity;
}
function exportToExcel() {
    // add any relevant insights data
    const totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(exportData);
    const totalLogins = getTotalLogins(exportData);
    const totalLoginsPerMonth = getTotalLoginsPerMonth(exportData);
    const playersWithMostPlayTime = findPlayersWithMostPlayTime(exportData, 1, 3);
    const playersWithMostPlays = findPlayersWithMostPlays(exportData, 1, 3);
    const playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayed(reportData, 1, 3);
    const mostPlayedActivities = findMostPlayedActivities(exportData, 1, 10);
    //const userAccessPerPlatform = getUserAccessPerPlatform(exportData);

    let insightsExportData = [
        { insight: 'Total Users In Report', value1: exportData.length },
        { insight: 'Total Logins', value1: totalLogins },
        
        { insight: 'Total Play Time Across All Users', value1: formatTimeToHHMMSS(totalPlayTimeAcrossAllUsersSeconds) }
    ];
    playersWithMostPlayTime.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Play Time', value1: player.email, value2: formatTimeToHHMMSS(player.totalPlayTime) });
    });
    playersWithMostPlays.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Total Plays', value1: player.email, value2: player.totalPlays });
    });
    playersWithMostUniqueActivities.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Unique Activities', value1: player.email, value2: player.uniqueActivitiesCount });
    });
    mostPlayedActivities.forEach(activity => {
        insightsExportData.push({ insight: 'Most Played Activities', value1: activity.activityTitle, value2: activity.playCount });
    });
    //insightsExportData.push({insight: 'User Access Android', value: userAccessPerPlatform.totalAndroid});
    //insightsExportData.push({insight: 'User Access iOS', value: userAccessPerPlatform.totalIOS});
    //insightsExportData.push({insight: 'User Access Web', value: userAccessPerPlatform.totalWeb});

    // Login insights
    let loginInsightsData = [
        {
            insight: '',
            value1: 'Jan', value2: 'Feb', value3: 'Mar', value4: 'Apr', value5: 'May', value6: 'Jun',
            value7: 'Jul', value8: 'Aug', value9: 'Sep', value10: 'Oct', value11: 'Nov', value12: 'Dec',
        }
    ];
    console.log(totalLoginsPerMonth);
    let currentYear = null;
    let loginDataRow = null;
    totalLoginsPerMonth.forEach((monthData, index) => {
        if (monthData.year !== currentYear) {
            if (loginDataRow) {
                loginInsightsData.push(loginDataRow);
            }
            // Create a new row for the new year
            loginDataRow = { insight: `Total Logins Per Month (${monthData.year})` };
            currentYear = monthData.year;
        }

        // Assign the login data to the appropriate value property
        loginDataRow[`value${(index % 12) + 1}`] = monthData.logins;
    });
    loginInsightsData.push(loginDataRow);

    // Lesson insights
    const lessonStats = getLessonStats(reportData);
    let lessonInsightsData = [
        { insight: 'Total Lesson Play Time', value1: formatTimeToHHMMSS(lessonStats.totalLessonPlayTime) },
        { insight: 'Total Lessons Attempted', value1: lessonStats.totalLessonsAttempted },
        { insight: 'Total Lesson Plays', value1: lessonStats.totalLessonPlays }
    ];
    lessonStats.mostPlayedLessons.forEach(lesson => {
        lessonInsightsData.push({ insight: 'Most Played Lessons', value1: lesson.activityTitle, value2: lesson.playCount });
    });
    lessonStats.highestPlayTimeLessons.forEach(lesson => {
        lessonInsightsData.push({ insight: 'Most Played Lessons (Play Time)', value1: lesson.activityTitle, value2: formatTimeToHHMMSS(lesson.totalTime) });
    });
    // Sim insights
    const simStats = getSimStats(reportData);
    let simInsightsData = [
        { insight: 'Total Simulation Play Time', value1: formatTimeToHHMMSS(simStats.totalSimPlayTime) },
        { insight: 'Total Simulations Attempted', value1: simStats.totalSimsAttempted },
        { insight: 'Total Simulations Plays', value1: simStats.totalSimPlays }        
    ];
    simStats.mostPlayedSims.forEach(sim => {
       simInsightsData.push({ insight: 'Most Played Simulations', value1: sim.activityTitle, value2: sim.playCount });
    });
    simStats.highestPlayTimeSims.forEach(sim => {
        simInsightsData.push({ insight: 'Most Played Simulations (Play Time)', value1: sim.activityTitle, value2: formatTimeToHHMMSS(sim.totalTime) });
    });
    
    // Combine insights data with empty rows between sections
    let combinedInsightsData = [
        ...insightsExportData,
        {}, // empty row
        ...loginInsightsData,
        {},
        { insight: 'Lesson Insights', value1: '' },
        ...lessonInsightsData,
        {},
        { insight: 'Simulation Insights', value1: '' },
        ...simInsightsData
    ];

    // add user data
    let loginData = [];
    let usageData = [];
    
    exportData.forEach(dataToExport => {
        loginData.push(createLoginRow(dataToExport));

        if(dataToExport.activityDataFormatted == undefined || dataToExport.activityDataFormatted.length <= 0){
            usageData.push(createUsageRow(dataToExport, {}, true));
            usageData.push({});
            return;
        }
        let isFirstActivity = true;
        dataToExport.activityDataFormatted.forEach(activity => {
            let activityRow = {
                activityTitle: activity.activityTitle,
                playDate: activity.playDate,
                score: Math.round(activity.score * 100) + '%',
                sessionTime: formatTimeToHHMMSS(Math.abs(activity.sessionTime))
            };
            usageData.push(createUsageRow(dataToExport, activityRow, isFirstActivity));
            isFirstActivity = false;
        });        
        usageData.push({});        
    });
    
    // Progress report
    let progressData = [];
    exportData.forEach(dataToExport => {
        let emailRow = { email:dataToExport.email };
        progressData.push(emailRow);
        dataToExport.activityData.forEach(activity =>{
            let dataRow = {
                topic:activity.topicTitle,
                activity: activity.activityTitle,
                activityType:activity.activityType,
                bestScore:getBestScore(activity),
                totalTime:getTotalSessionTime(activity)
            };
            // Add attempt columns dynamically
            activity.plays.forEach((play, index) => {
                dataRow[`Attempt ${index + 1}`] = Math.round(play.normalisedScore * 100) + '%';
            });
            progressData.push(dataRow);
        });        
        progressData.push({});
    });

    // Low Prio: Topic progress - user, topic %

    const workbook = XLSX.utils.book_new();
    const insightsWorksheet = XLSX.utils.json_to_sheet(combinedInsightsData);
    const progressWorksheet = XLSX.utils.json_to_sheet(progressData);
    const usageWorksheet = XLSX.utils.json_to_sheet(usageData);
    const loginDataWorksheet = XLSX.utils.json_to_sheet(loginData);

    removeSpecificHeaders(insightsWorksheet, ["value3","value4","value5","value6","value7","value8","value9","value10","value11","value12"]);
    
    const insightsMessages = [
        'Welcome to the Immersify Usage and Progress Report. Each tab contains data, analytics and insights.',
        'This page shows some general insights, lesson specific insights and simulation specific insights.',
        ''
    ];
    const progressMessages = [
        'This page shows every user, the activities they have engaged with,',
        'how long in total they have spent in the activity and the score for each attempt.',
        ''
    ];
    const usageMessages = [
        'This page is similar to the previous page.',
        'However, it presents the date each attempt was made and the duration of each attempt.',
        ''
    ];
    const loginMessages = [
        'This page contains some general analytics about each account,',
        'when was the account created, last logged in, and how active they have been.',
        ''
    ];    
    addMessages(insightsWorksheet, insightsMessages);
    addMessages(progressWorksheet, progressMessages);
    addMessages(usageWorksheet, usageMessages);
    addMessages(loginDataWorksheet, loginMessages);

    XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");
    XLSX.utils.book_append_sheet(workbook, progressWorksheet, "Progress Report");
    XLSX.utils.book_append_sheet(workbook, usageWorksheet, "Usage Report");
    XLSX.utils.book_append_sheet(workbook, loginDataWorksheet, "Login Report");
    XLSX.writeFile(workbook, "Report.xlsx");
}
function getBestScore(activity){
    let highestScore = 0;
    activity.plays.forEach(play => {
        if(play.normalisedScore > highestScore){
            highestScore = play.normalisedScore;
        }
    });
    return Math.round(highestScore * 100) + '%';    
}
function getTotalSessionTime(activity){
    let totalTime = 0;
    activity.plays.forEach(play => {
        totalTime += play.sessionTime;
    });
    return formatTimeToHHMMSS(totalTime);  
}
function addMessages(worksheet, messages) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const newRange = XLSX.utils.encode_range({ s: { c: range.s.c, r: 0 }, e: { c: range.e.c, r: range.e.r + messages.length } });

    // Shift all rows down by the number of messages
    for (let R = range.e.r; R >= range.s.r; --R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R + messages.length, c: C });
            const prevCellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (worksheet[prevCellRef]) {
                worksheet[cellRef] = worksheet[prevCellRef];
            } else {
                delete worksheet[cellRef];
            }
        }
    }

    // Insert the messages
    messages.forEach((message, index) => {
        const messageCellRef = XLSX.utils.encode_cell({ r: index, c: 0 });
        worksheet[messageCellRef] = { t: 's', v: message };
        // Clear the rest of the cells in the message row
        for (let C = range.s.c + 1; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: index, c: C });
            delete worksheet[cellRef];
        }
    });

    worksheet['!ref'] = newRange;
}
function removeSpecificHeaders(worksheet, columnsToRemove) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    columnsToRemove.forEach(column => {
        // Check if it's a column name (like 'Jan') or a specific cell (like 'A1')
        if (typeof column === 'string') {
            // If it's a specific cell like 'A1', remove that
            if (column.match(/^[A-Z]+\d+$/)) {
                if (worksheet[column]) {
                    delete worksheet[column];  // Delete specific cell content
                }
            } else {
                // If it's a column header (e.g., 'Jan', 'Feb'), find the corresponding cell in the first row
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });  // First row (r = 0)
                    if (worksheet[cellAddress] && worksheet[cellAddress].v === column) {
                        delete worksheet[cellAddress];  // Delete the header content
                    }
                }
            }
        }
    });
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

    const generateReportByTopicButton= document.getElementById('generateReportByTopicButton');
    generateReportByTopicButton ? generateReportByTopicButton.value = `Generate Report By Topic` : null;  
}
// UPDATE ID LIST
export function updateIDList(playerIdList){
    document.getElementById("playerIDList").value = "";
    if(document.getElementById("playerIDList")){ document.getElementById("playerIDList").value = playerIdList.join('\n') }
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