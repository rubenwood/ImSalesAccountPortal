const express = require('express');
const axios = require('axios');
const cmsRouter = express.Router();
const { Pool } = require('pg');

const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const s3 = new AWS.S3();

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

cmsRouter.get('/clear-s3-cache', async (req, res) => {
  console.log("clearing s3 cache...");
  try {
    // List objects in the specified folder
    const listParams = {
      Bucket: 'com.immersifyeducation.cms',
      Prefix: 'Models/'
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (listedObjects.Contents.length === 0) {
      return res.status(404).send('No files found in the specified folder');
    }

    // Prepare objects for copying with new metadata
    const copyPromises = listedObjects.Contents.map(async (object) => {
      const copyParams = {
        Bucket: 'com.immersifyeducation.cms',
        CopySource: `${'com.immersifyeducation.cms'}/${object.Key}`,
        Key: object.Key,
        MetadataDirective: 'REPLACE',
        CacheControl: 'no-cache'
      };
      await s3.copyObject(copyParams).promise();
    });

    await Promise.all(copyPromises);

    res.json({message:'Cache invalidation completed'});
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({message:'Error invalidating cache'});
  }
});


cmsRouter.post('/search-lesson-name', async(req, res) => {
  const { lessonName } = req.body;

  try {
      // Search for brondon ID where externalTitle matches lessonName
      const brondonResult = await pool.query(
          'SELECT id FROM public.brondon WHERE "externalTitle"=$1',
          [lessonName]
      );

      if (brondonResult.rows.length === 0) {
          return res.status(404).json({ message: 'Lesson not found' });
      }

      const brondonId = brondonResult.rows[0].id;

      // Use brondon ID to search brondon_lessons table to get the lesson
      const lessonResult = await pool.query(
          'SELECT lesson FROM public.brondon_lessons WHERE brondon = $1',
          [brondonId]
      );

      if (lessonResult.rows.length === 0) {
          return res.status(404).json({ message: 'Lesson not found in brondon_lessons' });
      }

      const lesson = lessonResult.rows[0];

      res.status(200).json({ lesson });
  } catch (error) {
      console.error('Error executing query', error.stack);
      res.status(500).json({ message: 'Internal server error' });
  }
});

cmsRouter.post('/set-mpd-data-batch', async (req, res) => {
  const { data } = req.body;
  console.log(data);

  if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Data is required and should be an array' });
  }

  try {
      const client = await pool.connect();

      try {
          await client.query('BEGIN');

          for (const item of data) {
              const { mpd, rotation, scale } = item;

              if (!mpd) {
                  throw new Error(`Invalid data format for mpd ${mpd}`);
              }
              console.log("mpd: " + mpd);

              if (rotation) {
                  // Update rotation
                  await client.query(
                      `UPDATE public.model_point_data
                       SET rotation = $1::numeric[]
                       WHERE id = $2::uuid`,
                      [rotation, mpd]
                  );
              }
              console.log("rotation: " + rotation);

              if (scale) {
                  // Update scale
                  await client.query(
                      `UPDATE public.model_point_data
                       SET scale = $1::numeric[]
                       WHERE id = $2::uuid`,
                      [scale, mpd]
                  );
              }
              console.log("rotation: " + scale);
          }

          await client.query('COMMIT');
          res.status(200).json({ message: 'Data updated successfully' });
      } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error during transaction, rolled back:', error);
          res.status(500).json({ error: 'An error occurred while updating the data' });
      } finally {
          client.release();
      }
  } catch (error) {
      console.error('Error connecting to the database:', error);
      res.status(500).json({ error: 'An error occurred while connecting to the database' });
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
cmsRouter.get('/set-model-point-scale-one', async (req, res) => {
    const client = await pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');
  
      // Update the position of the rows where position is not {0,0,0}
      const updateQuery = `
        UPDATE public.model_point_data
        SET scale = '{1,1,1}'::numeric[]
        WHERE scale != '{1,1,1}'::numeric[]
      `;
      const result = await client.query(updateQuery);
  
      // Commit the transaction
      await client.query('COMMIT');
      
      res.status(200).json({ message: 'Scales all set to 1', rowsAffected: result.rowCount });
    } catch (error) {
      // Rollback the transaction in case of an error
      await client.query('ROLLBACK');
      console.error('Error executing query', error.stack);
      res.status(500).json({ error: 'An error occurred while updating scales' });
    } finally {
      // Release the client back to the pool
      client.release();
    }
});

module.exports = { cmsRouter };