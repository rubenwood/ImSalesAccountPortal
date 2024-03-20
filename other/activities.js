const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const activitiesRouter = express.Router();

// Modified route that takes in an array of query param get-activity-report-id?activities=activity_id1,activity_id2
activitiesRouter.get('/get-activity-report-id', async (req, res) => {
    console.log("called");
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.SERVER_SEC) {
        return res.status(401).json({ message: 'Invalid or missing secret.' });
    }

    // first get a batch of playerdata (/analytics/playerdata/*)
    // .Data.PlayerData.activities for each of these, check if we match any of the input activityIds
    // if so, add that entry (user) to a list, this will give us the number of unique plays per activity

    try {
        let activityIds = req.query.activities.split(',');
        console.log(activityIds);

        const config = {
            headers: {
                'x-secret-key': process.env.SERVER_SEC
            }
        };

        const response = await axios.get(`http://${process.env.SERVER_URL}:${process.env.PORT}/db/playerdata?limit=1000`, config);
        const respDataRows = response.data;
        
        let listOfPlayersWithActivity = [];
        
        // the response data is an array of rows from the "PlayerData" table, 
        // each has a "PlayerDataJSON" field/column, which encapsulates the useful data
        // for each row in respDataRows, check in .PlayerDataJSON.Data.PlayerData.Value
        for(const row of respDataRows){
            let playerData = row.PlayerDataJSON?.Data?.PlayerData ?? undefined;
            if(playerData){
                let playerDataToJson = JSON.parse(playerData.Value);
                let playerActivities = playerDataToJson.activities;
                // if playerActivities contains any of the activityIds then add row to listOfPlayersWithActivity
                console.log(activityIds);
                console.log(playerActivities);
                // Map playerActivities to an array of activityIDs
                const playerActivityIds = playerActivities.map(activity => activity.activityID);

                // Check if playerActivityIds contains any of the input activityIds
                const hasMatchingActivity = playerActivityIds.some(activityId => activityIds.includes(activityId));

                if (hasMatchingActivity) {listOfPlayersWithActivity.push(row);}
     
                console.log("\n--------------------\n");
            }else{

            }
        }
        console.log(listOfPlayersWithActivity.length);
        res.json(listOfPlayersWithActivity);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});


module.exports = activitiesRouter;