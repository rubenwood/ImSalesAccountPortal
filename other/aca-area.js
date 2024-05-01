const express = require('express');
//const axios = require('axios');
const { Pool } = require('pg');
const acaAreaRouter = express.Router();

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
acaAreaRouter.get('/area-rep-count', async (req, res) => {
    console.log("called area report count");
    try {
        let areas = req.query.areas.split(',');        
        areas = areas.map(area => area.toLowerCase());

        const countQuery = `
            SELECT COUNT(*)
            FROM public."UsageData"
            WHERE "UsageDataJSON"->'Data'->'AcademicArea'->>'Value' ILIKE ANY (ARRAY[${areas.map(area => `'${area}'`).join(',')}])
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

// Searches database for users who  have an AcademicArea equal one of req.query.areas list
// returns a json object detailing the total rows, pages, currentPage, pageSize,
// and most importantly; usageData and accountData for each user 
acaAreaRouter.get('/gen-area-rep', async (req, res) => {
    console.log("called aca area search ", req.query.page);
    try {
        let areas = req.query.areas.split(',');
        areas = areas.map(area => area.toLowerCase());
        //console.log(areas);

        const page = parseInt(req.query.page || '1', 10);
        const pageSize = pageSizeValue; // Fixed page size
        const offset = (page - 1) * pageSize;

        // Query to fetch usage data with pagination
        const usageDataQuery = `
            SELECT *
            FROM public."UsageData"
            WHERE "UsageDataJSON"->'Data'->'AcademicArea'->>'Value' ILIKE ANY (ARRAY[${areas.map(area => `'${area}'`).join(',')}])
            LIMIT ${pageSize} OFFSET ${offset}
        `;      
        const usageDataResult = await pool.query(usageDataQuery);

        const totalRows = parseInt(usageDataResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalRows / pageSize);        

        // Extract PlayFabIds to use in the next query
        const playFabIds = usageDataResult.rows.map(row => row.PlayFabId);
        // Query to fetch account data based on PlayFabIds
        const accountDataQuery = `
            SELECT *
            FROM public."AccountData"
            WHERE "PlayFabId" = ANY ($1)
        `;
        const accountDataResult = await pool.query(accountDataQuery, [playFabIds]);
        console.log("aca area search done ", req.query.page);
        
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
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

module.exports = { acaAreaRouter };