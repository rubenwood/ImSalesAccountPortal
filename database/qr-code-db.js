const express = require('express');
const { Pool } = require('pg');
const qrCodeDBRouter = express.Router();

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

// CREATE - Insert a new deeplink and QR code URL
qrCodeDBRouter.post('/add-dl-qr', async (req, res) => {
    const deeplink = req.body.deeplink;
    const qrCodeUrl = req.body.qrCodeUrl;
    const areaId = req.body.areaId;    
    const areaName = req.body.areaName;
    const topicId = req.body.topicId;
    const topicName = req.body.topicName;    
    const activityId = req.body.activityId;
    const activityName = req.body.activityName;
    const type = req.body.type;

    if (!deeplink || !qrCodeUrl) {
        return res.status(400).send('Deeplink and QR code URL are required');
    }

    try {
        const result = await addDeepLinkQRCode(deeplink,qrCodeUrl,areaId,areaName,topicId,topicName,activityId,activityName,type);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).send('Error inserting data into the database');
    }
});
async function addDeepLinkQRCode(deeplink, qrCodeUrl, areaId, areaName, topicId, topicName, activityId, activityName, type) {
    const queryText = `
        INSERT INTO public."DeepLinkQRCodes" (deeplink, qr_code_url, area_id, area_name, topic_id, topic_name, activity_id, activity_name, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`;
    const values = [deeplink, qrCodeUrl, areaId, areaName, topicId, topicName, activityId, activityName, type];

    try {
        const result = await pool.query(queryText, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error inserting data:', error);
        throw error;
    }
}

// READ - Get all deeplink and QR code entries
qrCodeDBRouter.get('/get-all-dl-qr', async (req, res) => {    
    try {
        const result = await pool.query('SELECT * FROM public."DeepLinkQRCodes"');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data from the database');
    }
});

// READ - Get a specific deeplink and QR code entry by ID
qrCodeDBRouter.get('/get-dl-qr/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('SELECT * FROM public."DeepLinkQRCodes" WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Entry not found');
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data from the database');
    }
});

// UPDATE - Update a specific deeplink and QR code entry by ID
qrCodeDBRouter.put('/update-dl-qr/:id', async (req, res) => {
    const { id } = req.params;
    const { deeplink, qrCodeUrl } = req.body;

    if (!deeplink || !qrCodeUrl) {
        return res.status(400).send('Deeplink and QR code URL are required');
    }

    try {
        const queryText = 'UPDATE public."DeepLinkQRCodes" SET deeplink = $1, qr_code_url = $2 WHERE id = $3 RETURNING *';
        const values = [deeplink, qrCodeUrl, id];

        const result = await pool.query(queryText, values);
        if (result.rows.length === 0) {
            return res.status(404).send('Entry not found');
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).send('Error updating data in the database');
    }
});

// DELETE - Delete a specific deeplink and QR code entry by ID
qrCodeDBRouter.delete('/delete-dl-qr/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM public."DeepLinkQRCodes" WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Entry not found');
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).send('Error deleting data from the database');
    }
});

// SEARCH
qrCodeDBRouter.get('/search', async (req, res) => {
    const query = req.query.q;
    try {
        const results = await searchQRCodeDB(query);
        res.json(results);
    } catch (error) {
        console.error('Error searching QR codes:', error);
        res.status(500).json({ error: 'Error searching QR codes' });
    }
});

async function searchQRCodeDB(query) {
    const searchFields = ['deeplink', 'qr_code_url', 'area_name', 'module', 'topic_name', 'activity_name', 'type', 'stakeholder'];
    const searchQueries = searchFields.map(field => `${field} ILIKE $1`);
    const searchText = `%${query}%`;

    const queryText = `SELECT * FROM public."DeepLinkQRCodes" WHERE ${searchQueries.join(' OR ')}`;
    try {
        const result = await pool.query(queryText, [searchText]);
        return result.rows;
    } catch (error) {
        console.error('Error searching data:', error);
        throw error;
    }
}

module.exports = { qrCodeDBRouter, addDeepLinkQRCode };
