const express = require('express');
const axios = require('axios');
const cors = require('cors');
const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const app = express();
const session = require('express-session');

// routes
const fetchExchangeData = require('./other/getExchangeData.js');
const googleRoutes = require('./google/googlestore.js');
const appleRoutes = require('./apple/applestore.js');
const stripeRoutes = require('./stripe/stripestore.js');
const { confRouter } = require('./confluence/confluence-tools.js');
const { suffixRouter } = require('./other/suffix.js');
const { acaAreaRouter } = require('./other/aca-area.js');
const { clickIDRouter } = require('./other/click-id.js');
const b2bRoutes = require('./other/b2b-processing.js');
const activityRoutes = require('./other/activities.js');
const topicRoutes = require('./other/topics.js');
const { dbRouter } = require('./database/database.js');
const { bitlyRouter} = require('./other/bitly.js');
const { qrCodeRouter } = require('./other/qr-code.js');
const { qrCodeDBRouter } = require('./database/qr-code-db.js');
const { cmsRouter } = require('./database/cms-api-db.js');
const { s3Router } = require('./other/s3-utils.js');
const { playfabRouter } = require('./playfab/playfab-utils.js');
const { dlRouter } = require('./other/downloads.js');
const { appEventsRouter } = require('./app_events/app-events.js');
const { userDataRouter } = require('./other/user-data.js');
const { getAllPlayerAccDataAndWriteToDB, getAllPlayerEventLogsWriteToDB } = require('./other/bulk-ops');

app.use(express.json());
app.use(cors());

// AWS METHODS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const s3 = new AWS.S3();
// GET DATABASE LAST UPDATED
app.get('/database-last-updated', async (req, res) => {
  const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: 'DatabaseLastUpdated.json'
  };

  try {
      const data = await s3.getObject(params).promise();
      const jsonData = JSON.parse(data.Body.toString('utf-8'));
      res.json(jsonData);
  } catch (err) {
      console.error('Error fetching file from S3:', err);
      res.status(500).send('Error fetching file from S3');
  }
});

// FETCH EXCHANGE RATE DATA
app.get('/getExchangeRates', async (req, res) => {
  const secret = req.headers['x-secret-key'];
  if (secret !== process.env.SERVER_SEC) {
    return res.status(401).json({ message: 'Invalid or missing secret.' });
  }

  console.log("fetching exchange data");
  await fetchExchangeData.fetchExchangeRate();
  console.log("got exchange data");
  res.send("-- Got exchange rate data --");
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

// GET USER ACC INFO (by email, for report)
app.post('/get-user-acc-info-email/:email', async (req, res) => {
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetUserAccountInfo`,
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
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetUserAccountInfo`,
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
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetPlayerProfile`,
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
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetUserData`,
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

// DELETE USER
app.post('/delete-user', async (req, res) => {
  //console.log(req.body);
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/DeletePlayer`,
          { 
            PlayFabId: req.body.PlayFabId
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
    //console.error('Error:', error);
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

// UPLOAD TO S3
const upload = multer({ dest: 'uploads/' }); // Temporary storage for uploaded files
// TODO: Change this to use the generic call in s3-utils
async function uploadToS3(filePath, bucketName, key, acl = undefined) {
  const fileContent = fs.readFileSync(filePath);

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: 'image/jpeg'
  };

  if(acl !== undefined){
    params.ACL = acl;
  }

  return s3.upload(params).promise();
}
app.post('/s3upload', upload.single('image'), async (req, res) => {
  const file = req.file;
  const acl = req.body.acl;

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  const bucketName = process.env.AWS_BUCKET;
  const key = `QRCodes/new/${file.originalname}`;

  try {
    const result = await uploadToS3(file.path, bucketName, key, acl);

    // Clean up the uploaded file
    fs.unlinkSync(file.path);

    res.json({
      message: 'Image uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).send('Error uploading image.');
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
app.use('/confluence', confRouter);
app.use('/google', googleRoutes);
app.use('/apple', appleRoutes);
app.use('/stripe', stripeRoutes);
app.use('/reporting', suffixRouter);
app.use('/aca-area', acaAreaRouter);
app.use('/click-id', clickIDRouter);
app.use('/b2b', b2bRoutes);
app.use('/activities', activityRoutes);
app.use('/topics', topicRoutes);
app.use('/db', dbRouter);
app.use('/bitly', bitlyRouter);
app.use('/qr', qrCodeRouter);
app.use('/qrdb', qrCodeDBRouter);
app.use('/cms', cmsRouter);
app.use('/S3', s3Router);
app.use('/playfab', playfabRouter);
app.use('/downloads', dlRouter);
app.use('/appevents', appEventsRouter);
app.use('/userdata', userDataRouter);
const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} == ^_^ ==`);
});