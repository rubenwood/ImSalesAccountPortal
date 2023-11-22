const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const app = express();

app.use(express.json());
app.use(cors());

app.put('/update-confluence-page/:pageId', async (req, res) => {
  var email = req.body.email;
  var pass = req.body.pass;
  var area = req.body.area;
  var expiry = req.body.expiry;

  const pageId = req.params.pageId;
  const pageContent = await getPageDetails(pageId);
  var newPageContent = pageContent;
  
  // Parse the existing content to add a new row to the table
  if (newPageContent.includes("<table>")) {
    // This is a very basic way to add a row. For more complex scenarios, consider using an XML/HTML parser
    const newRow = `<tr><td>${email}</td><td>${pass}</td><td>${area}</td><td>${expiry}</td></tr>`;
    newPageContent = pageContent.replace("</tbody>", `${newRow}</tbody>`);
  } else {
      // If no table exists, create one
      newPageContent = `<table><tbody><tr><td><b>Email</b></td><td><b>Password</b></td><td><b>Area</b></td><td><b>Expiry</b></td></tr></tbody></table>`;
  }

  try {
    const currentVersion = await getCurrentPageVersion(pageId)
    const bodyData = `{
      "version": {
        "number": ${currentVersion+1}, 
        "message": "update"
      },
      "title": "Test Accounts (Automated)",
      "type": "page",
      "status": "current",
      "body": {
        "storage": {
          "value": "${newPageContent}",
          "representation": "storage"
        }
      }
    }`;      

    const response = await axios.put(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}`, bodyData, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`)
        .toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: bodyData
    });
    
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating Confluence page');
  }
});

async function getCurrentPageVersion(pageId) {
  try {
      const response = await axios.get(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}?expand=version`, {
          headers: {
              'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64')}`,
              'Accept': 'application/json'
          }
      });
      return response.data.version.number;
  } catch (error) {
      console.error("Error fetching page version:", error);
      throw error;
  }
}
async function getPageDetails(pageId) {
  try {
      const response = await axios.get(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}?expand=body.storage`, {
          headers: {
              'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64')}`,
              'Accept': 'application/json'
          }
      });
      //console.log(response.data.body.storage.value); // Log the response data
      return response.data.body.storage.value // This is the current page content in storage format
      
  } catch (error) {
      console.error("Error fetching page details:", error);
      throw error;
  }
}


app.use(express.static('public'));

const PORT = process.env.PORT;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/test', (req, res) => {
    res.send('It Works!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});