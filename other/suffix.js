const AWS = require('aws-sdk');
const express = require('express');
const suffixRouter = express.Router();
const { Pool } = require('pg');
const XLSX = require('xlsx');

const { getS3JSONFile, uploadToS3, anyFileModifiedSince, checkFileLastModified } = require('./s3-utils');
const { listItems, getReportFolders, generatePresignedUrlsForFolder } = require('./s3-utils'); 
const { addMessages, removeSpecificHeaders } = require('./export'); 

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

// Get email blacklist
async function getEmailBlacklist(){
    const emailBlacklist = await getS3JSONFile('Analytics/EmailBlackList.json');
    return emailBlacklist;
}

async function getSuffixList(){
    const suffixList = await getS3JSONFile('TestFiles/EnterpriseData/suffix_list_lite.json');
    return suffixList;
}
suffixRouter.get('/get-suffix-list', async (req, res) => {
    const suffixList = await getSuffixList();
    res.json(suffixList);
});

// Get suffix mappings from S3 (connections_list)
let suffixMappings;
let lastDateGotSuffixMappings;
async function getSuffixMappings() {
    console.log("getting s3 suffix mappings");
    const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: process.env.CONNECTION_LIST_PATH
    };

    try {
        const data = await s3.getObject(params).promise();
        const mappings = JSON.parse(data.Body.toString());
    
        const adjustedMappings = {};

        for (const curr of mappings.OpenIDConnections) {
          if (curr.mechanism && curr.mechanism.authorizeURL) {
            const authorizeURL = curr.mechanism.authorizeURL;
            const adjustedAuthorizeURL = authorizeURL // this will need to be updated if any new deviations are added
              .replace(/\/oauth2\/v2\.0\/authorize$/, '')
              .replace(/\/openam\/oauth2\/authorize$/, '');
            adjustedMappings[curr.suffix] = adjustedAuthorizeURL;
          } else {
            console.warn(`Warning: Missing mechanism or authorizeURL for connectionID: ${curr.connectionID}`);
          }
        }
        console.log("got s3 suffix mappings");
        lastDateGotSuffixMappings = new Date();
        return adjustedMappings;
    } catch (err) {
        console.error('Error fetching or processing suffix mappings from S3:', err);
        throw err;
    }
}
suffixRouter.get('/get-suffix-mappings', async (req, res) => {
    const mappings = await getSuffixMappings();
    res.json(mappings);
});

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    connectionString: process.env.PGURL,
    ssl: {
        rejectUnauthorized: false,
    },
});
async function generateReportByEmailSuffixDB(suffixes, exportReport) {
    if (suffixes.length < 1) { return; }

    let [suffixMappingsLastModifiedDates] = await Promise.all([
        checkFileLastModified(process.env.AWS_BUCKET, process.env.CONNECTION_LIST_PATH)
    ]);
    let suffixMappingsFilesModified = anyFileModifiedSince(suffixMappingsLastModifiedDates, lastDateGotSuffixMappings);
    let downloadPromises = [];
    // if we haven't got the S3 data yet, go get it 
    if(suffixMappings == undefined || suffixMappingsFilesModified){
        console.log("-- getting s3 suffix file");
        downloadPromises.push(getSuffixMappings().then(data => { suffixMappings = data; }));
    }
    await Promise.all(downloadPromises);
    // Construct LIKE patterns for suffixes and their corresponding mapped values for OpenIDConnect
    const likePatterns = suffixes.map(suffix => `%${suffix}%`);
    const mappedPatterns = suffixes.map(suffix => suffixMappings[suffix])
    .filter(mapping => mapping !== undefined)
    .map(mapping => `%${mapping}%`);

    // Prepare SQL Parameters: one like pattern for ContactEmailAddresses,
    // one for PlayFab login email, and one for OpenIDConnect
    const params = [likePatterns, likePatterns, mappedPatterns];

    // get all accounts that have a login email, or contact email that match a given suffix or 
    // an OpenIDConnect login that matches a given auth url (based off of the suffix)
    const query = `
        SELECT public."AccountData".*
        FROM public."AccountData"
        WHERE EXISTS (
            SELECT *
            FROM jsonb_array_elements(public."AccountData"."AccountDataJSON"::jsonb->'ContactEmailAddresses') AS cea
            WHERE cea->>'EmailAddress' LIKE ANY ($1)
        ) OR EXISTS (
            SELECT *
            FROM jsonb_array_elements(public."AccountData"."AccountDataJSON"::jsonb->'LinkedAccounts') AS la
            WHERE (la->>'Platform' = 'PlayFab' AND la->>'Email' LIKE ANY ($2))
            OR (la->>'Platform' = 'OpenIdConnect' AND la->>'PlatformUserId' LIKE ANY ($3))
        );
    `;

    let accountDataResult = await pool.query(query, params);

    const playFabIds = accountDataResult.rows.map(row => row.PlayFabId);
    // usage data
    const usageDataQuery = 'SELECT * FROM public."UsageData" WHERE "PlayFabId" = ANY($1)';
    const usageDataResult = await pool.query(usageDataQuery, [playFabIds]);

    let matchedUsersMap = new Map();
    let encounteredEmails = new Set();

    accountDataResult.rows.forEach(row => {
        let user = row.AccountDataJSON;
        suffixes.forEach(suffix => {
            let checkContact = true;
    
            if (Array.isArray(user.LinkedAccounts) && user.LinkedAccounts.length > 0) {
                user.LinkedAccounts.forEach(account => {
                    // if the user has PlayFab or OpenIdConnect account, then don't check contact address
                    if(account.Platform == "PlayFab" || account.Platform == "OpenIdConnect"){ checkContact = false; }
    
                    if (account.Platform == "PlayFab" && account.Email && isValidSuffix(account.Email, suffix)) {
                        encounteredEmails.add(account.Email);
                        matchedUsersMap.set(user.PlayerId, user);
                        checkContact = false;
                    } else if (account.Platform == "OpenIdConnect" && isValidPlatformUserId(account.PlatformUserId, suffixMappings[suffix])) {
                        matchedUsersMap.set(user.PlayerId, user);
                        checkContact = false;
                    }
                });
            }
    
            if (checkContact && Array.isArray(user.ContactEmailAddresses) && !matchedUsersMap.has(user.PlayerId)) {
                user.ContactEmailAddresses.forEach(contact => {
                    if (contact.EmailAddress && isValidSuffix(contact.EmailAddress, suffix) && 
                    !encounteredEmails.has(contact.EmailAddress)) {
                        encounteredEmails.add(contact.EmailAddress);
                        matchedUsersMap.set(user.PlayerId, user);
                    }
                });
            }
        });
    });

    // remove any users from usageData and accountData that are not in matchedUsers
    const matchedUserIds = new Set(matchedUsersMap.keys());
    let matchedAccountData = accountDataResult.rows.filter(row => matchedUserIds.has(row.PlayFabId));
    let matchedUsageData = usageDataResult.rows.filter(row => matchedUserIds.has(row.PlayFabId));

    let output = {
        usageData:matchedUsageData,
        accountData:matchedAccountData,
        matchedUsers: Array.from(matchedUsersMap.values()) // TODO: might need to change this?
    }

    if(exportReport == true){
        genExcelReport(suffixes.join('-'), output);
    }

    return output;
}
function isValidSuffix(email, suffix) {
    const parts = email.split('@');
    if (parts.length !== 2) return false; // Ensure there's only one '@'

    const domain = parts[1].toLowerCase(); // Convert domain to lowercase
    const normalizedSuffix = suffix.toLowerCase(); // Normalize suffix

    // Construct a regex pattern to check if the suffix is a valid segment in the domain
    // This regex allows for dots before and after the suffix, ensuring the suffix is a distinct segment
    const pattern = new RegExp(`(^|\\.)${normalizedSuffix}(\\.|$)`);
    
    return pattern.test(domain);
}
function isValidPlatformUserId(platformUserId, suffix) {    
    if(platformUserId.includes(suffix)){
        return true;
    }
    return false;
}

