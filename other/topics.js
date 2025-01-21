const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const topicsRouter = express.Router();
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

// GET TOPICS BY ID
topicsRouter.get('/get-users-by-topic-id', async (req, res) => {
    const topicIds = req.query.topics ? req.query.topics.split(',') : [];

    if (topicIds.length === 0) {
        return res.status(400).json({ message: 'Missing activities parameter or it is empty.' });
    }

    const query1 = `
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
            WHERE activity->>'topicID' = ANY($1::text[])
        )
    `;

    try {
        const queryParams = [topicIds];
        const [result1] = await Promise.all([pool.query(query1, queryParams)]);
        const rows1 = result1.rows;
        res.json(rows1);
    } catch (err) {
        console.error('Error fetching usage data from db:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET TOPICS BY TITLE
topicsRouter.get('/get-users-by-topic-title', async (req, res) => {
    const topicTitles = req.query.topics ? req.query.topics.split(',') : [];

    if (topicTitles.length === 0) {
        return res.status(400).json({ message: 'Missing activities parameter or it is empty.' });
    }

    // TODO: update this to support _Parts

    const query1 = `
        WITH valid_usage_data AS (
            SELECT *
            FROM public."UsageData"
            WHERE ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') IS NOT NULL
              AND ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') NOT LIKE '%NaN%'
              AND ("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value') ~ '^\{.*\}$'
              AND NOT ("UsageDataJSON"::text ~ '_Part\d+')
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
                (("UsageDataJSON"->'Data'->'PlayerDataNewLauncher'->>'Value')::jsonb)->'activities'
            ) AS activity
            WHERE activity->>'topicTitle' = ANY($1::text[])
        )
    `;

    try {
        const queryParams = [topicTitles];
        const [result1] = await Promise.all([pool.query(query1, queryParams)]);
        const rows1 = result1.rows;
        console.log(rows1);
        res.json(rows1);
    } catch (err) {
        console.error('Error fetching usage data from db:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = topicsRouter;