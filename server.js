const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const app = express();

app.use(express.json());
app.use(cors());

// const { ConfluenceClient } = require('confluence.js');
// const client = new ConfluenceClient({
//     host: 'https://immersify.atlassian.net',
//     authentication: {
//         basic: {
//         username: process.env.CONFLUENCE_USERNAME,
//         password: process.env.CONFLUENCE_PASSWORD,
//         },
//     }
// });


app.put('/update-confluence-page/:pageId', async (req, res) => {
    console.log("CALLED");
    try {
      const pageId = req.params.pageId;
      const updateData = {
        id: pageId,
        type: "page",
        title: "TEST PAGE",
        space: { key: "DEVTeam" },
        body: {
          storage: {
            value: "<p>This is the updated text for the new page</p>",
            representation: "storage"
          }
        },
        version: { number: 2 }
      };
  
      const response = await axios.put(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}`, updateData, {
        auth: {
          username: process.env.CONFLUENCE_USERNAME,
          password: process.env.CONFLUENCE_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error updating Confluence page');
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