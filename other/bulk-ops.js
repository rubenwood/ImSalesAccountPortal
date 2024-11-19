const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const bulkRouter = express.Router();
const fs = require('fs');

require('dotenv').config();
const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
const s3 = new AWS.S3();

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

// This call updates the entire database
// it gets all the player data from PlayFab 
// and then constructs the AccountData table
// Then it gets the usage data 
// and then constructs the UsageData table
// TODO: Only update users who have logged in since the last db update
async function updateDatabase(){
    console.log("getting all player segment and writing to db...");
    // get account data from playfab and write to DB
    await getAllPlayerAccDataAndWriteToDB(); 
    console.log("updating account data fields...");
    // extract out the PlayerId field and make that a separate column PlayFabId, also store the playfab data in AccountDataJSON
    await extractAndSetJsonValue('AccountData', 'AccountDataJSON', 'PlayerId', undefined, 'PlayFabId').catch(err => console.error(err));
    
    // handle event logs
    console.log("updating user event logs...");
    await getAllPlayerEventLogsWriteToDB();

    console.log("getting all usage data and writing to db...");
    // get usage data (Player Title Data) from playfab and write to DB
    await updateUsageDataInDB();
    console.log("updating usage data fields");
    // extract out the PlayFabId field and make that a separate column PlayFabId, also store the playfab data in UsageDataJSON
    await extractAndSetJsonValue('UsageData', 'UsageDataJSON', 'PlayFabId', undefined, 'PlayFabId').catch(err => console.error(err));
    await extractAndSetJsonValue('UsageData', 'UsageDataJSON', 'Data', 'AcademicArea', 'AcademicArea').catch(err => console.error('Unhandled error:', err));
    // set the last updated date (json file)
    OnUpdateCompletion(new Date());
}
async function OnUpdateCompletion(date) {
    const data = JSON.stringify({ LastUpdatedDate: date.toISOString() }, null, 2);
    const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: 'DatabaseLastUpdated.json', // file path within the bucket
        Body: data,
        ContentType: 'application/json',
        ACL: 'public-read' // Make the file publicly readable
    };

    try {
        await s3.putObject(params).promise();
        console.log("Completion date recorded.");
    } catch (err) {
        console.error("Error writing to S3:", err);
    }
}
// returns the last updated date (as a Date)
async function getLastUpdatedDate(){
    const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: 'DatabaseLastUpdated.json'
    };

    try {
        const data = await s3.getObject(params).promise();
        const jsonData = JSON.parse(data.Body.toString('utf-8'));
        console.log(jsonData);
        console.log(jsonData.LastUpdatedDate);
        let jsonValueToDate = new Date(jsonData.LastUpdatedDate);
        console.log(jsonValueToDate);
        console.log("Got updated date");
        return jsonValueToDate;        
    } catch (err) {
        console.error("Error getting from S3:", err);
    }
}
getLastUpdatedDate();

