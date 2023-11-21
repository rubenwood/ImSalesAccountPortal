const express = require('express');
const app = express();
require('dotenv').config();

const { ConfluenceClient } = require('confluence.js');
const client = new ConfluenceClient({
    host: 'https://immersify.atlassian.net',
    authentication: {
        basic: {
        username: process.env.CONFLUENCE_USERNAME,
        password: process.env.CONFLUENCE_PASSWORD,
        },
    }
});





app.use(express.static('public'));

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/test', (req, res) => {
    res.send('It Works!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});