// function to generate out a report (excel sheet)
// add a url param to end point to notify report generation
async function genExcelReport(folderName, data){
    let sortedData = sortAndCombineDataForReport(data);
    let exportData = await setupDataForExport(sortedData);
    exportToExcel(folderName, exportData);
}
function sortAndCombineDataForReport(data) {
    const { accountData, usageData } = data;

    if (!Array.isArray(accountData) || !Array.isArray(usageData)) {
        throw new TypeError("Expected 'accountData' and 'usageData' to be arrays");
    }

    return usageData.reduce((acc, ud) => {
        const accountDataMatch = accountData.find(ad => ad.PlayFabId === ud.PlayFabId);
        if (accountDataMatch) {
            acc.push({
                usageData: ud,
                accountData: accountDataMatch
            });
        }
        return acc;
    }, []);
}
async function setupDataForExport(sortedData){
    // get email blacklist (we'll need this later)
    let emailBlacklistResp = await getEmailBlacklist();

    let exportData = [];
    sortedData.forEach(element =>{
        //let playFabId = element.accountData.PlayFabId;
        let email = getUserEmailFromAccData(element.accountData.AccountDataJSON);
        let createdDate = new Date(element.accountData.AccountDataJSON.Created);
        let lastLoginDate = new Date(element.accountData.AccountDataJSON.LastLogin);
        let daysSinceLastLogin = calcDaysSince(lastLoginDate);
        let daysSinceCreation = calcDaysSince(createdDate);

        let userData = element.usageData.UsageDataJSON.Data;
        let accountExpiryDate = userData.TestAccountExpiryDate !== undefined ? new Date(userData.TestAccountExpiryDate.Value) : undefined;
        let linkedAccounts = element.accountData.AccountDataJSON.LinkedAccounts ? 
                element.accountData.AccountDataJSON.LinkedAccounts.map(acc => acc.Platform).join(", ") : "N/A";
        
        let loginData = populateLoginData(userData);
        let playerDataNew;
        try{
            playerDataNew = userData.PlayerDataNewLauncher !== undefined ? JSON.parse(userData.PlayerDataNewLauncher.Value) : undefined;
        }catch(e){
            console.error(`Error parsing PlayerDataNewLauncher JSON:\n${e}\n`);
            playerDataNew = undefined;
        }

        let playerData;
        try{
            playerData = userData.PlayerData !== undefined ? JSON.parse(userData.PlayerData.Value) : undefined;
        }catch(e){
            console.error(`Error parsing PlayerData JSON:\n${e}\n`);
            playerData = undefined;
        }
        
        let playerDataState = {
            totalActivitiesPlayed:0,
            averageTimePerPlay: 0,
            totalPlays: 0,
            totalPlayTime: 0,
            activityDataForReport: []
        };
        let newDataState = populateUsageData([playerDataNew, playerData], playerDataState);
        let activityDataForReport = newDataState.activityDataForReport;
        let averageTimePerPlay = newDataState.averageTimePerPlay;
        let totalPlays = newDataState.totalPlays;
        let totalPlayTime = newDataState.totalPlayTime;

        let nclData;
        //console.log("USAGE DATA: " + JSON.stringify(userData))
        if(userData.NclNhsOnboardingData != undefined){
            nclData = JSON.parse(userData.NclNhsOnboardingData.Value);
        }

        let userExportData = {
            email,
            createdDate: createdDate.toDateString(),
            lastLoginDate: lastLoginDate.toDateString(),
            daysSinceLastLogin,
            daysSinceCreation,
            accountExpiryDate,
            daysToExpire: 0, 
            linkedAccounts,
            activityData: activityDataForReport,
            activityDataFormatted: formatActivityData(activityDataForReport),
            totalPlays,
            totalPlayTime,
            averageTimePerPlay,
            loginData,
            nclData
        }
        // remove certain emails from the report data
        let blacklistedEmails = emailBlacklistResp.blacklistedEmails;
        if(!blacklistedEmails.includes(userExportData.email))
        {
            exportData.push(userExportData);
        }        
    });
    return exportData;
}
// SETUP DATA FOR EXPORT HELPER FUNCTIONS
function getUserEmailFromAccData(element){
    let email = "no email";
    if(element.LinkedAccounts !== undefined && element.LinkedAccounts.length > 0){
        let gotAcc = false;
        element.LinkedAccounts.forEach(linkedAcc =>{
            if(linkedAcc.Platform == "PlayFab"){
                email = linkedAcc.Email;
                gotAcc = true;
            }else{
                if(!gotAcc){
                    let contactEmail = checkForContactEmailAddr(element);
                    email = contactEmail == undefined ? "no email" : contactEmail;
                }
            }
        })
    }else{ // if there are no linked accounts, just get the contact email   
        let contactEmail = checkForContactEmailAddr(element);
        email = contactEmail == undefined ? "no email" : contactEmail;
    }
    return email;
}
function checkForContactEmailAddr(input){
    let emailAddr;
    if(input.ContactEmailAddresses !== undefined && input.ContactEmailAddresses.length > 0){
        emailAddr = input.ContactEmailAddresses[0].EmailAddress; // assume the first contact email
    }
    return emailAddr;
}
function calcDaysSince(inputDate){
    let today = new Date();
    let diffTime = Math.abs(today - inputDate);
    let daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysSince;
}
// SETUP LOGIN DATA
function populateLoginData(userData){
    const lastLoginAndr = userData.LastLoginDateAndroid?.Value;
    const lastLoginIOS = userData.LastLoginDateiOS?.Value;
    const lastLoginWeb = userData.LastLoginDateWeb?.Value;

    const sessionData = userData.SessionDebugData?.Value;
    const sessionDataJSON = sessionData ? JSON.parse(sessionData) : undefined;
    const sessions = sessionDataJSON ?  sessionDataJSON.sessions : undefined;
    const loginsPerDate = getLoginsPerDate(sessions);
    //const sessionsString = sessions ? formatSessionsForModal(sessions, loginsPerDate) : "No Session Data";

    const totalLogins = getTotalLoginsPerUser(sessions);
    const loginsPerMonth = getLoginsPerMonth(loginsPerDate);

    return { 
        lastLoginAndr, 
        lastLoginIOS, 
        lastLoginWeb,
        loginsPerDate,
        totalLogins,
        loginsPerMonth,
        //sessionsString
    };
}
function getLoginsPerDate(sessions) {
    if (!sessions || sessions.length === 0) {
        return [];
    }

    let loginHistoryDates = [];

    // Iterate over each session and process its loginHistory
    sessions.forEach(session => {
        const loginHistory = session.loginHistory;

        // Check if the session has a valid loginHistory, skip if undefined or empty
        if (!loginHistory || loginHistory.length === 0) {
            return; // Skip this session if no loginHistory
        }

        // Iterate through each login entry in the loginHistory
        loginHistory.forEach(entry => {
            const [datePart, timePart] = entry.split(" ");
            const [day, month, year] = datePart.split("/").map(Number);
            const loginDate = new Date(year, month - 1, day); // Create a Date object

            // Push the login date to the list of dates
            loginHistoryDates.push(loginDate);
        });
    });

    // Count logins by date
    let loginCountByDate = {};

    loginHistoryDates.forEach(date => {
        // Format the date as DD/MM/YYYY
        let formattedDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY format

        // Increment the count for this date
        if (loginCountByDate[formattedDate]) {
            loginCountByDate[formattedDate]++;
        } else {
            loginCountByDate[formattedDate] = 1;
        }
    });

    // Format the output
    let loginsByDate = Object.keys(loginCountByDate).map(date => {
        return {
            date: date,
            logins: loginCountByDate[date]
        };
    });

    return loginsByDate;
}
function getTotalLoginsPerUser(sessions){
    if(sessions == undefined){ return 0; }
    let totalLogins = 0;
    sessions.forEach(session =>{
        totalLogins += session.loginHistory != undefined ? session.loginHistory.length : 0;
    });
    return totalLogins;
}
function getLoginsPerMonth(loginsPerDate) {
    // Determine the range of years in the data
    const years = loginsPerDate.map(login => Number(login.date.split("/")[2]));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // Create a baseline of months for each year in the range
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const output = [];

    for (let year = minYear; year <= maxYear; year++) {
        months.forEach((month, index) => {
            output.push({
                year: year,
                month: month,
                logins: 0
            });
        });
    }

    loginsPerDate.forEach(login => {
        const [day, month, year] = login.date.split("/").map(Number);
        const monthName = months[month - 1];
        // Find the corresponding month-year entry in the output and update its logins
        const entry = output.find(element => element.year === year && element.month === monthName);
        if (entry) {
            entry.logins += login.logins;
        }
    });

    return output;
}
// SETUP USAGE DATA
function populateUsageData(playerDataList, state){
    playerDataList.forEach(playerData =>{
        if(playerData == undefined){ return; }

        state.totalActivitiesPlayed += playerData.activities.length;
        playerData.activities.forEach(activity =>{
            let totalSessionTime = 0;
            let bestScore = 0;
            state.totalPlays += activity.plays.length;
            activity.plays.forEach(play => {
                totalSessionTime += Math.round(Math.abs(play.sessionTime));
                if(play.normalisedScore > bestScore){
                    bestScore = Math.round(play.normalisedScore * 100);
                }
            });
            state.totalPlayTime += totalSessionTime;

            let userActivityData = {
                activityID:activity.activityID,
                activityTitle: activity.activityTitle,
                activityType: activity.activityType,
                plays:activity.plays,
                playCount:activity.plays.length,
                totalSessionTime:totalSessionTime,
                bestScore:bestScore
            };
            state.activityDataForReport.push(userActivityData);
        });
    });
    state.averageTimePerPlay = Math.round(state.totalPlayTime / state.totalPlays);
    
    return state;
}
function formatActivityData(activityData) {
    let formattedData = [];

    activityData.forEach(activity => {
        activity.plays.forEach(play => {
            formattedData.push({
                activityID: activity.activityID,
                activityTitle: activity.activityTitle,
                playDate: play.playDate,
                score: play.normalisedScore,
                sessionTime: play.sessionTime
            });
        });
    });
    return formattedData;
}