// EVENT LOG DATA
async function getAllPlayerEventLogsWriteToDB() {
    const client = await pool.connect();
    console.log(`Getting all event logs ${new Date()}`);

    try {
        await client.query('BEGIN');

        const { rows } = await client.query('SELECT "PlayFabId" FROM public."AccountData"');
        const playerIds = rows.map(row => row.PlayFabId);
        let maxConcurrentRequests = 20;

        for (let i = 0; i < playerIds.length; i += maxConcurrentRequests) {
            const currentBatch = playerIds.slice(i, i + maxConcurrentRequests);
            const results = await processBatch(currentBatch);

            for (const { playerId, data } of results) {
                const eventLogs = {};

                if (data?.Data == undefined) {
                    console.log(`===== NO DATA ${playerId} =====`);
                    continue;
                }

                // Extract EventLogs (any key with "EventLog" in its name)
                for (const key in data.Data) {
                    if (key.includes("EventLog")) {
                        eventLogs[key] = data.Data[key];
                    }
                }

                // Insert or update event logs in the database
                for (const [eventLogKey, eventLogData] of Object.entries(eventLogs)) {
                    //console.log("\n~~~\n", playerId, "\n~Key~:\n ", eventLogKey, "\n~Data~:\n", eventLogData, "\n~~~\n");

                    // Extract date from the eventLogKey (e.g., from "EventLog-11/11/2024_Part1" to "11/11/2024")
                    const dateMatch = eventLogKey.match(/EventLog-(\d{2}\/\d{2}\/\d{4})/);
                    const eventLogDate = dateMatch ? dateMatch[1] : null;
                    console.log(eventLogDate);

                    if (!eventLogDate) {
                        console.warn(`Invalid EventLogKey format: ${eventLogKey}`);
                        continue;
                    }

                    // Check if an entry with this PlayFabId and EventLogKey already exists
                    const existingEntry = await client.query(
                        `SELECT 1 FROM public."UserEventLogs" 
                         WHERE "PlayFabId" = $1 AND "EventLogKey" = $2`,
                        [playerId, eventLogKey]
                    );

                    if (existingEntry.rowCount > 0) {
                        // Update if the entry exists
                        await client.query(
                            `UPDATE public."UserEventLogs" 
                             SET "EventLogJSON" = $1, "EventLogDate" = TO_DATE($2, 'DD/MM/YYYY')
                             WHERE "PlayFabId" = $3 AND "EventLogKey" = $4`,
                            [eventLogData, eventLogDate, playerId, eventLogKey]
                        );
                    } else {
                        // Insert if no entry exists
                        await client.query(
                            `INSERT INTO public."UserEventLogs" ("PlayFabId", "EventLogKey", "EventLogJSON", "EventLogDate")
                             VALUES ($1, $2, $3, TO_DATE($4, 'DD/MM/YYYY'))`,
                            [playerId, eventLogKey, eventLogData, eventLogDate]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        console.error("Error processing event logs:", error);
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }
}

// ACCOUNT DATA
let getPlayerAccDataJobInProgress = false;
async function getAllPlayerAccDataAndWriteToDB() {
    let contToken = null;
    let timestamp = new Date();
    console.log(`Getting all players ${timestamp}`);
    let lastUpdatedDate = await getLastUpdatedDate();

    // Clear the AccountData table before inserting new data
    await pool.query('TRUNCATE TABLE public."AccountData" RESTART IDENTITY');

    do {
        getPlayerAccDataJobInProgress = true;
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetPlayersInSegment`,
            {
                SegmentId: process.env.PLAYFAB_ALLSEG_ID,
                MaxBatchSize: 10000,
                ContinuationToken: contToken,
            },
            {
                headers: {
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
                }
            }
        );

        console.log(`Processing batch...`);

        // TODO: look through "response.data.data.PlayerProfiles" 
        // and only add users who logged in / created since the last database update
        // Insert the player profiles into the PostgreSQL table
        console.log("updating ", response.data.data.PlayerProfiles.length, " entries");
        for (const profile of response.data.data.PlayerProfiles) {
            /* let createdDate = profile.Created;
            let lastLoginDate = profile.LastLogin;
            console.log(createdDate);
            console.log(lastLoginDate);
            // get the DatabaseLastUpdated.json file and compare the createdDate and lastLoginDate
            if(createdDate > lastUpdatedDate)
            {
                // insert this new user
            }
            else if(lastLoginDate > createdDate && lastLoginDate > lastUpdatedDate)
            {
                // update existing user entry
            } */
            //console.log(lastUpdatedDate);
            await pool.query('INSERT INTO public."AccountData"("AccountDataJSON") VALUES ($1)', [profile]);
        }

        contToken = response.data.data.ContinuationToken;
        console.log("updated db " , contToken);

    } while (contToken);

    getPlayerAccDataJobInProgress = false;
    console.log('All players processed.');
}

let allS3AccData;
let allS3PlayerData;

function setLastDateGotAllS3AccData(newDate){ lastDateGotAllS3AccData = newDate; }
function getLastDateGotAllS3AccData(){ return lastDateGotAllS3AccData; }

function setAllS3AccData(data) { allS3AccData = data; }
function getAllS3AccData() { return allS3AccData; }

function setAllS3PlayerData(data){ allS3PlayerData = data; }
function getAllS3PlayerData(){ return allS3PlayerData; }

function getJobInProgress(){ return getPlayerAccDataJobInProgress }

// USAGE DATA
async function updateUsageDataInDB() {
    const client = await pool.connect();

    // REMOVE ALL DATA IN THE TABLE FIRST
    try {
        await pool.query('TRUNCATE TABLE public."UsageData"');
        console.log("Database cleared.");
    } catch (error) {
        console.error("Error clearing database:", error);
        return;
    }

    try {
        console.log("writing player data to db");
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT "PlayFabId" FROM public."AccountData"');
        const playerIds = rows.map(row => row.PlayFabId);
        let maxConcurrentRequests = 20; // TODO: might be able to increase this?
        for (let i = 0; i < playerIds.length; i += maxConcurrentRequests) {
            const currentBatch = playerIds.slice(i, i + maxConcurrentRequests);
            console.log(`Processing batch ${(i / maxConcurrentRequests) + 1} of ${Math.ceil(playerIds.length / maxConcurrentRequests)}: Processing ${currentBatch.length} player IDs.`);
            const results = await processBatch(currentBatch);

            for (const { playerId, data } of results) {
                if (data) {
                    await client.query( // TODO: use promises here?
                        'INSERT INTO public."UsageData"("PlayFabId", "UsageDataJSON") VALUES($1, $2)',
                        [playerId, JSON.stringify(data)]
                    );
                }
            }
            console.log(`Completed batch ${(i / maxConcurrentRequests) + 1} of ${Math.ceil(playerIds.length / maxConcurrentRequests)}.`);
        }

        await client.query('COMMIT');
        console.log('All player data updated in DB.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during DB update:', error);
    } finally {
        client.release();
    }
}

async function processBatch(playerIds) {
    const fetchPromises = playerIds.map(playerId => fetchPlayerData(playerId).then(data => ({
        playerId,
        data,
    })));

    return Promise.all(fetchPromises);
}

async function fetchPlayerData(playerId) {
    try {
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.api.main.azureplayfab.com/Admin/GetUserData`,
            { PlayFabId: playerId },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
                }
            }
        );
        return response.data.data;
    } catch (error) {
        console.error('Error fetching player data:', error);
        return null;
    }
}

// USED TO UPDATE THE DATABASE
async function extractAndSetJsonValue(tableName, jsonColumnName, keyName, subKeyName, newColumnName) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Add the new column if it doesn't exist
        console.log(`Adding column ${newColumnName} to table ${tableName} if it does not exist.`);
        await client.query(`
            ALTER TABLE "${tableName}"
            ADD COLUMN IF NOT EXISTS "${newColumnName}" TEXT;
        `);

        // Construct the query for updating the new column
        let updateQuery;
        if (subKeyName) {
            updateQuery = `
                UPDATE "${tableName}"
                SET "${newColumnName}" = ("${jsonColumnName}"->'${keyName}'->'${subKeyName}'->>'Value');
            `;
        } else {
            updateQuery = `
                UPDATE "${tableName}"
                SET "${newColumnName}" = ("${jsonColumnName}"->>'${keyName}');
            `;
        }

        console.log(`Constructed query: ${updateQuery}`);
        const result = await client.query(updateQuery);
        console.log(`${result.rowCount} rows updated.`);

        await client.query('COMMIT');
        console.log(`${newColumnName} column has been successfully updated with values from ${jsonColumnName}.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error occurred:', error);
    } finally {
        client.release();
    }
}

// CONVERT LEGACY SUB
async function convertLegacySubData() {
    const stripeDataQuery = `
    SELECT *
    FROM public."UsageData"
    WHERE
        ("UsageDataJSON"->'Data'->'ProductInterval'->>'Value') IS NOT NULL OR
        ("UsageDataJSON"->'Data'->'StripeSubscriptionID'->>'Value') IS NOT NULL OR
        ("UsageDataJSON"->'Data'->'ReceiptStripeActiveUntilDate'->>'Value') IS NOT NULL
    `;

    const androidDataQuery = `
    SELECT *
    FROM public."UsageData"
    WHERE
        ("UsageDataJSON"->'Data'->'ReceiptAndroid'->>'Value') IS NOT NULL
    `;

    const iOSDataQuery = `
    SELECT *
    FROM public."UsageData"
    WHERE
        ("UsageDataJSON"->'Data'->'ReceiptIOS'->>'Value') IS NOT NULL
    `;

    console.log("Getting existing subs...");
    const [stripeRes, androidRes, iOSRes] = await Promise.all([
        pool.query(stripeDataQuery), 
        pool.query(androidDataQuery), 
        pool.query(iOSDataQuery)
    ]);
    const stripeSubUsers = stripeRes.rows;
    const androidSubUsers = androidRes.rows;
    const iOSSubUsers = iOSRes.rows;
    console.log("Got existing subs!");

    /* console.log(stripeSubUsers);
    console.log(androidSubUsers);
    console.log(iOSSubUsers); */

    const output = [];

    // update stripe data
    for (const user of stripeSubUsers) {
        let newSubData = {
            Platform: "Stripe",
            Product: 'immersify.gold_yearly',
            PurchaseDate: '',
            SubStatus: 'renewing',
            SubExpire: '01/08/2124 00:00:00',
            SubActive: "true",
            SubscriptionTier: "legacy",
            SubscriptionPeriod: "yearly"
        };

        await updateUserPlayFabData(user.UsageDataJSON.PlayFabId, newSubData);
        output.push({ PlayFabId: user.UsageDataJSON.PlayFabId, Platform: "Stripe" });
    }

    // update android data
    for (const user of androidSubUsers) {
        let newSubData = {
            Platform: "Android",
            Product: 'immersify.gold_yearly',
            PurchaseDate: '',
            SubStatus: 'renewing',
            SubExpire: '01/08/2124 00:00:00',
            SubActive: "true",
            SubscriptionTier: "legacy",
            SubscriptionPeriod: "yearly"
        };

        await updateUserPlayFabData(user.UsageDataJSON.PlayFabId, newSubData);
        output.push({ PlayFabId: user.UsageDataJSON.PlayFabId, Platform: "Android" });
    }

    // update ios data
    for (const user of iOSSubUsers) {
        let newSubData = {
            Platform: "iOS",
            Product: 'immersify.gold_yearly',
            PurchaseDate: '',
            SubStatus: 'renewing',
            SubExpire: '01/08/2124 00:00:00',
            SubActive: "true",
            SubscriptionTier: "legacy",
            SubscriptionPeriod: "yearly"
        };

        await updateUserPlayFabData(user.UsageDataJSON.PlayFabId, newSubData);
        output.push({ PlayFabId: user.UsageDataJSON.PlayFabId, Platform: "iOS" });
    }

    // write the users to a file
    fs.writeFileSync('conversion_results.json', JSON.stringify(output, null, 2), 'utf8');
    console.log("Sub Conversion done!");
    return output;
}
//convertLegacySubData();

// CONVERT SUB DATE FORMAT
async function convertStripeSubDateFormat()
{
    const stripeDataQuery = `
    SELECT *
    FROM public."UsageData"
    WHERE
        ("UsageDataJSON"->'Data'->'StripeSubData'->>'Value') IS NOT NULL
    `;

    console.log("Getting existing stripe subs...");
    const [stripeRes, ] = await Promise.all([
        pool.query(stripeDataQuery),
    ]);

    const stripeSubUsers = stripeRes.rows;
    for (const user of stripeSubUsers)
    {
        const playFabId = user.UsageDataJSON.PlayFabId;
        console.log(playFabId);
        const stripeSubData = user.UsageDataJSON.Data.StripeSubData.Value;
        const stripeSubDataJSON = JSON.parse(stripeSubData);
        //console.log(stripeSubDataJSON);
        
        const stripePurchaseDateString = stripeSubDataJSON.PurchaseDate;
        const stripeSubExpireDateString = stripeSubDataJSON.SubExpire;

        const stripePurchaseDateConverted = convertToISOFormat(stripePurchaseDateString);
        const stripeSubExpireDateStringConverted = convertToISOFormat(stripeSubExpireDateString);

        //console.log("Purchase Date:", stripePurchaseDateString, " ", stripePurchaseDateConverted);
        //console.log("Expire Date:", stripeSubExpireDateString, " ", stripeSubExpireDateStringConverted);

        const updatedSubData = {
            Platform: stripeSubDataJSON.Platform,
            StripeSubscriptionID: stripeSubDataJSON.StripeSubscriptionID,
            Product: stripeSubDataJSON.Product,
            PurchaseDate: stripePurchaseDateConverted,
            SubStatus: stripeSubDataJSON.Status,
            SubExpire: stripeSubExpireDateStringConverted, 
            SubscriptionTier: stripeSubDataJSON.SubscriptionTier,
            SubscriptionPeriod: stripeSubDataJSON.SubscriptionPeriod
        }

        console.log(updatedSubData);
        await updateUserPlayFabData(playFabId, updatedSubData, 'StripeSubData');

    }
}
//convertStripeSubDateFormat();
function convertToISOFormat(dateStr) {
    //console.log(dateStr);
    const isoFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (isoFormatRegex.test(dateStr)) {
        console.log(dateStr, " already in ISO format!");
        return dateStr;
    }

    const [datePart, timePart] = dateStr.split(' ');    
    const [day, month, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');
    // Month is 0-indexed
    const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    return dateObj.toISOString();
}
function convertToCustomFormat(isoDateStr) {
    const dateObj = new Date(isoDateStr);

    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed, so add 1
    const year = dateObj.getUTCFullYear();

    const hours = String(dateObj.getUTCHours()).padStart(2, '0');
    const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getUTCSeconds()).padStart(2, '0');

    // Format the date and time as DD/MM/YYYY HH:MM:SS
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

async function updateUserPlayFabData(playFabId, newSubData, subDataKey) {
    const apiUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/UpdateUserData`;

    try {
        const response = await axios.post(apiUrl, {
            PlayFabId: playFabId,
            Data: {
                [subDataKey]: JSON.stringify(newSubData)
            },
            Permission: "Public"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
            }
        });

        console.log(`Successfully updated data for user ${playFabId}:`, response.data);
    } catch (error) {
        console.error(`Error updating data for user ${playFabId}:`, error.response ? error.response.data : error.message);
    }
}
let newSubData = {
    Platform: "Android",
    Product: 'immersify.gold_yearly',
    PurchaseDate: '',
    SubStatus: 'renewing',
    SubExpire: '01/08/2124 00:00:00', 
    SubActive: "true",
    SubscriptionTier: "legacy",
    SubscriptionPeriod: "yearly"
};
//testing
//updateUserPlayFabData('AB9587E5252E5A90', newSubData, 'OtherSubData');

module.exports = {
    bulkRouter,
    getJobInProgress,
    getAllS3AccData,
    setAllS3AccData,
    getLastDateGotAllS3AccData,
    setLastDateGotAllS3AccData,
    getAllPlayerAccDataAndWriteToDB,
    updateDatabase,
    getAllPlayerEventLogsWriteToDB
};