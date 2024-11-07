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

async function getUsersEventLog(startDate, endDate) {
    const startDateStr = new Date(startDate).toISOString();
    const endDateStr = new Date(endDate).toISOString();

    const usersEventLogQuery = `SELECT * FROM public."UsageData" WHERE "UsageDataJSON"->>"SessionDebugData"`;
    
    const result = pool.query(usersEventLogQuery);
}
userDataRouter.post('/get-users-event-log', async (req, res) => {
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    const usersEventLog = await getUsersEventLog(startDate, endDate);
    res.json(usersEventLog);
});


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

async function getNewReturningUsers(startDate, endDate){
    const startDateStr = new Date(startDate).toISOString();
    const endDateStr = new Date(endDate).toISOString();

    // new-user = created within time frame and logins are on same day as creation
    // new-returning = created within time frame but logged after the created date
    // not-new-returning = logged in within time frame but not created withing time frame    

    // get all users created on or after the start date (and before the end date)

    // 
    const newUsersQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz;
    `;

    // created within time frame & created day & last login day are the same (brand new)
    const newUsersNotReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz
    AND date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS')) 
        = date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS'));
    `;

    // created within time frame & last login date is more recent than created date (new, but returned)
    const newReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz
    AND date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS')) 
        > date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS'));
    `;

    // created outside of time frame but logged in within the time frame
    const notNewReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE 
        (
            to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') < '${startDateStr}'::timestamptz
        )
    AND 
        (
            to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') >= '${startDateStr}'::timestamptz
            AND to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') <= '${endDateStr}'::timestamptz
        );
    `;

    const [newUsersResult, newUsersNotReturningResult, newReturningResult, notNewReturningResult] = await Promise.all([
        pool.query(newUsersQuery),
        pool.query(newUsersNotReturningQuery), 
        pool.query(newReturningQuery),
        pool.query(notNewReturningQuery)
    ]);

    const output = { 
        newUsers: newUsersResult.rows,
        newUsersNotReturning: newUsersNotReturningResult.rows,
        newReturningUsers: newReturningResult.rows,
        notNewReturningUsers: notNewReturningResult.rows
    };

    return output;
}
userDataRouter.post('/get-new-returning-users', async (req, res) => {
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    const newRetUsers = await getNewReturningUsers(startDate, endDate);
    res.json(newRetUsers);
});

module.exports = { userDataRouter };