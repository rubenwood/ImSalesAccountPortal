const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const userDataRouter = express.Router();
const { Pool } = require('pg');

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

// Event Log
async function getUsersEventLog(startDate, endDate) {
    const startDateStr = new Date(startDate).toISOString().slice(0, 10); // YYYY-MM-DD format
    const endDateStr = new Date(endDate).toISOString().slice(0, 10);

    // Now involves the account data & usage data
    const usersEventLogQuery = `
        SELECT "UserEventLogs"."PlayFabId", "UserEventLogs"."EventLogKey", 
               "UserEventLogs"."EventLogJSON", "UserEventLogs"."EventLogDate", 
               "AccountData"."AccountDataJSON" AS "AccountDataJSON"
        FROM public."UserEventLogs"
        JOIN public."AccountData" 
        ON "UserEventLogs"."PlayFabId" = "AccountData"."PlayFabId"
        WHERE "UserEventLogs"."EventLogDate" BETWEEN $1 AND $2
    `;

    const result = await pool.query(usersEventLogQuery, [startDateStr, endDateStr]);

    // Group results by PlayFabId and EventLogKeys
    const usersEventLogs = result.rows.reduce((acc, row) => {
        const { PlayFabId, EventLogKey, EventLogJSON, EventLogDate, AccountDataJSON } = row;
        
        // Find or create an entry for the PlayFabId
        let userEntry = acc.find(entry => entry.PlayFabId === PlayFabId);
        if (!userEntry) {
            userEntry = { PlayFabId, EventLogs: [], AccountDataJSON };
            acc.push(userEntry);
        }

        // Add the current log data to the user's EventLogs array
        userEntry.EventLogs.push({ EventLogKey, EventLogJSON, EventLogDate });
        return acc;
    }, []);

    return usersEventLogs;
}
userDataRouter.post('/get-users-event-log', async (req, res) => {
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    const usersEventLog = await getUsersEventLog(startDate, endDate);
    res.json(usersEventLog);
});

// Users Topics in Feed
async function getUsersWithTopicInFeed(topicIds) {
    const usersWithTopicsQuery = `
        SELECT *, 
               jsonb_array_elements(("UsageDataJSON"->'Data'->'UserPreferenceData'->>'Value')::jsonb->'selectedTopics') AS selectedTopic
        FROM public."UsageData"
        WHERE EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
                ("UsageDataJSON"->'Data'->'UserPreferenceData'->>'Value')::jsonb->'selectedTopics'
            ) AS selectedTopic
            WHERE selectedTopic->'selectedTopicsList' ?| $1
        )
    `;
    const result = await pool.query(usersWithTopicsQuery, [topicIds]);

    const output = [];
    for (const topicId of topicIds) {
        const usersWithTopic = result.rows.filter(row => {
            const selectedTopics = JSON.parse(row.UsageDataJSON.Data.UserPreferenceData.Value).selectedTopics;
            // debugging
            //selectedTopics.forEach(selTop => console.log(selTop.selectedTopicsList));
            return selectedTopics.some(topic => topic.selectedTopicsList.includes(topicId));
        }).map(row => row.PlayFabId);

        output.push({
            topicId: topicId,
            users: usersWithTopic
        });
    }

    return output;
}
userDataRouter.post('/get-users-topic-feed', async (req, res) => {
    const newRetUsers = await getUsersWithTopicInFeed(req.body.topicIds);
    res.json(newRetUsers);
});

