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

// /db/playerdata?limit=100
dbRouter.get('/playerdata', async (req, res) => {
    const secret = req.headers['x-secret-key'];
    if (secret !== process.env.SERVER_SEC) {
        return res.status(401).json({ message: 'Invalid or missing secret.' });
    }

    const limit = parseInt(req.query.limit, 10) || 100; // Default to 100 items if limit is not specified
  
    try {
      const { rows } = await pool.query(`
        SELECT * FROM public."PlayerData"
        LIMIT $1
      `, [limit]);
  
      res.json(rows);
    } catch (err) {
      console.error('Error fetching player data from db:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = dbRouter;