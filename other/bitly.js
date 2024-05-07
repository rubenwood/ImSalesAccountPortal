const express = require('express');
const axios = require('axios');
const bitlyRouter = express.Router();

bitlyRouter.post('/shorten-url', async (req, res) => {    
    const originalUrl = req.body.url;
    
    if (!originalUrl) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    console.log(`shortenting url ${originalUrl}`);

    try {
        const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
            long_url: originalUrl,
            domain: "bit.ly"
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.BITLY_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // Send the shortened URL back to the client
        res.json({ shortenedUrl: response.data.link });
    } catch (error) {
        console.error('Error when calling Bitly API:', error);
        res.status(500).json({ error: 'Failed to shorten URL' });
    }
});
module.exports = {
    bitlyRouter
};