// New Vs. Returning
async function getNewReturningUsers(startDate, endDate){
    const startDateStr = new Date(startDate).toISOString();
    const endDateStr = new Date(endDate).toISOString();

    // new-user = created within time frame and logins are on same day as creation
    // new-returning = created within time frame but logged after the created date
    // not-new-returning = logged in within time frame but not created withing time frame    

    // get all users created on or after the start date (and before the end date)

    // created within time frame
    const newUsersQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz;
    `;

    // created within time frame & created day & last login day are the same (brand new)
    /*const newUsersNotReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz
    AND date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS')) 
        = date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS'));
    `;*/

    // created within time frame & last login date is more recent than created date (new, but returned)
    /*const newReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz
    AND date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS')) 
        > date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS'));
    `;*/

    // Updated any data outside of timeframe (therefore returning, but will also include new users, so we filter them out on frontend)
    const notNewReturningQuery = `
    SELECT * FROM public."UsageData"
    WHERE 
        EXISTS (
            SELECT 1
            FROM jsonb_each_text("UsageDataJSON"::jsonb->'Data') AS data(key, value)
            WHERE 
                to_timestamp(REPLACE(value::jsonb->>'LastUpdated', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') >= '${startDateStr}'::timestamptz
            AND 
                to_timestamp(REPLACE(value::jsonb->>'LastUpdated', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') <= '${endDateStr}'::timestamptz
        );
    `;

    const [newUsersResult, 
        //newUsersNotReturningResult, 
        //newReturningResult,
        notNewReturningResult] = await Promise.all([
            pool.query(newUsersQuery),
            //pool.query(newUsersNotReturningQuery), 
            //pool.query(newReturningQuery),
            pool.query(notNewReturningQuery)
        ]);

    const output = { 
        startDate,
        endDate,
        newUsers: newUsersResult.rows,
        returningUsers: notNewReturningResult.rows // returning, but includes new as well (filtered out on FE)
    };
    console.log(output.returningUsers);

    return output;
}
userDataRouter.post('/get-new-returning-users', async (req, res) => {
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    const newRetUsers = await getNewReturningUsers(startDate, endDate);
    res.json(newRetUsers);
});


// Users with Session Debug Data
// TODO: paginate this!
async function getAllUsersSessionDebugData(){
    const sessionQuery = `
        SELECT "UsageDataJSON"
        FROM public."UsageData"
        WHERE "UsageDataJSON"::text LIKE '%"SessionDebugData"%'
    `;
    const sessionResult = await pool.query(sessionQuery);

    return sessionResult.rows;
}
userDataRouter.post('/get-session-data', async (req, res) => {
    const sessionData = await getAllUsersSessionDebugData();
    res.json(sessionData);
});

// Get Users Session Debug Data
async function getUsersSessionDebugData(playFabIds){
    if (!Array.isArray(playFabIds) || playFabIds.length === 0) {
        return [];
    }
    const sessionQuery = `
        SELECT "PlayFabId", "UsageDataJSON"->'Data'->'SessionDebugData'->'Value' AS "SessionDebugData"
        FROM public."UsageData"
        WHERE "PlayFabId" = ANY($1) 
        AND "UsageDataJSON"::text LIKE '%"SessionDebugData"%'
    `;
    const sessionResult = await pool.query(sessionQuery, [playFabIds]);
    return sessionResult.rows;
}
userDataRouter.post('/get-users-session-data', async (req, res) => {
    const playFabIds = req.body.playFabIds;
    const sessionData = await getUsersSessionDebugData(playFabIds);
    const parsedSessionData = sessionData.map(player => ({
        ...player,
        SessionDebugData: JSON.parse(player.SessionDebugData)
    }));
    res.json(parsedSessionData);
});

// Get Users Player Data New Launcher
async function getUsersPLayerData(playFabIds){
    if (!Array.isArray(playFabIds) || playFabIds.length === 0) {
        return [];
    }
    const playerDataQuery = `
        SELECT "PlayFabId", "UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->'Value' AS "PlayerDataNewLauncher"
        FROM public."UsageData"
        WHERE "PlayFabId" = ANY($1) 
        AND "UsageDataJSON"::text LIKE '%"PlayerDataNewLauncher"%'
    `;
    const playerDataResult = await pool.query(playerDataQuery, [playFabIds]);
    return playerDataResult.rows;
}
userDataRouter.post('/get-users-player-data-nl', async (req, res) => {
    const playFabIds = req.body.playFabIds;
    const playerData = await getUsersPLayerData(playFabIds);
    const parsedPlayerData = playerData.map(player => ({
        ...player,
        PlayerDataNewLauncher: JSON.parse(player.PlayerDataNewLauncher)
    }));
    res.json(parsedPlayerData);
});

module.exports = { userDataRouter };