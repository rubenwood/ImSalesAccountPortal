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

async function getNewReturningUsers(){
    console.log("called");
    // new user = created within time frame and logins are on same day as creation
    // not-new-returning = logged in within time frame but not created withing time frame
    // new-returning = logged in within time frame

    const accountDataQuery = `SELECT * FROM public."AccountData" 
WHERE "AccountData"->>'Created' = '2022-08-17T08:03:48.676Z'
LIMIT 100;`;
    const usageDataQuery = `SELECT * FROM public."UsageData" LIMIT 100`;

    const [accountDataResult, usageDataResult] = await Promise.all([
        pool.query(accountDataQuery), 
        pool.query(usageDataQuery),
    ]);

    console.log(accountDataResult);
    console.log(usageDataResult);
    
    const accountData = accountDataResult.rows;
    const usageData = usageDataResult.rows;

    let output = {
        accountData,
        usageData,
        newUsers:[],
        newReturning:[],
        notNewReturning:[]
    }

    return output;
}

userDataRouter.get('/get-new-returning-users', async (req, res) => {
    const newRetUsers = await getNewReturningUsers();
    res.json(newRetUsers);
});

module.exports = { userDataRouter };