const express = require('express');
//const axios = require('axios');
const { Pool } = require('pg');
const clickIDRouter = express.Router();

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

const pageSizeValue = 100;

// Returns the total number of rows (and pages) for a given academic area
clickIDRouter.get('/click-id-count', async (req, res) => {
    console.log("called click id report count");
    try {
        let clickIDs = req.query.clickids.split(',');        
        clickIDs = clickIDs.map(area => area.toLowerCase());

        const countQuery = `
            SELECT COUNT(*)
            FROM public."UsageData"
            WHERE "UsageDataJSON"->'Data'->'ClickID'->>'Value' ILIKE ANY (ARRAY[${clickIDs.map(clickid => `'${clickid}'`).join(',')}])
        `;
        const countResult = await pool.query(countQuery);
        const totalRows = parseInt(countResult.rows[0].count, 10);
        const pageSize = pageSizeValue; // Fixed page size
        const totalPages = Math.ceil(totalRows / pageSize);

        res.json({
            totalRows: totalRows,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to get count', error: error.message });
    }
});

// Returns the total number of rows (and pages) for a given click id(s)
clickIDRouter.get('/gen-click-id-rep', async (req, res) => {
    console.log("called click id report");
    try {
        let clickIDs = req.query.clickids.split(',');
        clickIDs = clickIDs.map(clickid => clickid.toLowerCase());

        //console.log(clickIDs);

        const page = parseInt(req.query.page || '1', 10);
        const pageSize = pageSizeValue; // Fixed page size
        const offset = (page - 1) * pageSize;

        const usageDataQuery = `
            SELECT *
            FROM public."UsageData"
            WHERE "UsageDataJSON"->'Data'->'ClickID'->>'Value' ILIKE ANY (ARRAY[${clickIDs.map(clickid => `'${clickid}'`).join(',')}])
            LIMIT ${pageSize} OFFSET ${offset}
        `;
        const usageDataResult = await pool.query(usageDataQuery);
        //console.log(usageDataResult);
        const totalRows = parseInt(usageDataResult.rows.length, 10);
        const totalPages = Math.ceil(totalRows / pageSize);

        // Extract PlayFabIds to use in the next query
        const playFabIds = usageDataResult.rows.map(row => row.PlayFabId);
        const accountDataQuery = `
            SELECT *
            FROM public."AccountData"
            WHERE "PlayFabId" = ANY ($1)
        `;
        const accountDataResult = await pool.query(accountDataQuery, [playFabIds]);

        res.json({
            totalRows: totalRows,
            totalPages: totalPages,
            currentPage: page,
            pageSize: pageSize,
            usageData: usageDataResult.rows,
            accountData: accountDataResult.rows
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to get click id report', error: error.message });
    }
});

module.exports = { clickIDRouter };