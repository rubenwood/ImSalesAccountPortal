const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const bulkRouter = express.Router();
const fs = require('fs').promises;

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
async function updateDatabase(){
    console.log("getting all player segment and writing to db...");
    // get account data from playfab and write to DB
    await getAllPlayerAccDataAndWriteToDB(); 
    console.log("updating account data fields...");
    // extract out the PlayerId field and make that a separate column PlayFabId, also store the playfab data in AccountDataJSON
    await extractAndSetJsonValue('AccountData', 'AccountDataJSON', 'PlayerId', 'PlayFabId').catch(err => console.error(err));
    console.log("getting all usage data and writing to db...");
    // get usage data (Player Title Data) from playfab and write to DB
    await updateUsageDataInDB();
    console.log("updating usage data fields");
    // extract out the PlayFabId field and make that a separate column PlayFabId, also store the playfab data in UsageDataJSON
    await extractAndSetJsonValue('UsageData', 'UsageDataJSON', 'PlayFabId', 'PlayFabId').catch(err => console.error(err));
    await extractAndSetJsonValue('UsageData', 'UsageDataJSON', 'AcademicArea', 'AcademicArea').catch(err => console.error(err));
    // set the last updated date (json file)
    OnUpdateCompletion(new Date());
}
async function OnUpdateCompletion(date) {
    const data = JSON.stringify({ LastUpdatedDate: date.toISOString() }, null, 2);
    await fs.writeFile('./public/DatabaseLastUpdated.json', data);
    console.log("Completion date recorded.");
}

let getPlayerAccDataJobInProgress = false;
async function getAllPlayerAccDataAndWriteToDB() {
    let contToken = null;
    let timestamp = new Date();
    console.log(`Getting all players ${timestamp}`);

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

        // Insert the player profiles into the PostgreSQL table
        console.log("updating ", response.data.data.PlayerProfiles.length, " entries");
        for (const profile of response.data.data.PlayerProfiles) {
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
        let maxConcurrentRequests = 20;
        for (let i = 0; i < playerIds.length; i += maxConcurrentRequests) {
            const currentBatch = playerIds.slice(i, i + maxConcurrentRequests);
            console.log(`Processing batch ${(i / maxConcurrentRequests) + 1} of ${Math.ceil(playerIds.length / maxConcurrentRequests)}: Processing ${currentBatch.length} player IDs.`);
            const results = await processBatch(currentBatch); // make this faster?

            for (const { playerId, data } of results) {
                if (data) {
                    await client.query(
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
async function extractAndSetJsonValue(tableName, jsonColumnName, keyName, newColumnName) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Add the new column if it doesn't exist
        await client.query(`
            ALTER TABLE "${tableName}"
            ADD COLUMN IF NOT EXISTS "${newColumnName}" TEXT;
        `);

        // Extract value from the JSON column and set it in the new column
        await client.query(`
            UPDATE "${tableName}"
            SET "${newColumnName}" = ("${jsonColumnName}"->>'${keyName}')::TEXT;
        `);

        await client.query('COMMIT');
        console.log(`${newColumnName} column has been successfully updated with ${keyName} values from ${jsonColumnName}.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error occurred:', error);
    } finally {
        client.release();
    }
}

// CONVERT STRIPE SUB
async function convertStripeSubData() {
    const stripeDataQuery = `
    SELECT *
    FROM public."UsageData"
    WHERE
        ("UsageDataJSON"->'Data'->'ProductInterval'->>'Value') IS NOT NULL OR
        ("UsageDataJSON"->'Data'->'StripeSubscriptionID'->>'Value') IS NOT NULL OR
        ("UsageDataJSON"->'Data'->'ReceiptStripeActiveUntilDate'->>'Value') IS NOT NULL
    `;

    const res = await pool.query(stripeDataQuery);
    const stripeSubUsers = res.rows;

    stripeSubUsers.forEach(user => {
        let userProdInterval = user.UsageDataJSON.Data.ProductInterval?.Value;
        let userProdExpiry = user.UsageDataJSON.Data.ReceiptStripeActiveUntilDate?.Value;

        if (!userProdInterval || !userProdExpiry) {
            console.log(`Skipping user ${user.UsageDataJSON.PlayFabId} due to missing ProductInterval or ReceiptStripeActiveUntilDate`);
            return;
        }

        let interval = 30;
        if (userProdInterval === "yearly") {
            interval = 365;
        }

        // Convert expiry date string to Date object
        let expiryDate = new Date(userProdExpiry);

        // Subtract interval to get purchase date
        let purchaseDate = new Date(expiryDate);
        purchaseDate.setDate(expiryDate.getDate() - interval);
        let now = new Date();
        let status = "renewing";
        let isSubbed = true;
        if (now > expiryDate) {
            // if now is beyond expiry date
            isSubbed = false;
            status = "expired";
        }

        // Format dates to the desired format
        const formatDate = (date) => {
            return date.toISOString().split('T')[0]; // YYYY-MM-DD format
        };

        let newSubData = {
            Platform: "stripe",
            Product: userProdInterval,
            PurchaseDate: formatDate(purchaseDate),
            SubStatus: status,
            SubExpire: formatDate(expiryDate), // when this will expire / renew  
            SubActive: isSubbed ? "true" : "false",
            SubscriptionTier: "legacy",
            SubscriptionPeriod: userProdInterval
        };

        console.log(user.UsageDataJSON.PlayFabId, " ", newSubData);

        // playfab api call to add the StoreSubData to the users account
    });

    return stripeSubUsers;
}
convertStripeSubData();

module.exports = {
    bulkRouter,
    getJobInProgress,
    getAllS3AccData,
    setAllS3AccData,
    getLastDateGotAllS3AccData,
    setLastDateGotAllS3AccData,
    getAllPlayerAccDataAndWriteToDB,
    updateDatabase
};