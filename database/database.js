const express = require('express');
const { Pool } = require('pg');
const dbRouter = express.Router();

const { updateDatabase } = require('../other/bulk-ops');

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

// Update the database (usage and account data)
dbRouter.get('/update', async (req, res) => {
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.SERVER_SEC) {
        return res.status(401).json({ message: 'Invalid credential' });
    }

    updateDatabase();
    console.log("Update database started...");
    res.send("Update stated...");
});

dbRouter.post('/get-users-by-id', async (req, res) => {
    const playFabIds = req.body.playFabIds;

    if (!playFabIds || playFabIds.length === 0) {
        return res.status(400).json({ error: 'A non-empty array of PlayFabIds must be provided' });
    }

    try {
        // Using ANY to select rows matching any PlayFabId in the provided list
        const accountDataQuery = 'SELECT * FROM public."AccountData" WHERE "PlayFabId" = ANY($1)';
        const accountDataResult = await pool.query(accountDataQuery, [playFabIds]);

        const usageDataQuery = 'SELECT * FROM public."UsageData" WHERE "PlayFabId" = ANY($1)';
        const usageDataResult = await pool.query(usageDataQuery, [playFabIds]);

        // Simplified response assuming no pagination
        const totalRows = accountDataResult.rowCount + usageDataResult.rowCount;
        const totalPages = 1; // Placeholder values for pagination
        const currentPage = 1;
        const pageSize = totalRows; // This assumes no pagination

        res.json({
            totalRows: totalRows,
            totalPages: totalPages,
            currentPage: currentPage,
            pageSize: pageSize,
            usageData: usageDataResult.rows,
            accountData: accountDataResult.rows
        });
    } catch (error) {
        console.error('Database query error', error.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

dbRouter.post('/get-users-by-email', async (req, res) => {
    const playerEmails = req.body.playerEmails;

    if (!playerEmails || playerEmails.length === 0) {
        return res.status(400).json({ error: 'A non-empty list of player emails must be provided' });
    }

    console.log(playerEmails);
    const lowerCaseEmails = playerEmails.map(email => email.toLowerCase());
    console.log(lowerCaseEmails);
    const inputEmails = lowerCaseEmails.map((_, index) => `$${index + 1}`).join(',');

    try {
        // account data
        const query = `
        SELECT *
        FROM public."AccountData"
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements("AccountDataJSON"::jsonb->'LinkedAccounts') AS la
          WHERE la->>'Platform' = 'PlayFab' AND LOWER(la->>'Email') = ANY(ARRAY[${inputEmails}]::text[])
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements("AccountDataJSON"::jsonb->'ContactEmailAddresses') AS cea
          WHERE LOWER(cea->>'EmailAddress') = ANY(ARRAY[${inputEmails}]::text[])
        );
        `;
        const accountDataResult = await pool.query(query, playerEmails);
        const playFabIds = accountDataResult.rows.map(row => row.PlayFabId);
        
        // usage data
        const usageDataQuery = 'SELECT * FROM public."UsageData" WHERE "PlayFabId" = ANY($1)';
        const usageDataResult = await pool.query(usageDataQuery, [playFabIds]);

        // Simplified response assuming no pagination
        const totalRows = accountDataResult.rowCount + usageDataResult.rowCount;
        const totalPages = 1; // Placeholder values for pagination
        const currentPage = 1;
        const pageSize = totalRows; // This assumes no pagination. Adjust as necessary.

        res.json({
            totalRows: totalRows,
            totalPages: totalPages,
            currentPage: currentPage,
            pageSize: pageSize,
            usageData: usageDataResult.rows,
            accountData: accountDataResult.rows
        });
    } catch (error) {
        console.error('Database query error', error.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// gets all usage data from start to end (row numbers)
// /db/usagedata?start=0&end=1000 (query rows 0 to 1000)
// /db/usagedata?start=125 (query rows 125 to END)
// /db/usagedata (query all rows)
dbRouter.get('/usagedata', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
      return res.status(401).json({ message: 'Invalid credential' });
  }

  let start = parseInt(req.query.start, 10);
  let end = parseInt(req.query.end, 10);
  let query = 'SELECT * FROM public."UsageData"';
  const queryParams = [];

  // Ensure start and end are non-negative and start <= end
  if (!isNaN(start) && !isNaN(end) && start >= 0 && end >= start) {
      const limit = end - start + 1;
      query += ' LIMIT $1 OFFSET $2';
      queryParams.push(limit, start);
  } else if (!isNaN(start) && start >= 0) {
      query += ' OFFSET $1';
      queryParams.push(start);
  }

  try {
      const { rows } = await pool.query(query, queryParams);
      res.json(rows);
  } catch (err) {
      console.error('Error fetching usage data from db:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

dbRouter.get('/get-usagedata-count', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
      return res.status(401).json({ message: 'Invalid credential' });
  }
  try {
      let count = await getTotalUsageRowCount();
      res.send(`${count}`);
  } catch (err) {
      console.error('Error fetching usage data from db:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

async function getTotalUsageRowCount() {
  try {
      const { rows } = await pool.query('SELECT COUNT(*) FROM public."UsageData"');
      const totalCount = parseInt(rows[0].count, 10);
      return totalCount;
  } catch (err) {
      console.error('Error fetching total row count:', err);
      throw err; // Rethrow and handle it in the caller
  }
}

module.exports = { dbRouter, getTotalUsageRowCount };