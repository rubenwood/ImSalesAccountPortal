const AWS = require('aws-sdk');
const express = require('express');
const suffixRouter = express.Router();
const { Pool } = require('pg');
const XLSX = require('xlsx');
//const bodyParser = require('body-parser');

const { anyFileModifiedSince, checkFileLastModified } = require('./s3-utils');

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

                    if (account.Platform == "PlayFab" && account.Email && account.Email.includes(suffix)){// && !encounteredEmails.has(account.Email)) {
                        encounteredEmails.add(account.Email);
                        matchedUsersMap.set(user.PlayerId, user);
                        checkContact = false;
                    } else if (account.Platform == "OpenIdConnect" && account.PlatformUserId.includes(suffixMappings[suffix])) {
                        matchedUsersMap.set(user.PlayerId, user);
                        checkContact = false;
                    }
                });
            }

            if (checkContact && Array.isArray(user.ContactEmailAddresses) && !matchedUsersMap.has(user.PlayerId)) {
                user.ContactEmailAddresses.forEach(contact => {
                    if (contact.EmailAddress && contact.EmailAddress.includes(suffix) && 
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
        genExcelReport(output);
    }

    return output;
    //return Array.from(matchedUsersMap.values());
}

// function to generate out a report (excel sheet)
// add a url param to end point to notify report generation
function genExcelReport(data){
    console.log("exporting report");
    let sortedData = sortAndCombineDataForReport(data);
    //console.log(sortedData);
    setupDataForExport(sortedData);
    console.log('~~~~ EXPORT DATA ~~~~');
    console.log(exportData);
    console.log('~~~~ END EXPORT DATA ~~~~');
    exportToExcel(exportData);
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

let exportData = [];
function setupDataForExport(sortedData){
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
            console.error("Error parsing PlayerDataNewLauncher JSON:", e);
            playerDataNew = undefined;
        }

        let playerData;
        try{
            playerData = userData.PlayerData !== undefined ? JSON.parse(userData.PlayerData.Value) : undefined;
        }catch(e){
            console.error("Error parsing PlayerData JSON:", e);
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
            activityDataFormatted: formatActivityData(activityDataForReport),
            totalPlays,
            totalPlayTime,
            averageTimePerPlay,
            loginData
        }
        exportData.push(userExportData);
    });
}
// EXCEL REPORT HELPER FUNCTIONS
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

function exportToExcel(){
    console.log("beginning export...");

    /* const workbook = XLSX.utils.book_new();
    const insightsWorksheet = XLSX.utils.json_to_sheet(insightsExportData);
    const lessonInsightsWorksheet = XLSX.utils.json_to_sheet(lessonInsightsData);
    const simInsightsWorksheet = XLSX.utils.json_to_sheet(simInsightsData);
    const userDataWorksheet = XLSX.utils.json_to_sheet(userData);
    XLSX.utils.book_append_sheet(workbook, insightsWorksheet, "Insights");
    XLSX.utils.book_append_sheet(workbook, lessonInsightsWorksheet, "Lesson Insights");
    XLSX.utils.book_append_sheet(workbook, simInsightsWorksheet, "Sim Insights");
    XLSX.utils.book_append_sheet(workbook, userDataWorksheet, "Report");
    XLSX.writeFile(workbook, "Report.xlsx"); */
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
