const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const activitiesRouter = express.Router();

const { getTotalRowCount } = require('../database/database');

// Modified route that takes in an array of query param get-activity-report-id?activities=activity_id1,activity_id2
activitiesRouter.get('/get-activity-report-id', async (req, res) => {
    console.log("called");

    try {
        const activityIds = req.query.activities.split(',');
        const config = { headers: { 'x-secret-key': process.env.SERVER_SEC } };
        const chunkSize = 10000;
        let totalErrors = 0;
        let allPlayersWithActivity = [];

        async function processChunk(startRow) {
            try {
                let url = `http://${process.env.SERVER_URL}:${process.env.PORT}/db/playerdata`+
                `?start=${startRow}&end=${startRow + chunkSize - 1}`;
                const response = await axios.get(url, config);
                const respDataRows = response.data;
                let playersWithActivity = [];
                let errorAmount = 0;

                for (const row of respDataRows) {
                    try {
                        let playerData = row.PlayerDataJSON?.Data?.PlayerData ?? undefined;
                        if (playerData) {
                            let playerDataToJson = JSON.parse(playerData.Value);
                            let playerActivities = playerDataToJson.activities;
                            const playerActivityIds = playerActivities.map(activity => activity.activityID);
                            const hasMatchingActivity = playerActivityIds.some(activityId => activityIds.includes(activityId));
                            if (hasMatchingActivity) { playersWithActivity.push(row); }
                        }
                    } catch (error) {
                        errorAmount++;
                        console.error('Error processing player data:', error);
                    }
                }
                return { playersWithActivity, errorAmount };
            } catch (error) {
                console.error('Error processing chunk:', error.message);
                return { playersWithActivity: [], errorAmount: 1 }; // Assuming 1 error if chunk processing fails
            }
        }

        // Determine the total number of chunks required
        const totalRows = await getTotalRowCount();
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
        results.forEach(({ playersWithActivity, errorAmount }) => {
            allPlayersWithActivity = allPlayersWithActivity.concat(playersWithActivity); // this only works for 1 activity?
            totalErrors += errorAmount;
        });

        console.log(`Processed ${totalChunks} chunks (chunk size: ${chunkSize} rows) with ${totalErrors} errors.
        \nTotal users who played ${activityIds} = ${allPlayersWithActivity.length} (of ${totalRows})`);

        let outputList = [];
        for(const activityId of activityIds){
            // can get the activity title like this too
            let totalPlays = calcTotalPlaysPerActivity(allPlayersWithActivity, activityId);
            let output = {
                activityID:activityId,
                activityName:activityId,
                uniquePlays:allPlayersWithActivity.length,
                plays:totalPlays,
                users:allPlayersWithActivity
            }
            outputList.push(output);
        }

        res.json(outputList);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

function calcTotalPlaysPerActivity(allPlayersWithActivity, activityId){
    let totalPlays = 0;
    allPlayersWithActivity.forEach(player => {
        let playerDataJSON = player.PlayerDataJSON;
        let playerData = JSON.parse(playerDataJSON.Data.PlayerData.Value);
        //console.log("----");
        let activities = playerData.activities;
        activities.forEach(activity => {
            if(activityId == activity.activityID){
                totalPlays += activity.plays.length;
            }             
        });
        //console.log(activities);
    });
    return totalPlays;
}

module.exports = activitiesRouter;