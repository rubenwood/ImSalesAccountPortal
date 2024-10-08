const express = require('express');
//const axios = require('axios');
const { Pool } = require('pg');
const acaAreaRouter = express.Router();

const { genExcelReport } = require("./suffix");

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
async function getAreaRepPageCount(areas){
    let output;
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
    output = {
        totalRows: totalRows,
        totalPages: totalPages
    }
    return output;
}
acaAreaRouter.get('/area-rep-count', async (req, res) => {
    console.log("called area report count");
    try {
        let areas = req.query.areas.split(',');        
        let output = await getAreaRepPageCount(areas);
        res.json(output);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to get count', error: error.message });
    }
});

// Searches database for users who  have an AcademicArea equal one of req.query.areas list
// returns a json object detailing the total rows, pages, currentPage, pageSize,
// and most importantly; usageData and accountData for each user 
async function generateReportByAcademicArea(areas, page){
    let output;

    const pageSize = pageSizeValue; // Fixed page size
    const offset = (page - 1) * pageSize;

    // this wont match users who have an area with upper case chars
    const usageDataQuery = `
        SELECT *
        FROM public."UsageData"
        WHERE "UsageDataJSON"->'Data'->'AcademicArea'->>'Value' = ANY ($1)
        LIMIT ${pageSize} OFFSET ${offset}
    `;
    // Create an array string for PostgreSQL
    const areaPatterns = areas.map(area => `${area}`);
    const usageDataResult = await pool.query(usageDataQuery, [areaPatterns]);

    const totalRows = parseInt(usageDataResult.rows.length, 10);
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
    console.log("aca area search done ", page);
    output = {
        totalRows: totalRows,
        totalPages: totalPages,
        currentPage: page,
        pageSize: pageSize,
        usageData: usageDataResult.rows,
        accountData: accountDataResult.rows
    }
    return output;
}

acaAreaRouter.get('/gen-area-rep', async (req, res) => {
    console.log("called aca area search ", req.query.page);
    try {
        let areas = req.query.areas.split(',').map(area => area.toLowerCase());
        const page = parseInt(req.query.page || '1', 10);
        let output = await generateReportByAcademicArea(areas, page);
        res.json(output);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

// EXPORT
acaAreaRouter.get('/gen-area-rep-exp', async (req, res) => {
    let areas = req.query.areas.split(',');
    let folderName = req.query.folderName;
    let pageInfo = await getAreaRepPageCount(areas);
    let output = {};

    let reportPromises = [];

    for(var i = 0; i < pageInfo.totalPages; i++){
        reportPromises.push(generateReportByAcademicArea(areas, i+1));
    }
    const results = await Promise.all(reportPromises);

    let usageData = [];
    let accountData = [];

    results.forEach(result => {
        usageData.push(...result.usageData);
        accountData.push(...result.accountData);
    });

    output = {
        usageData,
        accountData 
    };
    // generate the report (and upload to s3)
    genExcelReport(folderName, output);
    
    res.json(output);
});

module.exports = { acaAreaRouter };