// EXPORT
function exportToExcel(folderName, exportData){
    // add any relevant insights data
    const totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(exportData);
    const totalLogins = getTotalLogins(exportData);
    const totalLoginsPerMonth = getTotalLoginsPerMonth(exportData);
    const playersWithMostPlayTime = findPlayersWithMostPlayTime(exportData, 1, 3);
    const playersWithMostPlays = findPlayersWithMostPlays(exportData, 1, 3);
    const playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayed(exportData, 1, 3);
    const mostPlayedActivities = findMostPlayedActivities(exportData, 1, 10);
    //const userAccessPerPlatform = getUserAccessPerPlatform(exportData);

    // General, Login, Lesson & Sim insights
    const insightsExportData = setupGeneralInsights(exportData, totalPlayTimeAcrossAllUsersSeconds, totalLogins, playersWithMostPlayTime, playersWithMostPlays, playersWithMostUniqueActivities, mostPlayedActivities);
    const loginInsightsData = setupLoginInsights(totalLoginsPerMonth);
    const lessonStats = getLessonStats(exportData);
    const lessonInsightsData = setupLessonInsights(lessonStats);
    const simStats = getSimStats(exportData);
    const simInsightsData = setupSimInsights(simStats);
    
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

    // Login, Usage & Progress Reports
    const loginData = setupLoginData(exportData);
    const usageData = setupUsageData(exportData);
    const progressData = setupProgressData(exportData);

    // Low Prio: Topic progress - user, topic %

    // NCL DATA
    let nclData = setupNCLData(exportData);

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
    // Add NCL data if it exists
    if(nclData.length > 0 ){ 
        const nclDataWorksheet = XLSX.utils.json_to_sheet(nclData);
        // add to the combined report workbook
        XLSX.utils.book_append_sheet(workbook, nclDataWorksheet, "NCL Report");
    }

    // Seperate workbooks and seperate work sheets (with slightly different messages)
    const insightsMessages2 = [
        'This report shows some general insights, lesson specific insights and simulation specific insights.',
        ''
    ];
    const progressMessages2 = [
        'This report shows every user, the activities they have engaged with,',
        'how long in total they have spent in the activity and the score for each attempt.',
        ''
    ];
    const usageMessages2 = [
        'This report shows overall progress and usage, similar to the progress report',
        'However, it presents the date each attempt was made and the duration of each attempt.',
        ''
    ];
    const loginMessages2 = [
        'This report contains some general analytics about each account,',
        'when was the account created, last logged in, and how active they have been.',
        ''
    ];
    const workbookInsights = XLSX.utils.book_new();
    const workbookProgress = XLSX.utils.book_new();
    const workbookUsage = XLSX.utils.book_new();
    const workbookLogin = XLSX.utils.book_new();
    const workbookNCL = XLSX.utils.book_new();

    const insightsWorksheet2 = XLSX.utils.json_to_sheet(combinedInsightsData);
    const progressWorksheet2 = XLSX.utils.json_to_sheet(progressData);
    const usageWorksheet2 = XLSX.utils.json_to_sheet(usageData);
    const loginDataWorksheet2 = XLSX.utils.json_to_sheet(loginData);

    removeSpecificHeaders(insightsWorksheet2, ["value3","value4","value5","value6","value7","value8","value9","value10","value11","value12"]);

    addMessages(insightsWorksheet2, insightsMessages2);
    addMessages(progressWorksheet2, progressMessages2);
    addMessages(usageWorksheet2, usageMessages2);
    addMessages(loginDataWorksheet2, loginMessages2);

    XLSX.utils.book_append_sheet(workbookInsights, insightsWorksheet2, "Insights");
    XLSX.utils.book_append_sheet(workbookProgress, progressWorksheet2, "Progress Report");
    XLSX.utils.book_append_sheet(workbookUsage, usageWorksheet2, "Usage Report");
    XLSX.utils.book_append_sheet(workbookLogin, loginDataWorksheet2, "Login Report");

    // write to s3
    const workbookCombinedOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const workbookInsightsOut = XLSX.write(workbookInsights, { bookType: 'xlsx', type: 'buffer' });
    const workbookProgressOut = XLSX.write(workbookProgress, { bookType: 'xlsx', type: 'buffer' });
    const workbookUsageOut = XLSX.write(workbookUsage, { bookType: 'xlsx', type: 'buffer' });
    const workbookLoginOut = XLSX.write(workbookLogin, { bookType: 'xlsx', type: 'buffer' });

    let todayUTC = new Date().toISOString().split('T')[0];
    console.log(`Today in UTC: ${todayUTC}`);
    uploadWorkbookToS3(workbookCombinedOut, 'Report-Combined', folderName, todayUTC);
    uploadWorkbookToS3(workbookInsightsOut, 'Report-Insights', folderName, todayUTC);
    uploadWorkbookToS3(workbookProgressOut, 'Report-Progress', folderName, todayUTC);
    uploadWorkbookToS3(workbookUsageOut, 'Report-Usage', folderName, todayUTC);
    uploadWorkbookToS3(workbookLoginOut, 'Report-Login', folderName, todayUTC);
    // Add NCL data if it exists
    if(nclData.length > 0 ){ 
        const nclDataWorksheet = XLSX.utils.json_to_sheet(nclData);
        // add to the NCL specific workbook
        XLSX.utils.book_append_sheet(workbookNCL, nclDataWorksheet, "NCL Report");
        uploadWorkbookToS3(workbookNCL, 'Report-NCL', folderName, todayUTC);
    }
}

