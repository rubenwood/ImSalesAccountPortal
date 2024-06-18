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
        const result = await addDeepLinkQRCode(deeplink, qrCodeUrl);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).send('Error inserting data into the database');
    }
});
async function addDeepLinkQRCode(deeplink, qrCodeUrl) {
    const queryText = 'INSERT INTO public."DeepLinkQRCodes" (deeplink, qr_code_url) VALUES ($1, $2) RETURNING *';
    const values = [deeplink, qrCodeUrl];

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

//SEARCH
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
    const searchFields = ['deeplink', 'qr_code_url', 'area', 'module', 'topic', 'activity', 'type', 'stakeholder'];
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

// Update Metadata
// for each entry, check deeplink, get params (topic, activity), and enter
// https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3Ftopic%3Dbridges_topic%5D
// https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FloadScene%3DCMSLesson%26sceneParams%3D%5BLessonData%3AReproductiveSystemLessonData%5D%26activityID%3DreproductiveSystem_lesson%5D
async function updateDBFields() {
    const selectQuery = `SELECT id, deeplink FROM public."DeepLinkQRCodes"`;
    try {
        const result = await pool.query(selectQuery);
        const entries = result.rows;

        for (const entry of entries) {
            const { id, deeplink } = entry;
            let topic = null;
            let activity = null;

            // Extract the part within brackets and decode it
            const match = deeplink.match(/dl=\[([^\]]+)\]/);
            if (match) {
                const decodedLink = decodeURIComponent(match[1]);
                const innerLink = decodedLink.split('?')[1];
                const dlParams = new URLSearchParams(innerLink);

                // Extract topic and activityID directly
                if (dlParams.has('topic')) {
                    topic = dlParams.get('topic');
                }
                if (dlParams.has('activityID')) {
                    activity = dlParams.get('activityID');
                }

                // Check within sceneParams for nested activityID
                if (dlParams.has('sceneParams')) {
                    const sceneParams = dlParams.get('sceneParams');
                    const nestedParams = new URLSearchParams(sceneParams.replace(/^\[|\]$/g, '').replace(/,/g, '&'));
                    if (nestedParams.has('activityID')) {
                        activity = nestedParams.get('activityID');
                    }
                }
            }

            // Update the database fields if they are found
            const updateFields = {};
            const updateValues = [];
            let updateQuery = 'UPDATE public."DeepLinkQRCodes" SET';
            if (topic) {
                updateFields.topic = topic;
                updateValues.push(topic);
                updateQuery += ` "topic" = $${updateValues.length},`;
            }
            if (activity) {
                updateFields.activity = activity;
                updateValues.push(activity);
                updateQuery += ` "activity" = $${updateValues.length},`;
            }

            if (updateValues.length > 0) {
                updateQuery = updateQuery.slice(0, -1); // Remove trailing comma
                updateValues.push(id);
                updateQuery += ` WHERE "id" = $${updateValues.length}`;
                await pool.query(updateQuery, updateValues);
            }
        }
    } catch (error) {
        console.error('Error updating database fields:', error);
        throw error;
    }
}
//updateDBFields();

module.exports = { qrCodeDBRouter, addDeepLinkQRCode };
