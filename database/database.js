const express = require('express');
const { Pool } = require('pg');
const dbRouter = express.Router();

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


dbRouter.post('/get-users-by-id', async (req, res) => {
    const playFabIds = req.body.playFabIds;
    console.log(playFabIds);

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

dbRouter.get('/get-users-by-email', async (req, res) => {
    
});


// gets all usage data from start to end (row numbers)
// /db/usagedata?start=0&end=1000 (query rows 0 to 1000)
// /db/usagedata?start=125 (query rows 125 to END)
// /db/usagedata (query all rows)
dbRouter.get('/usagedata', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
      return res.status(401).json({ message: 'Invalid or missing secret.' });
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
      return res.status(401).json({ message: 'Invalid or missing secret.' });
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

// USED TO UPDATE THE DATABASE
async function extractAndSetJsonValue(tableName, jsonColumnName, keyName, newColumnName) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Add the new column if it doesn't exist
        await client.query(`
            ALTER TABLE "${tableName}"
            ADD COLUMN IF NOT EXISTS "${newColumnName}" TEXT;
        `);

        // Extract value from the JSON column and set it in the new column
        await client.query(`
            UPDATE "${tableName}"
            SET "${newColumnName}" = ("${jsonColumnName}"->>'${keyName}')::TEXT;
        `);

        await client.query('COMMIT');
        console.log(`${newColumnName} column has been successfully updated with ${keyName} values from ${jsonColumnName}.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error occurred:', error);
    } finally {
        client.release();
    }
}
//extractAndSetJsonValue('AccountData', 'AccountDataJSON', 'PlayerId', 'PlayFabId').catch(err => console.error(err)); // done 17:44 09/04/2024
//extractAndSetJsonValue('UsageData', 'UsageDataJSON', 'PlayFabId', 'PlayFabId').catch(err => console.error(err)); // done 18:49 09/04/2024

module.exports = { dbRouter, getTotalUsageRowCount, extractAndSetJsonValue };