// UPLOAD TO S3
function uploadWorkbookToS3(workbook, reportType, folderName, todayUTC){
    let filename = `Analytics/${folderName}/${reportType}-${folderName}-${todayUTC}-UTC.xlsx`;
    uploadToS3(workbook, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', process.env.AWS_BUCKET)
        .then((data) => {
            console.log(`File uploaded successfully at ${filename}`);
        })
        .catch((err) => {
            console.error(`Error uploading file: ${err.message}`);
        });
}
// GET REPORT FOLDERS
suffixRouter.get('/reports/:folder', async (req, res) => {
    const folder = req.params.folder;
    //console.log(`getting reports for ${folder}`);
    const key = req.headers['x-secret-key'];
    if(key != process.env.REPORT_PASS){ console.log("invalid key"); res.status(403).send('Forbidden: Invalid secret key'); return;}

    try {
        const urls = await generatePresignedUrlsForFolder(process.env.AWS_BUCKET, `Analytics/${folder}`);
        
        let outURLs = [];
        urls.forEach(url =>{
            if(url.filename !== ''){ outURLs.push(url); }
        })
        console.log(outURLs);
        res.send(outURLs);
    } catch (err) {
        res.status(500).send(`Error generating pre-signed URLs: ${err.message}`);
    }
});
suffixRouter.get('/get-report-folders', async (req, res) => {
    let formattedFolders = await getReportFolders();
    res.json(formattedFolders);
});
// AUTH USER FOR REPORT
suffixRouter.post('/auth', async (req, res) => {
    try {
        if(req.body.pass == process.env.REPORT_PASS)
        {
            res.send(true);
        }
        else
        {
            res.send(false);
        }        
    } catch (err) {
        res.status(500).send(`Error ${err.message}`);
    }
});

// EXPORT HELPER FUNCTIONS (SETUP ES MODULES AND RE-USE THESE)
function getTotalPlayTime(data){
    let totalPlayTimeAcrossAllUsers = 0;
    data.forEach((element) => {
        totalPlayTimeAcrossAllUsers += element.totalPlayTime;
    });

    return totalPlayTimeAcrossAllUsers;
}
function getTotalLogins(data){
    let totalLogins = 0;
    data.forEach(element => {
        totalLogins += element.loginData.totalLogins;
    });
    return totalLogins;
}
function getTotalLoginsPerMonth(data) {
    let totalLoginsPerMonth = [];

    data.forEach(dataElement => {
        if (!dataElement.loginData || !dataElement.loginData.loginsPerMonth){ 
            console.log("NO LOGIN DATA: " + JSON.stringify(dataElement));
            return;
        }
        
        dataElement.loginData.loginsPerMonth.forEach(entry => {
            let monthEntry = totalLoginsPerMonth.find(element => element.year === entry.year && element.month === entry.month);

            if (!monthEntry) {
                totalLoginsPerMonth.push({ year: entry.year, month: entry.month, logins: entry.logins });
            } else {
                monthEntry.logins += entry.logins;
            }
        });
    });

    return totalLoginsPerMonth;
}
function findPlayersWithMostPlayTime(data, start, end) {
    // Sort the data by totalPlayTime in descending order
    const sortedData = data.slice().sort((a, b) => b.totalPlayTime - a.totalPlayTime);

    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, data.length);

    // Slice the sorted array to get the range
    const selectedPlayers = sortedData.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithMostPlays(data, start, end) {
    const sortedData = data.slice().sort((a, b) => b.totalPlays - a.totalPlays);

    start = Math.max(start - 1, 0);
    end = Math.min(end, data.length);

    const selectedPlayers = sortedData.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithMostUniqueActivitiesPlayed(data, start, end) {
    // Map each player to an object with email and count of unique activity IDs
    const playersWithUniqueActivityCount = data.map(element => {        
        if (element === undefined || !element.activityData || !Array.isArray(element.activityData)) {
            console.log(`No activities found for ${element.email}`);
            return { email: element.email, uniqueActivitiesCount: 0 };
        }
        
        const uniqueActivityIDs = new Set(element.activityData.map(activity => activity.activityID));
        return { email: element.email, uniqueActivitiesCount: uniqueActivityIDs.size };
    });

    // Sort by uniqueActivitiesCount in descending order
    playersWithUniqueActivityCount.sort((a, b) => b.uniqueActivitiesCount - a.uniqueActivitiesCount);

    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, data.length);

    // Slice the array to get the specified range
    const selectedPlayers = playersWithUniqueActivityCount.slice(start, end);
    return selectedPlayers;
}
function findMostPlayedActivities(reportData, start, end, activityType = null) {
    let activityCounts = {};
    let activityTypeSuffix = getActivityTypeSuffix(activityType);

    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if (activityType !== null){
                    if(activity.activityType == activityType || activity.activityID.includes(activityTypeSuffix)) {
                        updateActivityCount(activity, activityCounts);
                    }
                }else{
                    updateActivityCount(activity, activityCounts);
                }
            });
        }
    });

    // Convert the object into an array and sort it by count in descending order
    const sortedActivities = Object.values(activityCounts).sort((a, b) => b.playCount - a.playCount);
    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, sortedActivities.length);

    // Slice the array to get the specified range
    const mostPlayedActivities = sortedActivities.slice(start, end);
    return mostPlayedActivities;
}
function findHighestPlayTimeActivities(reportData, start, end, activityType = null) {
    let activityPlayTimeTotals = {};
    let activityTypeSuffix = getActivityTypeSuffix(activityType);    

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activityType !== null){
                    if(activity.activityID.includes(activityTypeSuffix) || activity.activityType == activityType){
                        updateActivityPlayTimeTotals(activity, activityPlayTimeTotals);
                    }
                }else{
                    updateActivityPlayTimeTotals(activity, activityPlayTimeTotals);
                }
            });
        }
    });

    // Convert the object into an array and sort it by totalTime in descending order
    const sortedActivitiesByTime = Object.values(activityPlayTimeTotals).sort((a, b) => b.totalTime - a.totalTime);
    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, sortedActivitiesByTime.length);

    // Slice the array to get the specified range
    const highestPlayTimeActivities = sortedActivitiesByTime.slice(start, end);
    return highestPlayTimeActivities;
}
function calculateAverageScores(data) {
    let scoreSum = {};
    let playCount = {};
    let activityTitles = {};

    data.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes('_prac')){ 
                    if (!(activity.activityID in scoreSum)) {
                        scoreSum[activity.activityID] = 0;
                        playCount[activity.activityID] = 0;
                        activityTitles[activity.activityID] = activity.activityTitle;
                    }

                    activity.plays.forEach(play => {
                        if ('normalisedScore' in play) {
                            scoreSum[activity.activityID] += play.normalisedScore;
                            playCount[activity.activityID]++;
                        }
                    });
                }
            });
        }
    });

    // Transform the accumulated data into an array of objects
    let averageScoresArray = Object.keys(scoreSum).map(activityID => ({
        id: activityID,
        activityTitle: activityTitles[activityID],
        averageScore: playCount[activityID] > 0 ? scoreSum[activityID] / playCount[activityID] : 0,
    }));
    // sort array
    averageScoresArray.sort((a, b) => b.averageScore - a.averageScore);

    return averageScoresArray;
}
function getUserAccessPerPlatform(data){
    let totalAndroid = 0;
    let totalIOS = 0;
    let totalWeb = 0;

    data.forEach((element) => {
        if(element.loginData !== undefined && element.loginData.lastLoginAndr !== undefined){
            totalAndroid++;
        }
        if(element.loginData !== undefined && element.loginData.lastLoginIOS !== undefined){
            totalIOS++;
        }
        if(element.loginData !== undefined && element.loginData.lastLoginWeb !== undefined){
            totalWeb++;
        }
    });
    return {totalAndroid, totalIOS, totalWeb};
    
}
function formatTimeToHHMMSS(seconds) {
    if(isNaN(seconds)){ return '00:00:00'; }

    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(secs).padStart(2, '0');

    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
}

