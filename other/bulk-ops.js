const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const bulkRouter = express.Router();

const { extractAndSetJsonValue } = require('../database/database');

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

async function updateDatabase(){
    console.log("getting all player segment and writing to db...");
    await getAllPlayerAccDataAndWriteToDB();
    console.log("updating account data fields...");
    await extractAndSetJsonValue('AccountData', 'AccountDataJSON', 'PlayerId', 'PlayFabId').catch(err => console.error(err));
    console.log("getting all usage data and writing to db...");
    await updateUsageDataInDB();
    console.log("updating usage data fields");
    await extractAndSetJsonValue('UsageData', 'UsageDataJSON', 'PlayFabId', 'PlayFabId').catch(err => console.error(err));
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
        console.log("updated db " , contToken);

        contToken = response.data.data.ContinuationToken;

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
            const results = await processBatch(currentBatch);

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
//updateUsageDataInDB(); // DONE 18:49 09/04/2024

async function processBatch(playerIds) {
    const fetchPromises = playerIds.map(playerId => fetchPlayerData(playerId).then(data => ({
        playerId,
        data,
    })));

    return Promise.all(fetchPromises);
}

async function fetchPlayerData(playerId) {
    console.log(playerId);
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

module.exports = {
    bulkRouter,
    getJobInProgress,
    getAllS3AccData,
    setAllS3AccData,
    getLastDateGotAllS3AccData,
    setLastDateGotAllS3AccData,
    getAllPlayerAccDataAndWriteToDB
};