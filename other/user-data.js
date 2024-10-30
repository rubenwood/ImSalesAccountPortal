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

async function getNewReturningUsers(startDate, endDate){
    const startDateStr = new Date(startDate).toISOString();
    const endDateStr = new Date(endDate).toISOString();

    // new-user = created within time frame and logins are on same day as creation
    // new-returning = created within time frame but logged after the created date
    // not-new-returning = logged in within time frame but not created withing time frame    

    // get all users created on or after the start date (and before the end date)

    // created within time frame & created day & last login day are the same (brand new)
    const newUsersNotReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz
    AND date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS')) 
        = date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS'))
    LIMIT 100;
    `;

    // created within time frame & last login date is more recent than created date (new, but returned)
    const newReturningQuery = `
    SELECT * FROM public."AccountData" 
    WHERE to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        >= '${startDateStr}'::timestamptz
    AND to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS') 
        <= '${endDateStr}'::timestamptz
    AND date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'LastLogin', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS')) 
        > date_trunc('day', to_timestamp(REPLACE("AccountDataJSON"->>'Created', 'Z', ''), 'YYYY-MM-DD"T"HH24:MI:SS.MS'))
    LIMIT 100;
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
        )
    LIMIT 100;
    `;

    const [newUsersResult, newReturningResult, notNewReturningResult] = await Promise.all([
        pool.query(newUsersNotReturningQuery), 
        pool.query(newReturningQuery),
        pool.query(notNewReturningQuery)
    ]);

    const output = { 
        newUsersNotReturning: newUsersResult.rows,
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