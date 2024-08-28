const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const activitiesRouter = express.Router();
const { Pool } = require('pg');

const { getTotalUsageRowCount } = require('../database/database');

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

// Modified route that takes in an array of query param get-activity-report-id?activities=activity_id1,activity_id2
// dentalID_prac,instrumentID_prac
activitiesRouter.get('/get-activity-report-id', async (req, res) => {
    console.log("called");

    try {
        const activityIds = req.query.activities.split(',');
        const config = { headers: { 'x-secret-key': process.env.SERVER_SEC } };
        const chunkSize = 10000;
        let totalErrors = 0;
        let allPlayersWithActivity = new Map(activityIds.map(id => [id, new Set()]));

        async function processChunk(startRow) {
            try {
                let url = `http://${process.env.SERVER_URL}:${process.env.PORT}/db/usagedata`+
                `?start=${startRow}&end=${startRow + chunkSize - 1}`;
                const response = await axios.get(url, config);
                const respDataRows = response.data;

                let errorAmount = 0;

                for (const row of respDataRows) {
                    try {
                        console.log(row);
                        let playerData = row.UsageDataJSON?.Data?.PlayerData ?? undefined;
                        if (playerData) {
                            let playerDataToJson = JSON.parse(playerData.Value);
                            let playerActivities = playerDataToJson.activities;
                            playerActivities.forEach(activity => {
                                if (activityIds.includes(activity.activityID)) {
                                    allPlayersWithActivity.get(activity.activityID).add(row);
                                }
                            });
                        }
                    } catch (error) {
                        errorAmount++;
                        console.error('Error processing player data:', error);
                    }
                }
                return { errorAmount };
            } catch (error) {
                console.error('Error processing chunk:', error.message);
                return { errorAmount: 1 }; // Assuming 1 error if chunk processing fails
            }
        }

        // Determine the total number of chunks required
        const totalRows = await getTotalUsageRowCount();
        console.log(`total rows: ${totalRows}`);
        const totalChunks = Math.ceil(totalRows / chunkSize);
        const chunkPromises = [];

        for (let i = 0; i < totalChunks; i++) {
            const startRow = i * chunkSize;
            chunkPromises.push(processChunk(startRow));
        }

        // Process all chunks concurrently
        console.log("processing....");
        const results = await Promise.all(chunkPromises);
        results.forEach(({ errorAmount }) => {
            totalErrors += errorAmount;
        });

        let outputList = [];
        allPlayersWithActivity.forEach((players, activityId) => {
            let totalPlays = calcTotalPlaysPerActivity(Array.from(players), activityId);
            let output = {
                activityID: activityId,
                activityName: activityId,// TODO: get activity title
                uniquePlays: players.size,
                plays: totalPlays,
                users: Array.from(players)
            }
            outputList.push(output);
        });

        console.log(`Processed ${totalChunks} chunks (chunk size: ${chunkSize} rows) with ${totalErrors} errors.`);

        res.json(outputList);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

// GET USER BY ACTIVITY ID
activitiesRouter.get('/get-users-by-activity-id', async (req, res) => {
    const activityIds = req.query.activities ? req.query.activities.split(',') : [];

    if (activityIds.length === 0) {
        return res.status(400).json({ message: 'Missing activities parameter or it is empty.' });
    }

    const query1 = `
        WITH valid_usage_data AS (
            SELECT *
            FROM public."UsageData"
            WHERE ("UsageDataJSON"->'Data'->'PlayerData'->>'Value') IS NOT NULL
              AND ("UsageDataJSON"->'Data'->'PlayerData'->>'Value')::jsonb IS NOT NULL
              AND ("UsageDataJSON"->'Data'->'PlayerData'->>'Value') NOT LIKE '%NaN%'
        ),
        user_activity_data AS (
            SELECT 
                vud.*, 
                ad."AccountDataJSON"
            FROM valid_usage_data vud
            JOIN public."AccountData" ad ON vud."PlayFabId" = ad."PlayFabId"
        )
        SELECT *
        FROM user_activity_data
        WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
                ("UsageDataJSON"->'Data'->'PlayerData'->>'Value')::jsonb->'activities') as activity
            WHERE activity->>'activityID' = ANY($1::text[])
        )
    `;

    const query2 = `
        WITH valid_usage_data AS (
            SELECT *
            FROM public."UsageData"
            WHERE ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') IS NOT NULL
              AND ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value')::jsonb IS NOT NULL
              AND ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') NOT LIKE '%NaN%'
        ),
        user_activity_data AS (
            SELECT 
                vud.*, 
                ad."AccountDataJSON"
            FROM valid_usage_data vud
            JOIN public."AccountData" ad ON vud."PlayFabId" = ad."PlayFabId"
        )
        SELECT *
        FROM user_activity_data
        WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
                ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value')::jsonb->'activities') as activity
            WHERE activity->>'activityID' = ANY($1::text[])
        )
    `;

    const queryParams = [activityIds];

    try {
        const [result1, result2] = await Promise.all([
            pool.query(query1, queryParams),
            pool.query(query2, queryParams)
        ]);

        const rows1 = result1.rows;
        const rows2 = result2.rows;
        const combinedRows = [...rows1, ...rows2];

        const allPlayersWithActivity = new Map(activityIds.map(id => [id, { players: new Map(), activityTitle: null }]));

        combinedRows.forEach(row => {
            const playerDataRAW = row.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
            const playerDataNewLauncherRAW = row.UsageDataJSON?.Data?.PlayerDataNewLauncher?.Value ?? undefined;
            processPlayerDataIds(playerDataRAW, row, allPlayersWithActivity);
            processPlayerDataIds(playerDataNewLauncherRAW, row, allPlayersWithActivity);
        });

        const firstElement = Array.from(allPlayersWithActivity.values())[0];
        console.log("Number of players in the first element:", firstElement.players.size);

        const outputList = [];
        allPlayersWithActivity.forEach((activityData, activityId) => {
            const players = Array.from(activityData.players.values());
            const totalPlays = calcTotalPlaysPerActivity(players, activityId);
            const output = {
                activityID: activityId,
                activityName: activityData.activityTitle,
                uniquePlays: players.length,
                plays: totalPlays,
                users: players.map(player => ({
                    ...player.user,
                    accountData: player.accountData,
                }))
            };
            outputList.push(output);
        });

        res.json(outputList);
    } catch (err) {
        console.error('Error fetching usage data from db:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
function processPlayerDataIds(playerDataInput, rowInput, allPlayersWithActivityInput) {
    if (playerDataInput == undefined) { return; }

    try {
        const playerDataJSON = JSON.parse(playerDataInput);
        if (Array.isArray(playerDataJSON.activities)) {
            playerDataJSON.activities.forEach(activity => {
                const activityId = activity.activityID;
                if (allPlayersWithActivityInput.has(activityId)) {
                    const activityData = allPlayersWithActivityInput.get(activityId);
                    const playersMap = activityData.players;
                    
                    if (!playersMap.has(rowInput.PlayFabId)) {
                        playersMap.set(rowInput.PlayFabId, {
                            user: rowInput,
                            accountData: rowInput.AccountDataJSON,
                        });
                    }
                    
                    // Ensure activityTitle is also stored for this activityID
                    if (!activityData.activityTitle) {
                        activityData.activityTitle = activity.activityTitle;
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error parsing JSON:', err);
    }
}


// TODO: Get activities by title
activitiesRouter.get('/get-users-by-activity-title', async (req, res) => {
    const activityTitles = req.query.activities ? req.query.activities.split(',') : [];

    if (activityTitles.length === 0) {
        return res.status(400).json({ message: 'Missing activities parameter or it is empty.' });
    }

    const queryToFetchIDs = `
        WITH all_activities AS (
            SELECT 
                activity->>'activityID' AS "activityID",
                activity->>'activityTitle' AS "activityTitle"
            FROM public."UsageData", jsonb_array_elements(("UsageDataJSON"->'Data'->'PlayerData'->>'Value')::jsonb->'activities') as activity
            WHERE ("UsageDataJSON"->'Data'->'PlayerData'->>'Value') IS NOT NULL
            AND ("UsageDataJSON"->'Data'->'PlayerData'->>'Value') NOT LIKE '%NaN%'

            UNION ALL

            SELECT 
                activity->>'activityID' AS "activityID",
                activity->>'activityTitle' AS "activityTitle"
            FROM public."UsageData", jsonb_array_elements(("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value')::jsonb->'activities') as activity
            WHERE ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') IS NOT NULL
            AND ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') NOT LIKE '%NaN%'
        )
        SELECT DISTINCT "activityID"
        FROM all_activities
        WHERE "activityTitle" = ANY($1::text[]);
    `;

    const createJsonbTryCastFunction = `
        CREATE OR REPLACE FUNCTION jsonb_try_cast(text)
        RETURNS jsonb AS $$
        BEGIN
            RETURN $1::jsonb;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    `;

    const queryToFetchUsers = `
        WITH valid_usage_data AS (
            SELECT *
            FROM public."UsageData"
            WHERE jsonb_try_cast("UsageDataJSON"->'Data'->'PlayerData'->>'Value') IS NOT NULL
            AND ("UsageDataJSON"->'Data'->'PlayerData'->>'Value') NOT LIKE '%NaN%'
            
            UNION ALL
            
            SELECT *
            FROM public."UsageData"
            WHERE jsonb_try_cast("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') IS NOT NULL
            AND ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') NOT LIKE '%NaN%'
        ),
        user_activity_data AS (
            SELECT 
                vud.*, 
                ad."AccountDataJSON"
            FROM valid_usage_data vud
            JOIN public."AccountData" ad ON vud."PlayFabId" = ad."PlayFabId"
        )
        SELECT *
        FROM user_activity_data
        WHERE EXISTS (
            SELECT 1
            FROM (
                SELECT activity
                FROM jsonb_array_elements(
                    COALESCE(
                        jsonb_try_cast("UsageDataJSON"->'Data'->'PlayerData'->>'Value')->'activities',
                        '[]'::jsonb
                    )
                ) AS activity
                WHERE activity->>'activityID' = ANY($1::text[])
            ) valid_activity_data
            
            UNION ALL
            
            SELECT 1
            FROM (
                SELECT activity
                FROM jsonb_array_elements(
                    COALESCE(
                        jsonb_try_cast("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value')->'activities',
                        '[]'::jsonb
                    )
                ) AS activity
                WHERE activity->>'activityID' = ANY($1::text[])
            ) valid_activity_data
        );
    `;

    try {
        // Create the jsonb_try_cast function if it doesn't exist
        await pool.query(createJsonbTryCastFunction);

        // Query to get ids by title
        const resultIDs = await pool.query(queryToFetchIDs, [activityTitles]);
        const activityIds = resultIDs.rows.map(row => row.activityID);
        if (activityIds.length === 0) {
            return res.json([]); // No activities found
        }

        // Uses activity ids to get the users who have played an activity with that id
        const resultUsers = await pool.query(queryToFetchUsers, [activityIds]);

        // Process the combined results
        const allPlayersWithActivity = new Map();

        resultUsers.rows.forEach(row => {
            const playerDataRAW = row.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
            const playerDataNewLauncherRAW = row.UsageDataJSON?.Data?.PlayerDataNewLauncher?.Value ?? undefined;

            processPlayerDataIDs(playerDataRAW, activityIds, row, allPlayersWithActivity);
            processPlayerDataIDs(playerDataNewLauncherRAW, activityIds, row, allPlayersWithActivity);
        });

        const outputList = [];
        allPlayersWithActivity.forEach(activityData => {
            const players = Array.from(activityData.players.values());
            const totalPlays = calcTotalPlaysPerActivity(players, activityData.activityID);
            const output = {
                activityID: activityData.activityID,
                activityName: activityData.activityTitle,
                uniquePlays: players.length,
                plays: totalPlays,
                users: players.map(player => ({
                    ...player.user,
                    accountData: player.accountData,
                }))
            };
            outputList.push(output);
        });

        res.json(outputList);
    } catch (err) {
        console.error('Error fetching usage data from db:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
function processPlayerDataIDs(playerDataInput, activityIdsInput, rowInput, allPlayersWithActivityInput){
    if (playerDataInput == undefined) { return; }

    try {
        const playerDataJSON = JSON.parse(playerDataInput);
        if (Array.isArray(playerDataJSON.activities)) {
            playerDataJSON.activities.forEach(activity => {
                const id = activity.activityID;

                if (activityIdsInput.includes(id)) {
                    const key = `${id}`; // Use ID as the key

                    if (!allPlayersWithActivityInput.has(key)) {
                        allPlayersWithActivityInput.set(key, {
                            activityID: id,
                            activityTitle: activity.activityTitle || "", // Handle empty titles
                            players: new Map(),
                        });
                    }

                    const activityData = allPlayersWithActivityInput.get(key);
                    const playersMap = activityData.players;

                    if (!playersMap.has(rowInput.PlayFabId)) {
                        playersMap.set(rowInput.PlayFabId, {
                            user: rowInput,
                            accountData: rowInput.AccountDataJSON,
                        });
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error parsing JSON:', err);
    }
}
function processPlayerDataTitles(playerDataInput, activityTitlesInput, rowInput, allPlayersWithActivityInput){
    if (playerDataInput == undefined) { return; }

    try {
        const playerDataJSON = JSON.parse(playerDataInput);
        if (Array.isArray(playerDataJSON.activities)) {
            playerDataJSON.activities.forEach(activity => {
                const title = activity.activityTitle;
                const id = activity.activityID;

                if (activityTitlesInput.includes(title)) {
                    const key = `${title}-${id}`; // Composite key for uniqueness

                    if (!allPlayersWithActivityInput.has(key)) {
                        allPlayersWithActivityInput.set(key, {
                            activityID: id,
                            activityTitle: title,
                            players: new Map(),
                        });
                    }

                    const activityData = allPlayersWithActivityInput.get(key);
                    const playersMap = activityData.players;

                    if (!playersMap.has(rowInput.PlayFabId)) {
                        playersMap.set(rowInput.PlayFabId, {
                            user: rowInput,
                            accountData: rowInput.AccountDataJSON,
                        });
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error parsing JSON:', err);
    }
}

function calcTotalPlaysPerActivity(allPlayersWithActivity, activityId) {
    let totalPlays = 0;

    allPlayersWithActivity.forEach(player => {
        try {
            let playerDataRAW = player.user.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
            let playerDataNewLauncherRAW = player.user.UsageDataJSON?.Data?.PlayerDataNewLauncher?.Value ?? undefined;
            totalPlays += processTotalPlays(playerDataRAW, activityId);
            totalPlays += processTotalPlays(playerDataNewLauncherRAW, activityId);
        } catch (err) {
            console.error('Error processing player data:', err, player);
        }
    });

    return totalPlays;
}
function processTotalPlays(inputPlayerData, activityId){
    if(inputPlayerData == undefined){ return 0; } 
    let totalPlays = 0;

    let playerData = JSON.parse(inputPlayerData);
    let activities = playerData.activities ?? [];
    activities.forEach(activity => {
        if (activityId == activity.activityID) {
            totalPlays += activity.plays.length;
        }
    });
    return totalPlays;
}

module.exports = activitiesRouter;