const express = require('express');
// const session = require('express-session');
// const redis = require('redis');
// const RedisStore = require("connect-redis").default;
const axios = require('axios');
const cors = require('cors');
const AWS = require('aws-sdk');
require('dotenv').config();
const app = express();
const session = require('express-session');
// file ops
const fs = require('fs');
const path = require('path');
// routes
const googleRoutes = require('./google/googlestore.js');
const appleRoutes = require('./apple/applestore.js');
const stripeRoutes = require('./stripe/stripestore.js');
const { suffixRouter }  = require('./other/suffix.js');
const { acaAreaRouter }  = require('./other/aca-area.js');
const { clickIDRouter }  = require('./other/click-id.js');
const b2bRoutes = require('./other/b2b-processing.js');
const activityRoutes = require('./other/activities.js');
const { dbRouter }  = require('./database/database.js');
const { bitlyRouter} = require('./other/bitly.js');
const { getAllPlayerAccDataAndWriteToDB } = require('./other/bulk-ops');

app.use(express.json());
app.use(cors());

// AWS METHODS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
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
  let reason = req.body.reason;

  const pageId = req.params.pageId;
  const pageContent = await getPageDetails(pageId);
  let newPageContent = pageContent;
  
  // Parse the existing content to add a new row to the table
  if (newPageContent.includes("</tbody>")) {
    const newRow = `<tr><td>${email}</td><td>${pass}</td><td>${area}</td><td>${expiry}</td><td>${createdBy}</td><td>${reason}</td></tr>`;
    newPageContent = pageContent.replace("</tbody>", `${newRow}</tbody>`);
  } else {
      console.log("No table found in Confluence page");
      // If no table exists, create one
      newPageContent = `<table><tbody><tr><td><b>Email</b></td><td><b>Password</b></td><td><b>Area</b></td><td><b>Expiry</b></td><td><b>Created / Updated By</b></td><td><b>Reason</b></td></tr></tbody></table>`;
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

// GET USER ACC INFO (by email, for report)
app.post('/get-user-acc-info-email/:email', async (req, res) => {
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

      res.json(response.data);
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
app.post('/get-user-acc-info-id/:playFabID', async (req, res) => {
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.api.main.azureplayfab.com/Admin/GetUserAccountInfo`,
          { PlayFabId: req.body.playFabID },
          {
              headers: {
                  'Content-Type': 'application/json',
                  'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
              }
          }
      );

      res.json(response.data);
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
// GET USER PROFILE
app.post('/get-user-profile-id/:playFabID', async (req, res) => {
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.api.main.azureplayfab.com/Admin/GetPlayerProfile`,
          { 
            PlayFabId: req.body.playFabID,
            ProfileConstraints: { ShowContactEmailAddresses:true }
          },
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

// GET USER DATA (for report)
app.post('/get-user-data/:playFabID', async (req, res) => {
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
// PLAYFAB UPDATE USER DATA
app.post('/update-user-data', async (req, res) => {
  //console.log(req.body);
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/UpdateUserData`,
          { 
            PlayFabId: req.body.playFabID,
            Data: req.body.updateData
          },
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
    res.status(500).json({
      message: 'An error occurred',
      error: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// CHECK USER ACCESS
app.post('/check-access', async (req, res) => {
  const userAccess = req.body.userAccess;

  if (!userAccess) {
    return res.status(403).json({ isAuthorized: false, error: 'Access Denied: No access level provided' });
  }

  if (userAccess.toLowerCase() === process.env.REQUIRED_ACCESS.toLowerCase()) {
    //req.session.isAuthorized = true;
    res.json({ isAuthorized: true });
  } else {
    res.status(403).json({ isAuthorized: false, error: 'Access Denied: Incorrect access level' });
  }
});

// GET ALL SEGMENTS
app.post('/get-segments', async (req, res) => {
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetAllSegments`,
          {},
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
// GET ALL PLAYERS IN A SEGMENT
app.post('/get-segment-players/:segmentID', async (req, res) => {
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetPlayersInSegment`,
          { 
            SegmentId: req.body.segmentID,
            MaxBatchSize: req.body.maxBatchSize
          },
          {
            headers: {
                'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
            }
          }          
      );

      res.json(response.data);
  } catch (error) {
    console.error('Error:', error);
    if (error.response && error.response.data) {
        res.status(500).json(error.response.data);
    } else {
        res.status(500).json({ message: error.message, stack: error.stack });
    }
  }
});

// GET PLAYFAB DATA REPORT
app.post('/get-playfab-report', async (req, res) => {
  try {
    const { day, month, year, reportName } = req.body;

    const playFabResponse = await axios.post(
      `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetDataReport`, {
        Day: day,
        Month: month,
        Year: year,
        ReportName: reportName
      }, {
        headers: {
          'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
        }
      }
    );

    const reportURL = playFabResponse.data.data.DownloadUrl;
    const csvResponse = await fetch(reportURL);
    if (!csvResponse.ok) {
      throw new Error('Failed to fetch CSV report from PlayFab');
    }
    const csvData = await csvResponse.text();

    res.header('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      message: error.message,
      stack: error.stack
    });
  }
});

// GET ALL PLAYERS
// Gets all players and uploads resulting files to S3
// executes asynchronously, so this will provide a response before the job completes
app.get('/begin-get-all-players', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
      return res.status(401).json({ message: 'Invalid or missing secret.' });
  }
  
  try { 
      getAllPlayerAccDataAndWriteToDB();  
      res.json({ message: 'Begin getting all players initiated successfully.' });
  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Failed to initiate getting all players.' });
  }
});

// server session
app.use(session({
  secret: process.env.SESSION_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// EXEC SERVER
app.use(express.static('public'));
app.use('/google', googleRoutes);
app.use('/apple', appleRoutes);
app.use('/stripe', stripeRoutes);
app.use('/reporting', suffixRouter);
app.use('/aca-area', acaAreaRouter);
app.use('/click-id', clickIDRouter);
app.use('/b2b', b2bRoutes);
app.use('/activities', activityRoutes);
app.use('/db', dbRouter);
app.use('/bitly', bitlyRouter);
const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} == ^_^ ==`);
});