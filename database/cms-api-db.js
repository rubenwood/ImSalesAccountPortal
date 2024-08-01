const express = require('express');
const cmsRouter = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PG_CMSAPI_USER,
    host: process.env.PG_CMSAPI_HOST,
    database: process.env.PG_CMSAPI_DB,
    password: process.env.PG_CMSAPI_PASS,
    port: process.env.PGPORT,
    connectionString: process.env.PG_CMSAPI_URL,
    ssl: {
        rejectUnauthorized: false,
    }
});

// SELECT * FROM public.model_point_data

cmsRouter.get('/update-model-point-data', async (req, res) => {
    const client = await pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');
  
      // Update the position of the rows where position is not {0,0,0}
      const updateQuery = `
        UPDATE public.model_point_data
        SET position = '{0,0,0}'::numeric[]
        WHERE position != '{0,0,0}'::numeric[]
      `;
      const result = await client.query(updateQuery);
  
      // Commit the transaction
      await client.query('COMMIT');
      
      res.status(200).json({ message: 'Positions updated successfully', rowsAffected: result.rowCount });
    } catch (error) {
      // Rollback the transaction in case of an error
      await client.query('ROLLBACK');
      console.error('Error executing query', error.stack);
      res.status(500).json({ error: 'An error occurred while updating positions' });
    } finally {
      // Release the client back to the pool
      client.release();
    }
});

module.exports = { cmsRouter };