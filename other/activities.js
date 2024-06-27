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
activitiesRouter.get('/get-users-by-activity', async (req, res) => {
    const activityIds = req.query.activities ? req.query.activities.split(',') : [];

    if (activityIds.length === 0) {
        return res.status(400).json({ message: 'Missing activities parameter or it is empty.' });
    }

    const query = `
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
                ("UsageDataJSON"->'Data'->'PlayerData'->>'Value')::jsonb->'activities'
            ) as activity
            WHERE activity->>'activityID' = ANY($1::text[])
        )
    `;

    const queryParams = [activityIds];

    try {
        const { rows } = await pool.query(query, queryParams);
        const allPlayersWithActivity = new Map(activityIds.map(id => [id, new Set()]));

        rows.forEach(row => {
            const playerDataRAW = row.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
            if (playerDataRAW) {
                try {
                    const playerDataJSON = JSON.parse(playerDataRAW);
                    if (Array.isArray(playerDataJSON.activities)) {
                        playerDataJSON.activities.forEach(activity => {
                            if (allPlayersWithActivity.has(activity.activityID)) {
                                allPlayersWithActivity.get(activity.activityID).add({
                                    user: row
                                });
                            }
                        });
                    }
                } catch (err) {
                    console.error('Error parsing JSON:', err);
                }
            }
        });

        const outputList = [];
        allPlayersWithActivity.forEach((players, activityId) => {
            const totalPlays = calcTotalPlaysPerActivity(Array.from(players), activityId);
            const output = {
                activityID: activityId,
                activityName: activityId, // TODO: get activity title
                uniquePlays: players.size,
                plays: totalPlays,
                users: Array.from(players).map(player => ({
                    ...player.user,
                    accountData: player.accountData
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

function calcTotalPlaysPerActivity(allPlayersWithActivity, activityId) {
    let totalPlays = 0;

    allPlayersWithActivity.forEach(player => {
        try {
            let playerDataRAW = player.user.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
            if (playerDataRAW) {
                let playerData = JSON.parse(playerDataRAW);
                let activities = playerData.activities ?? [];
                activities.forEach(activity => {
                    if (activityId == activity.activityID) {
                        totalPlays += activity.plays.length;
                    }
                });
            }
        } catch (err) {
            console.error('Error processing player data:', err, player);
        }
    });

    return totalPlays;
}

module.exports = activitiesRouter;