// EXPORT HELPERS
function setupGeneralInsights(exportData, totalPlayTimeAcrossAllUsersSeconds, totalLogins, playersWithMostPlayTime, playersWithMostPlays, playersWithMostUniqueActivities, mostPlayedActivities){
    let output = [];
    output.push(
        { insight: 'Total Users In Report', value1: exportData.length }, 
        { insight: 'Total Logins', value1: totalLogins },
        { insight: 'Total Play Time Across All Users', value1: formatTimeToHHMMSS(totalPlayTimeAcrossAllUsersSeconds)
    });
    playersWithMostPlayTime.forEach(player => {
        output.push({ insight: 'Player With Most Play Time', value1: player.email, value2: formatTimeToHHMMSS(player.totalPlayTime) });
    });
    playersWithMostPlays.forEach(player => {
        output.push({ insight: 'Player With Most Total Plays', value1: player.email, value2: player.totalPlays });
    });
    playersWithMostUniqueActivities.forEach(player => {
        output.push({ insight: 'Player With Most Unique Activities', value1: player.email, value2: player.uniqueActivitiesCount });
    });
    mostPlayedActivities.forEach(activity => {
        output.push({ insight: 'Most Played Activities', value1: activity.activityTitle, value2: activity.playCount });
    });
    return output;
}
function setupLoginInsights(totalLoginsPerMonth){
    let output = [];
    output.push({
        insight: '',
        value1: 'Jan', value2: 'Feb', value3: 'Mar', value4: 'Apr', value5: 'May', value6: 'Jun',
        value7: 'Jul', value8: 'Aug', value9: 'Sep', value10: 'Oct', value11: 'Nov', value12: 'Dec',
    });
    let currentYear = null;
    let loginDataRow = null;
    totalLoginsPerMonth.forEach((monthData, index) => {
        if (monthData.year !== currentYear) {
            if (loginDataRow != null) {
                output.push(loginDataRow);
            }
            // Create a new row for the new year
            loginDataRow = { insight: `Total Logins Per Month (${monthData.year})` };
            currentYear = monthData.year;
        }

        // Assign the login data to the appropriate value property
        loginDataRow[`value${(index % 12) + 1}`] = monthData.logins;
    });
    // cant have null values in output
    if(loginDataRow == null){
        loginDataRow = { insight: `Total Logins Per Month` };
    }
    output.push(loginDataRow);

    return output;
}
function setupLessonInsights(lessonStats){
    let output = [];
    output.push(
        { insight: 'Total Lesson Play Time', value1: formatTimeToHHMMSS(lessonStats.totalLessonPlayTime) },
        { insight: 'Total Lessons Attempted', value1: lessonStats.totalLessonsAttempted },
        { insight: 'Total Lesson Plays', value1: lessonStats.totalLessonPlays }
    );
    lessonStats.mostPlayedLessons.forEach(lesson => {
        output.push({ insight: 'Most Played Lessons', value1: lesson.activityTitle, value2: lesson.playCount });
    });
    lessonStats.highestPlayTimeLessons.forEach(lesson => {
        output.push({ insight: 'Most Played Lessons (Play Time)', value1: lesson.activityTitle, value2: formatTimeToHHMMSS(lesson.totalTime) });
    });

    return output;
}
function setupSimInsights(simStats){
    let output = [];
    output.push(
        { insight: 'Total Simulation Play Time', value1: formatTimeToHHMMSS(simStats.totalSimPlayTime) },
        { insight: 'Total Simulations Attempted', value1: simStats.totalSimsAttempted },
        { insight: 'Total Simulations Plays', value1: simStats.totalSimPlays }      
    );
    simStats.mostPlayedSims.forEach(sim => {
        output.push({ insight: 'Most Played Simulations', value1: sim.activityTitle, value2: sim.playCount });
    });
    simStats.highestPlayTimeSims.forEach(sim => {
        output.push({ insight: 'Most Played Simulations (Play Time)', value1: sim.activityTitle, value2: formatTimeToHHMMSS(sim.totalTime) });
    });

    return output;
}
function setupProgressData(exportData){
    let output = [];
    exportData.forEach(dataToExport => {
        let emailRow = { email:dataToExport.email };
        output.push(emailRow);
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
            output.push(dataRow);
        });        
        output.push({});
    });
    return output;
}
function setupLoginData(exportData){
    let output = [];
    exportData.forEach(dataToExport => {
        output.push(createLoginRow(dataToExport));
    });
    return output;
}
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
function setupUsageData(exportData){
    let output = [];
    exportData.forEach(dataToExport => {
        if(dataToExport.activityDataFormatted == undefined || dataToExport.activityDataFormatted.length <= 0){
            output.push(createUsageRow(dataToExport, {}, true));
            output.push({});
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
            output.push(createUsageRow(dataToExport, activityRow, isFirstActivity));
            isFirstActivity = false;
        });        
        output.push({});        
    });

    return output;
}
function createUsageRow(dataToExport, activity, isFirstActivity){
    let userRow = {
        email: dataToExport.email,
    };
    return isFirstActivity ? { ...userRow, ...activity } : activity;
}
function setupNCLData(exportData){
    let output = [];
    exportData.forEach(dataToExport => {
        if(dataToExport.nclData == undefined){ return; }

        let nclRow = {}
        nclRow["email"] = dataToExport.email;
        dataToExport.nclData.additionalDataFields.forEach(field =>{
            // replace ~ with ,
            let tempField = field;
            tempField.value = tempField.value.replaceAll("~",", ");
            nclRow[tempField.fieldId] = tempField.value;
        });
        output.push(nclRow);
    });
    return output;
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
// LESSON & SIM STATS
function getLessonStats(reportData){
    let output = {
        totalLessonPlayTime:0,
        totalLessonsAttempted:0,
        totalLessonPlays:0,
        totalLessonsCompleted:0,
        mostPlayedLessons:[],
        highestPlayTimeLessons:[]
    };

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes('_lesson') || activity.activityType == 'Lesson'){                    
                    activity.plays.forEach(play =>{
                        output.totalLessonPlayTime += Math.round(Math.abs(play.sessionTime));
                    });                    
                    output.totalLessonsAttempted++
                    output.totalLessonPlays += activity.playCount;
                    if(activity.bestScore >= 100){
                        output.totalLessonsCompleted++;
                    }
                }
            });
        }
    });

    output.mostPlayedLessons = findMostPlayedActivities(reportData, 1, 10, 'Lesson');
    output.highestPlayTimeLessons = findHighestPlayTimeActivities(reportData, 1, 10, 'Lesson');

    return output;
}
function getSimStats(reportData){
    let output = {
        totalSimPlayTime:0,
        totalSimsAttempted:0,
        totalSimPlays:0,
        totalSimsCompleted:0,
        mostPlayedSims:[],
        highestPlayTimeSims:[],
        averageScores:[]
    };
    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes('_prac') || activity.activityType == 'Simulation'){ 
                    activity.plays.forEach(play =>{
                        output.totalSimPlayTime += Math.round(Math.abs(play.sessionTime));
                    });
                    output.totalSimsAttempted++;
                    output.totalSimPlays += activity.playCount;
                }
            });
        }
    });

    output.mostPlayedSims = findMostPlayedActivities(reportData, 1, 10, 'Simulation');
    output.highestPlayTimeSims = findHighestPlayTimeActivities(reportData, 1, 10, 'Simulation');
    output.averageScores = calculateAverageScores(reportData);

    return output;
}
// ACTIVITY
function updateActivityCount(activity, activityCounts) {
    const activityKey = activity.activityID + ' - ' + activity.activityTitle;
    if (activityCounts[activityKey]) {
        activityCounts[activityKey].playCount += activity.playCount;
    } else {
        activityCounts[activityKey] = {
            activityID: activity.activityID,
            activityTitle: activity.activityTitle,
            playCount: activity.playCount
        };
    }
}
function updateActivityPlayTimeTotals(activity, activityPlayTimeTotals) {
    const activityKey = activity.activityID + ' - ' + activity.activityTitle;
    activity.plays.forEach(play => {
        if (activityPlayTimeTotals[activityKey]) {
            activityPlayTimeTotals[activityKey].totalTime += play.sessionTime;
        } else {
            activityPlayTimeTotals[activityKey] = {
                activityID: activity.activityID,
                activityTitle: activity.activityTitle,
                totalTime: play.sessionTime
            };
        }
    });
}
function getActivityTypeSuffix(activityType){
    switch(activityType){
        case "Lesson":
            return "_lesson";
        case "Simulation":
            return "_prac";
    }
}

