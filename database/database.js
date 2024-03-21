const express = require('express');
const axios = require('axios');
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
        rejectUnauthorized: false, // Note: This disables certificate validation. See below for a more secure approach.
    },
});

// /db/playerdata?start=0&end=1000 (query rows 0 to 1000)
// /db/playerdata?start=125 (query rows 125 to END)
// /db/playerdata (query all rows)
dbRouter.get('/playerdata', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
      return res.status(401).json({ message: 'Invalid or missing secret.' });
  }

  let start = parseInt(req.query.start, 10);
  let end = parseInt(req.query.end, 10);
  let query = 'SELECT * FROM public."PlayerData"';
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
      console.error('Error fetching player data from db:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

dbRouter.get('/get-playerdata-count', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
      return res.status(401).json({ message: 'Invalid or missing secret.' });
  }
  try {
      //const { rows } = await pool.query(query, queryParams);
      let count = await getTotalRowCount();
      res.send(`${count}`);
  } catch (err) {
      console.error('Error fetching player data from db:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

async function getTotalRowCount() {
  try {
      const { rows } = await pool.query('SELECT COUNT(*) FROM public."PlayerData"');
      const totalCount = parseInt(rows[0].count, 10);
      return totalCount;
  } catch (err) {
      console.error('Error fetching total row count:', err);
      throw err; // Rethrow and handle it in the caller
  }
}

module.exports = { dbRouter, getTotalRowCount };