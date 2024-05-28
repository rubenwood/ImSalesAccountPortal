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
    const { deeplink, qrCodeUrl } = req.body;

    if (!deeplink || !qrCodeUrl) {
        return res.status(400).send('Deeplink and QR code URL are required');
    }

    try {
        const queryText = 'INSERT INTO public."DeepLinkQRCodes" (deeplink, qr_code_url) VALUES ($1, $2) RETURNING *';
        const values = [deeplink, qrCodeUrl];

        const result = await pool.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).send('Error inserting data into the database');
    }
});

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

module.exports = { qrCodeDBRouter };

/*
INSERT INTO public."DeepLinkQRCodes" (deeplink, qr_code_url) VALUES ('https://example.com/deeplink2', 'https://example.com/qr-code-image-url2');

SELECT * FROM public."DeepLinkQRCodes"
ORDER BY id ASC LIMIT 100

*/
