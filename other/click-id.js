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

// Returns the total number of rows (and pages) for a given click id(s)
clickIDRouter.get('/click-id-count', async (req, res) => {
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

        res.json({
            totalRows: totalRows,
            totalPages: totalPages,
            usageData: usageDataResult.rows
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to get click id report', error: error.message });
    }
});

module.exports = { clickIDRouter };