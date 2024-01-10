const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config();
const app = express();

app.use(express.json());
app.use(cors());

// AWS METHODS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCES_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const s3 = new AWS.S3();
// GET ACADEMIC AREA JSON
app.get('/getAcademicAreas', async (req, res) => {
  try {
      const params = {
          Bucket: process.env.AWS_BUCKET,
          Key: 'TestFiles/OtherData/AcademicAreasData.json'
      };

      const data = await s3.getObject(params).promise();
      res.send(JSON.parse(data.Body.toString()));
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error fetching data from S3');
  }
});
// GET PRESIGNED URL (UNUSED)
app.get('/getPresignedUrl', (req, res) => {
  const s3Params = {
      Bucket: process.env.AWS_BUCKET,
      Key: 'TestFiles/OtherData/AcademicAreasData.json',
      Expires: 60 // The URL will be valid for 60 seconds
  };
  s3.getSignedUrl('getObject', s3Params, (err, url) => {
      if (err) {
          console.error('Error:', err);
          return res.status(500).send('Could not generate URL');
      }
      res.send({ url });
  });
});

// GET LESSON INFO
app.post('/getLessonInfo', async (req, res) => {
  try {
      const params = {
          Bucket: process.env.AWS_BUCKET,
          Key: `AndroidFiles/5.5.2/OtherData/AcademicAreaData/${req.body.area}/LessonInfo.json`
      };

      const data = await s3.getObject(params).promise();
      res.send(JSON.parse(data.Body.toString()));
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error fetching data from S3');
  }
});
// GET PRAC INFO
app.post('/getPracInfo', async (req, res) => {
  try {
      const params = {
          Bucket: process.env.AWS_BUCKET,
          Key: `AndroidFiles/5.5.2/OtherData/AcademicAreaData/${req.body.area}/PracticalInfo.json`
      };

      const data = await s3.getObject(params).promise();
      res.send(JSON.parse(data.Body.toString()));
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error fetching data from S3');
  }
});

// UPDATE CONFLUENCE PAGE
app.put('/update-confluence-page/:pageId', async (req, res) => {
  let email = req.body.email;
  let pass = req.body.pass;
  let area = req.body.area;
  let expiry = req.body.expiry;
  let createdBy = req.body.createdBy;
  let createdFor = req.body.createdFor;

  const pageId = req.params.pageId;
  const pageContent = await getPageDetails(pageId);
  let newPageContent = pageContent;
  
  // Parse the existing content to add a new row to the table
  if (newPageContent.includes("</tbody>")) {
    const newRow = `<tr><td>${email}</td><td>${pass}</td><td>${area}</td><td>${expiry}</td><td>${createdBy}</td><td>${createdFor}</td></tr>`;
    newPageContent = pageContent.replace("</tbody>", `${newRow}</tbody>`);
  } else {
      console.log("No table found in Confluence page");
      // If no table exists, create one
      newPageContent = `<table><tbody><tr><td><b>Email</b></td><td><b>Password</b></td><td><b>Area</b></td><td><b>Expiry</b></td><td><b>Created By</b></td><td><b>Created For</b></td></tr></tbody></table>`;
  }

  try {
    const currentVersion = await getCurrentPageVersion(pageId)
    const bodyData = {
      "version": {
        "number": currentVersion+1, 
        "message": "update"
      },
      "title": "Test Accounts (Automated)",
      "type": "page",
      "status": "current",
      "body": {
        "storage": {
          "value": newPageContent,
          "representation": "storage"
        }
      }
    };      

    const response = await axios.put(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}`, 
    JSON.stringify(bodyData), {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`)
        .toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: bodyData
    });

    //writeCSV(email, pass, area, expiry);

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating Confluence page');
  }
});
// CONFLUENCE METHODS
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
      return response.data.body.storage.value // This is the current page content in storage format
      
  } catch (error) {
      console.error("Error fetching page details:", error);
      throw error;
  }
}
// WRITE TO CSV
function writeCSV(email, pass, area, expiry) {
  const csvFilePath = path.join('csv/', 'data.csv'); // Adjust the path as needed
  const newLine = `${email},${pass},${area},${expiry}\n`;
  fs.appendFileSync(csvFilePath, newLine, 'utf8');
}

// GET USER ACC INFO (for report)
app.post('/get-user-acc-info/:email', async (req, res) => {
  let playFabID = "";
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.api.main.azureplayfab.com/Admin/GetUserAccountInfo`,
          { Email: req.body.email },
          {
              headers: {
                  'Content-Type': 'application/json',
                  'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
              }
          }
      );

      //console.log('Success:', response.data);
      res.json(response.data); // send back to client
  } catch (error) {
    console.error('Error:', error);
    if (error.response && error.response.data) {
        // Sending back the specific error information from Axios
        res.status(500).json(error.response.data);
    } else {
        // Sending back a general error if the response data is not available
        res.status(500).json({ message: error.message, stack: error.stack });
    }
  }
});

// GET USER DATA (for report)
app.post('/get-user-data/:playFabID', async (req, res) => {
  let playFabID = "";

  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.api.main.azureplayfab.com/Admin/GetUserData`,
          { PlayFabId: req.body.playFabID },
          {
              headers: {
                  'Content-Type': 'application/json',
                  'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
              }
          }
      );

      res.json(response.data); // send back to client
  } catch (error) {
    console.error('Error:', error);
    if (error.response && error.response.data) {
        // Sending back the specific error information from Axios
        res.status(500).json(error.response.data);
    } else {
        // Sending back a general error if the response data is not available
        res.status(500).json({ message: error.message, stack: error.stack });
    }
  }
});


app.post('/check-access', async (req, res) => {
  const userAccess = req.body.userAccess;

  if (!userAccess) {
    return res.status(403).json({ isAuthorized: false, error: 'Access Denied: No access level provided' });
  }

  if (userAccess.toLowerCase() === process.env.REQUIRED_ACCESS.toLowerCase()) {
    res.json({ isAuthorized: true, modalMode: 'none' });
  } else {
    res.status(403).json({ isAuthorized: false, error: 'Access Denied: Incorrect access level' });
  }
});

// EXEC SERVER
app.use(express.static('public'));

const PORT = process.env.PORT;

app.get('/', (req, res) => {
    res.send('Hello World!');
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} == ^_^ ==`);
});