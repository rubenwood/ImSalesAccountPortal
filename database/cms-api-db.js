const express = require('express');
const axios = require('axios');
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

const imAPIBaseURL = "https://immersify-api.herokuapp.com";
cmsRouter.post('/fix-duplicate-assets', async (req, res) => {
  // get all lessons
});

cmsRouter.post('/set-mpd-rotation', async (req, res) => {
  const { modelPointId, rotation } = req.body;

  if (!modelPointId || !rotation) {
      return res.status(400).json({ error: 'MPD and Rotation are required' });
  }

  try {
    // Update scale for each modelPointId in PostgreSQL
    const queryText = `
        UPDATE public.model_point_data
        SET rotation = $1::numeric[]
        WHERE id = $2::uuid
    `;      
    const values = [rotation, modelPointId];

    const result = await pool.query(queryText, values);
    console.log(result);

    res.status(200).json({ message: 'Rotation updated successfully', rowsAffected: result.rowCount });
  } catch (error) {
      console.error('Error updating mpd rotation:', error);
      res.status(500).json({ error: 'An error occurred while updating the mpd rotation' });
  }
});

cmsRouter.post('/set-lesson-scale', async (req, res) => {
  const { lessonId, scale, jwtoken } = req.body;

  if (!lessonId || !scale) {
      return res.status(400).json({ error: 'Lesson ID and scale are required' });
  }

  try {
      // Fetch lesson data from external API with authorization headers
      const response = await axios.get(`${imAPIBaseURL}/lessons/${lessonId}/allData`, {
          headers: {
              'Authorization': `Bearer ${jwtoken}`,
              'Content-Type': 'application/json'
          }
      });
      const lessonData = response.data;

      // Extract modelPointData IDs
      const modelPointIds = lessonData.points.flatMap(point => point.modelPointData ? point.modelPointData.map(mp => mp.id) : []);

      if (modelPointIds.length === 0) {
          return res.status(404).json({ error: 'No modelPointData found for the provided lesson ID' });
      }

      // Update scale for each modelPointId in PostgreSQL
      const queryText = `
          UPDATE public.model_point_data
          SET scale = $1::numeric[]
          WHERE id = ANY($2::uuid[])
      `;      
      const values = [scale, modelPointIds];

      const result = await pool.query(queryText, values);
      console.log(result);

      res.status(200).json({ message: 'Scale updated successfully', rowsAffected: result.rowCount });
  } catch (error) {
      console.error('Error updating lesson scale:', error);
      res.status(500).json({ error: 'An error occurred while updating the lesson scale' });
  }
});

cmsRouter.get('/set-model-point-pos-zero', async (req, res) => {
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