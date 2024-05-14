const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const activitiesRouter = express.Router();

const { getTotalUsageRowCount } = require('../database/database');

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

function calcTotalPlaysPerActivity(allPlayersWithActivity, activityId){
    let totalPlays = 0;
    allPlayersWithActivity.forEach(player => {
        //console.log("----\n", player.UsageDataJSON?.Data?.PlayerData, "\n----");
        let playerDataRAW =  player.UsageDataJSON?.Data?.PlayerData?.Value ?? undefined;
        let playerData = JSON.parse(playerDataRAW);
        let activities = playerData.activities ?? undefined;
        if(activities == undefined){ 
            //console.log("~~~\n", player, "\n~~~"); 
            return totalPlays;
        }else{
            activities.forEach(activity => {
                if(activityId == activity.activityID){
                    totalPlays += activity.plays.length;
                }             
            });
        }
    });
    //console.log(totalPlays);
    return totalPlays;
}

module.exports = activitiesRouter;