// Route that takes in an array of query param gen-suffix-rep?suffixes=suffix1,suffix2
suffixRouter.get('/gen-suffix-rep', async (req, res) => {
    try {
        // Splits the suffixes into an array
        let exportReport = req.query.exportReport === "true" ? true : false;
        let suffixes = req.query.suffixes.split(',');
        const matchedUsers = await generateReportByEmailSuffixDB(suffixes, exportReport);
        res.json(matchedUsers);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});
// Used to auto get reports (scheduled call)
suffixRouter.get('/gen-suffix-rep-exp', async (req, res) => {
    try {        
        console.log('exporting report');
        let suffixes = req.query.suffixes.split(',');
        let outMessage = `Began generating report for ${suffixes}, files will be delivered to S3 shortly...`;
        console.log(outMessage);
        generateReportByEmailSuffixDB(suffixes, true);
        res.status(200).json({ message: outMessage});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

// Gets all the connections ids from connetion list file
suffixRouter.get('/get-connection-ids', async (req, res) => {
    try {        
        const params = {
            Bucket: process.env.AWS_BUCKET,
            Key: process.env.CONNECTION_LIST_PATH
        };    
        const data = await s3.getObject(params).promise();
        const jsonData = JSON.parse(data.Body.toString('utf-8'));
        let connectionIds = [];
        jsonData.OpenIDConnections.forEach(element => { connectionIds.push(element.connectionID)})
        res.json(connectionIds);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to get connection ids', error: error.message });
    }
});

module.exports = { suffixRouter, generateReportByEmailSuffixDB, getSuffixMappings, genExcelReport, sortAndCombineDataForReport };