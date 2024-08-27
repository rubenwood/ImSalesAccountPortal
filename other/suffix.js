const AWS = require('aws-sdk');
const express = require('express');
const suffixRouter = express.Router();
const { Pool } = require('pg');
const XLSX = require('xlsx');

const { uploadToS3, anyFileModifiedSince, checkFileLastModified } = require('./s3-utils');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

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
                    } else if (account.Platform == "OpenIdConnect" && isValidSuffix(account.PlatformUserId, suffixMappings[suffix])) {
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
        genExcelReport(suffixes, output);
    }

    return output;
}

function isValidSuffix(email, suffix) {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    
    if (domain === suffix) return true;
    
    const domainParts = domain.split('.');
    const suffixParts = suffix.split('.');
    
    if (domainParts.length < suffixParts.length) return false;
    
    for (let i = 1; i <= suffixParts.length; i++) {
        if (domainParts[domainParts.length - i] !== suffixParts[suffixParts.length - i]) {
            return false;
        }
    }
    
    return true;
}

// function to generate out a report (excel sheet)
// add a url param to end point to notify report generation
function genExcelReport(suffixes, data){
    console.log("exporting report");
    let sortedData = sortAndCombineDataForReport(data);
    let exportData = setupDataForExport(sortedData);
    exportToExcel(suffixes, exportData);
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
function setupDataForExport(sortedData){
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
        
        // need all of this data to generate out an excel report
        /* writeDataForReport(playFabId, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation,
            accountExpiryDate, 0, "", "", linkedAccounts, activityDataForReport, totalPlays, totalPlayTime,
            averageTimePerPlay, loginData); */

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
            loginData
        }
        // remove certain emails from the report data
        let blacklistedEmails = [
            "maxboardmanhdhd@highpoint.edu",
            "testkdbrnfidnn@highpoint.edu",
            "ndjdjfhbdj@highpoint.edu",
            "testhsu@highpoint.edu",
            "maxtest@highpoint.edu",
            "maxhputest2@highpoint.edu",
            "hputest33@highpoint.edu",
            "maxhputest15@highpoint.edu",
            "maxboardman@highpoint.edu",
            "maxwellboardman@highpoint.edu",
            "testing@highpoint.edu",
            "maxboardman56@highpoint.edu",
            "test@highpoint.edu"
        ];
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
    //console.log(element);
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
    //console.log(email);
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
function populateLoginData(userData){
    let lastLoginAndr = userData.LastLoginDateAndroid !== undefined ? userData.LastLoginDateAndroid.Value : undefined;
    let lastLoginIOS = userData.LastLoginDateiOS !== undefined ? userData.LastLoginDateiOS.Value : undefined;
    let lastLoginWeb = userData.LastLoginDateWeb !== undefined ? userData.LastLoginDateWeb.Value : undefined;
    return {lastLoginAndr,lastLoginIOS,lastLoginWeb};    
}
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

function exportToExcel(suffixes, exportData){
    // add any relevant insights data
    const totalPlayTimeAcrossAllUsersSeconds = getTotalPlayTime(exportData);
    const playersWithMostPlayTime = findPlayersWithMostPlayTime(exportData, 1, 3);
    const playersWithMostPlays = findPlayersWithMostPlays(exportData, 1, 3);
    const playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayed(exportData, 1, 3);
    const mostPlayedActivities = findMostPlayedActivities(exportData, 1, 10);
    //const userAccessPerPlatform = getUserAccessPerPlatform(exportData);

    let insightsExportData = [
        { insight: 'Total Users In Report', value: exportData.length },
        { insight: 'Total Play Time Across All Users', value: formatTimeToHHMMSS(totalPlayTimeAcrossAllUsersSeconds) }
    ];
    playersWithMostPlayTime.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Play Time', value: player.email, value2: formatTimeToHHMMSS(player.totalPlayTime) });
    });
    playersWithMostPlays.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Total Plays', value: player.email, value2: player.totalPlays });
    });
    playersWithMostUniqueActivities.forEach(player => {
        insightsExportData.push({ insight: 'Player With Most Unique Activities', value: player.email, value2: player.uniqueActivitiesCount });
    });
    mostPlayedActivities.forEach(activity => {
        insightsExportData.push({ insight: 'Most Played Activities', value: activity.activityTitle, value2: activity.playCount });
    });
    //insightsExportData.push({insight: 'User Access Android', value: userAccessPerPlatform.totalAndroid});
    //insightsExportData.push({insight: 'User Access iOS', value: userAccessPerPlatform.totalIOS});
    //insightsExportData.push({insight: 'User Access Web', value: userAccessPerPlatform.totalWeb});

    // Lesson insights
    const lessonStats = getLessonStats(exportData);
    let lessonInsightsData = [
        { insight: 'Total Lesson Play Time', value: formatTimeToHHMMSS(lessonStats.totalLessonPlayTime) },
        { insight: 'Total Lessons Attempted', value: lessonStats.totalLessonsAttempted },
        { insight: 'Total Lesson Plays', value: lessonStats.totalLessonPlays }
    ];
    lessonStats.mostPlayedLessons.forEach(lesson => {
        lessonInsightsData.push({ insight: 'Most Played Lessons', value: lesson.activityTitle, value2: lesson.playCount });
    });
    lessonStats.highestPlayTimeLessons.forEach(lesson => {
        lessonInsightsData.push({ insight: 'Most Played Lessons (Play Time)', value: lesson.activityTitle, value2: formatTimeToHHMMSS(lesson.totalTime) });
    });
    // Sim insights
    const simStats = getSimStats(exportData);
    let simInsightsData = [
        { insight: 'Total Simulation Play Time', value: formatTimeToHHMMSS(simStats.totalSimPlayTime) },
        { insight: 'Total Simulations Attempted', value: simStats.totalSimsAttempted },
        { insight: 'Total Simulations Plays', value: simStats.totalSimPlays }        
    ];
    simStats.mostPlayedSims.forEach(sim => {
       simInsightsData.push({ insight: 'Most Played Simulations', value: sim.activityTitle, value2: sim.playCount });
    });
    simStats.highestPlayTimeSims.forEach(sim => {
        simInsightsData.push({ insight: 'Most Played Simulations (Play Time)', value: sim.activityTitle, value2: formatTimeToHHMMSS(sim.totalTime) });
    });
    
    // Combine insights data with empty rows between sections
    let combinedInsightsData = [
        ...insightsExportData,
        {}, // empty row
        { insight: 'Lesson Insights', value: '' },
        ...lessonInsightsData,
        {}, // empty row
        { insight: 'Simulation Insights', value: '' },
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
                //activityID: activity.activityID,
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
                topic:activity.topicTitle, // TODO: implementing in app
                activity: activity.activityTitle,
                activityType:activity.activityType, // TODO: implementing in app
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

    // Seperate workbooks and seperate work sheets
    
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

    const insightsWorksheet2 = XLSX.utils.json_to_sheet(combinedInsightsData);
    const progressWorksheet2 = XLSX.utils.json_to_sheet(progressData);
    const usageWorksheet2 = XLSX.utils.json_to_sheet(usageData);
    const loginDataWorksheet2 = XLSX.utils.json_to_sheet(loginData);

    addMessages(insightsWorksheet2, insightsMessages2);
    addMessages(progressWorksheet2, progressMessages2);
    addMessages(usageWorksheet2, usageMessages2);
    addMessages(loginDataWorksheet2, loginMessages2);

    XLSX.utils.book_append_sheet(workbookInsights, insightsWorksheet2, "Insights");
    XLSX.utils.book_append_sheet(workbookProgress, progressWorksheet2, "Progress Report");
    XLSX.utils.book_append_sheet(workbookUsage, usageWorksheet2, "Usage Report");
    XLSX.utils.book_append_sheet(workbookLogin, loginDataWorksheet2, "Login Report");

    // write to server
    //XLSX.writeFile(workbook, `Report-${suffixes.join('-')}-${formatDate(new Date())}.xlsx`);
    // write to s3
    const workbookOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const workbookInsightsOut = XLSX.write(workbookInsights, { bookType: 'xlsx', type: 'buffer' });
    const workbookProgressOut = XLSX.write(workbookProgress, { bookType: 'xlsx', type: 'buffer' });
    const workbookUsageOut = XLSX.write(workbookUsage, { bookType: 'xlsx', type: 'buffer' });
    const workbookLoginOut = XLSX.write(workbookLogin, { bookType: 'xlsx', type: 'buffer' });

    const suffixesJoined = suffixes.join('-');
    let todayUTC = new Date().toISOString().split('.')[0] + 'Z';
    console.log(`Today in UTC: ${todayUTC}`);
    // Combined
    const filename = `Analytics/${suffixesJoined}/Report-Combined-${suffixesJoined}-${todayUTC}-UTC.xlsx`;
    uploadToS3(workbookOut, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', process.env.AWS_BUCKET)
        .then((data) => {
            console.log(`File uploaded successfully at ${filename}`);
        })
        .catch((err) => {
            console.error(`Error uploading file: ${err.message}`);
        });

    // Insights
    const filenameInsights = `Analytics/${suffixesJoined}/Report-Insights-${suffixesJoined}-${todayUTC}-UTC.xlsx`;
    uploadToS3(workbookInsightsOut, filenameInsights, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', process.env.AWS_BUCKET)
        .then((data) => {
            console.log(`File uploaded successfully at ${filename}`);
        })
        .catch((err) => {
            console.error(`Error uploading file: ${err.message}`);
        });

    // Progress
    const filenameProgress = `Analytics/${suffixesJoined}/Report-Progress-${suffixesJoined}-${todayUTC}-UTC.xlsx`;
    uploadToS3(workbookProgressOut, filenameProgress, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', process.env.AWS_BUCKET)
        .then((data) => {
            console.log(`File uploaded successfully at ${filename}`);
        })
        .catch((err) => {
            console.error(`Error uploading file: ${err.message}`);
        });

    // Usage
    const filenameUsage = `Analytics/${suffixesJoined}/Report-Usage-${suffixesJoined}-${todayUTC}-UTC.xlsx`;
    uploadToS3(workbookUsageOut, filenameUsage, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', process.env.AWS_BUCKET)
        .then((data) => {
            console.log(`File uploaded successfully at ${filename}`);
        })
        .catch((err) => {
            console.error(`Error uploading file: ${err.message}`);
        });

    // Login
    const filenameLogin = `Analytics/${suffixesJoined}/Report-Login-${suffixesJoined}-${todayUTC}-UTC.xlsx`;
    uploadToS3(workbookLoginOut, filenameLogin, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', process.env.AWS_BUCKET)
        .then((data) => {
            console.log(`File uploaded successfully at ${filename}`);
        })
        .catch((err) => {
            console.error(`Error uploading file: ${err.message}`);
        });
}

// Adds arbitrary text to a worksheet
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

async function generatePresignedUrlsForFolder(folder) {
    const params = {
        Bucket: process.env.AWS_BUCKET,
        Prefix: `Analytics/${folder}/`
    };

    const data = await s3.listObjectsV2(params).promise();
    const urls = data.Contents.map(item => {
        const urlParams = {
            Bucket: process.env.AWS_BUCKET,
            Key: item.Key,
            Expires: 60 * 60 * 24 // 1 day
        };
        const url = s3.getSignedUrl('getObject', urlParams);
        return { filename: item.Key.split('/').pop(), url };
    });

    return urls;
}

suffixRouter.get('/reports/:folder', async (req, res) => {
    const folder = req.params.folder;
    console.log(`getting reports for ${folder}`);
    const key = req.headers['x-secret-key'];
    if(key != process.env.REPORT_PASS){ console.log("invalid key"); res.status(403).send('Forbidden: Invalid secret key'); return;}

    try {
        const urls = await generatePresignedUrlsForFolder(folder);
        let outURLs = [];
        urls.forEach(url =>{
            if(url.filename !== ''){ outURLs.push(url); }
        })
        res.send(outURLs);
    } catch (err) {
        res.status(500).send(`Error generating pre-signed URLs: ${err.message}`);
    }
});

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
function getTotalPlayTime(data){
    let totalPlayTimeAcrossAllUsers = 0;
    data.forEach((element) => {
        totalPlayTimeAcrossAllUsers += element.totalPlayTime;
    });

    return totalPlayTimeAcrossAllUsers;
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
    //console.log(selectedPlayers);
    return selectedPlayers;
}
function findMostPlayedActivities(reportData, start, end, activityType = null) {
    let activityCounts = {};

    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if (activityType === null || activity.activityID.includes(activityType)) {
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

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if (activityType === null || activity.activityID.includes(activityType)) {
                    let activityKey = activity.activityID + ' - ' + activity.activityTitle;
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
function formatDate(date) {
    const pad = num => num.toString().padStart(2, '0');

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1); // Months are zero-based
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}
function createLoginRow(dataToExport) {
    let userRow = {
        email: dataToExport.email,
        createdDate: dataToExport.createdDate,
        lastLoginDate: dataToExport.lastLoginDate,
        daysSinceLastLogin: dataToExport.daysSinceLastLogin,
        daysSinceCreation: dataToExport.daysSinceCreation,
        //accountExpiryDate: dataToExport.accountExpiryDate,
        daysToExpire: dataToExport.daysToExpire, // TODO: hide this
        linkedAccounts: dataToExport.linkedAccounts,
        lastLoginAndroid: dataToExport.loginData.lastLoginAndr,
        lastLoginIOS: dataToExport.loginData.lastLoginIOS,
        lastLoginWeb: dataToExport.loginData.lastLoginWeb,
        totalPlays: dataToExport.totalPlays,
        totalPlayTime: formatTimeToHHMMSS(dataToExport.totalPlayTime),
        averageTimePerPlay: formatTimeToHHMMSS(dataToExport.averageTimePerPlay)
    };
    return userRow;
}
function createUsageRow(dataToExport, activity, isFirstActivity){
    let userRow = {
        email: dataToExport.email,
    };
    return isFirstActivity ? { ...userRow, ...activity } : activity;
}
function getLessonStats(data){
    let output = {
        totalLessonPlayTime:0,
        totalLessonsAttempted:0,
        totalLessonPlays:0,
        totalLessonsCompleted:0,
        mostPlayedLessons:[],
        highestPlayTimeLessons:[]
    };

    data.forEach(element => {
        // Ensure the player has valid activity data
        if (element.activityData && Array.isArray(element.activityData)) {
            element.activityData.forEach(activity => {
                if(activity.activityID.includes('_lesson')){ 
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

    output.mostPlayedLessons = findMostPlayedActivities(data, 1, 10, '_lesson');
    output.highestPlayTimeLessons = findHighestPlayTimeActivities(data, 1, 10, '_lesson');

    return output;
}
function getSimStats(data){
    //console.log(data);
    let output = {
        totalSimPlayTime:0,
        totalSimsAttempted:0,
        totalSimPlays:0,
        totalSimsCompleted:0,
        mostPlayedSims:[],
        highestPlayTimeSims:[],
        averageScores:[]
    };
    data.forEach(element => {
        if (element.activityData && Array.isArray(element.activityData)) {
            element.activityData.forEach(activity => {
                if(activity.activityID.includes('_prac')){ 
                    activity.plays.forEach(play =>{
                        output.totalSimPlayTime += Math.round(Math.abs(play.sessionTime));
                    });
                    output.totalSimsAttempted++;
                    output.totalSimPlays += activity.playCount;
                }
            });
        }
    });

    output.mostPlayedSims = findMostPlayedActivities(data, 1, 10, '_prac');
    output.highestPlayTimeSims = findHighestPlayTimeActivities(data, 1, 10, '_prac');
    output.averageScores = calculateAverageScores(data);

    return output;
}

// Route that takes in an array of query param gen-suffix-rep?suffixes=suffix1,suffix2
suffixRouter.get('/gen-suffix-rep', async (req, res) => {
    try {
        // Splits the suffixes into an array
        let exportReport = req.query.exportReport === "true" ? true : false;
        console.log(exportReport);
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

module.exports = { suffixRouter, generateReportByEmailSuffixDB };
