const axios = require('axios');
const express = require('express');
const router = express.Router();
const {google} = require('googleapis');
const { Storage } = require('@google-cloud/storage');
const { parse } = require('csv-parse/sync');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK
);

const scopes = [
  'https://www.googleapis.com/auth/androidpublisher',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/devstorage.read_only',
  'openid'
];

const googleauthurl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
  scope: scopes // If you only need one scope you can pass it as a string
});

// Login (reirect to URI)
router.get('/google-login', (req, res) =>{
  res.redirect(googleauthurl);
});

// callback
router.get('/google-login-callback', async (req, res) =>{
  let code = req.query.code;
  //console.log(code);
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens);

  //console.log(tokens);
  req.session.cachedAccessToken = tokens.access_token;
  const idToken = tokens.id_token; // Accessing the id_token
  //console.log('\n----ID Token----\n', idToken);
  req.session.idToken = idToken;

  // (for app)
  // construct deeplink
  // redirect to deeplink
  // app opens, extracts id token
  // login with open id call (playfab)
  //res.redirect(`immersifyeducation://immersifydental?idToken=${idToken}`);

  res.redirect(`/reports.html`);
});

const playDeveloper = google.androidpublisher({
  version: 'v3',
  auth: oauth2Client
});

// GET GOOGLE SUB REPORT
// returns a full subscription report
router.get('/get-google-report', async (req, res) => {
  if (req.session.idToken === undefined || req.session.idToken === null) {
    res.status(401).json({ error: "not logged in" });
    return;
  }

  try {
    let date = new Date();
    // Adjust date for the previous month
    date.setMonth(date.getMonth() - 1);
    let year = date.getFullYear();
    let month = ('0' + (date.getMonth() + 1)).slice(-2);
    const formattedMonth = `${year}${month}`;

    const monthlyUrl = `https://storage.googleapis.com/${process.env.GOOGLE_BUCKET_BASE}/financial-stats/subscriptions/${process.env.GOOGLE_SUB_FILE_BASE}.monthly_${formattedMonth}_country.csv`;
    const yearlyUrl = `https://storage.googleapis.com/${process.env.GOOGLE_BUCKET_BASE}/financial-stats/subscriptions/${process.env.GOOGLE_SUB_FILE_BASE}.yearly_${formattedMonth}_country.csv`;

    const requestConfig = {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${req.session.cachedAccessToken}`
      }
    };

    const [monthlyResponse, yearlyResponse] = await Promise.all([
      axios.get(monthlyUrl, requestConfig),
      axios.get(yearlyUrl, requestConfig)
    ]);

    // Decode the UTF-16LE encoded CSV content to strings
    const monthlyData = Buffer.from(monthlyResponse.data, 'binary').toString('utf16le');
    const yearlyData = Buffer.from(yearlyResponse.data, 'binary').toString('utf16le');

    // Parse the CSV strings to JSON, then sanitize keys
    const monthlyJson = sanitizeKeys(parse(monthlyData, {
      columns: true,
      skip_empty_lines: true
    }));
    const yearlyJson = sanitizeKeys(parse(yearlyData, {
      columns: true,
      skip_empty_lines: true
    }));

    // Combine and send the sanitized JSON data
    res.json({
      monthlyReport: monthlyJson,
      yearlyReport: yearlyJson
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});
// Function to sanitize keys in each object of an array
function sanitizeKeys(data) {
  return data.map(row => {
    const sanitizedRow = {};
    Object.keys(row).forEach(key => {
      sanitizedRow[toCamelCase(key)] = row[key];
    });
    return sanitizedRow;
  });
}
// Helper function to convert field names into camelCase
function toCamelCase(str) {
  return str
    .replace(/[""]/g, '') // Remove double quotes
    .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
      if (+match === 0) return ""; // or if (/\s+/.test(match)) for white space
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

// GET PURCHASERS
// calls GA to get the number of purchasers 
router.get('/get-google-purchasers', async (req, res) => {
  if (req.session.idToken == undefined || req.session.idToken == null) {
    res.status(401).json({error:"not logged in"});
    return; 
  }

  const analyticsApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROP_ID}:runReport`;

  try {    
    let googlePurchasers = await getTotalPurchasers(analyticsApiUrl, req.session.cachedAccessToken);
    res.send(googlePurchasers);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({error:'Error fetching data'});
  }
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// GET KPI REPORT
router.get('/get-kpi-report', async (req, res) => {
  if (req.session.idToken == undefined || req.session.idToken == null) {
    res.status(401).json({error: "not logged in"});
    return;
  }

  const analyticsApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROP_ID}:runReport`;
  try {
    const functions = [
      () => getUserRetention(analyticsApiUrl, req.session.cachedAccessToken),
      () => getUserRetention30Day(analyticsApiUrl, req.session.cachedAccessToken),
      () => getNewUsersPerWeek(analyticsApiUrl, req.session.cachedAccessToken),
      () => getReturningUsersPerWeek(analyticsApiUrl, req.session.cachedAccessToken),
      () => getActiveUsersPerMonth(analyticsApiUrl, req.session.cachedAccessToken),
      () => getAverageActiveUsageTime(analyticsApiUrl, req.session.cachedAccessToken),
      () => getSessionsPerUserPerWeek(analyticsApiUrl, req.session.cachedAccessToken),
      () => getActivitiesLaunchedPerWeek(analyticsApiUrl, req.session.cachedAccessToken),
    ];

    const results = [];
    for (const func of functions) {
      results.push(await func());
      await delay(700); // TODO: why do I need this?
    }

    let output = {
      userRetention: results[0],
      userRetention30Day: results[1],
      newUsersPerWeek: results[2],
      returningUsersPerWeek: results[3],
      activeUsersPerMonth: results[4],
      averageActiveUsageTime: results[5],
      sessionsPerUserPerWeek: results[6],
      activitiesLaunchedPerWeek: results[7],
    };

    res.send(output);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/get-click-id', async (req, res) => {
  if (req.session.idToken == undefined || req.session.idToken == null) {
    res.status(401).json({error: "not logged in"});
    return;
  }

  const analyticsApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROP_ID}:runReport`;
  try{
    const response = await axios.post(analyticsApiUrl,
      { 
        dateRanges: [{ startDate: "3000daysAgo", endDate: "yesterday" }],
        dimensions: [
          { name: "customEvent:playfab_id" },
          { name: "customEvent:click_id" }
        ],
        metrics: [
          {name: "totalUsers"}        
        ] 
      },
      {
        headers: {
          Authorization: `Bearer ${req.session.cachedAccessToken}`,
        }
      });

    // Extract rows from response data
    const rows = response.data.rows || [];

    const validEntries = rows.filter(row => {
      if (row.dimensionValues.length < 2) {
        return false;
      }

      const playfabIdDimension = row.dimensionValues[0].value;
      const clickIdDimension = row.dimensionValues[1].value;

      // Check for valid (non-empty, non-undefined, non-"(not set)") values
      return playfabIdDimension && playfabIdDimension !== "" && playfabIdDimension !== "(not set)" &&
             clickIdDimension && clickIdDimension !== "" && clickIdDimension !== "(not set)";
    }).map(entry => ({
      playfabId: entry.dimensionValues[0].value,
      clickId: entry.dimensionValues[1].value,
      totalUsers: entry.metricValues[0].value, // Assuming the first metric is totalUsers
    }));

    console.log(validEntries.length);
    res.json(validEntries);
  } catch (error) {
    console.error("Error fetching data from Google Analytics API:", error);
    res.status(500).json({ error: "Failed to fetch data from Google Analytics API" });
  }
});

async function getActivitiesLaunchedPerWeek(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "eventName" }],
      metrics: [
        { name: "eventCount" }
      ],
      dimensionFilter:{
        filter: {
          stringFilter: {
            matchType:"EXACT",
            value:"launch_activity"
          },
          fieldName:"eventName"
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    // response.data.rows.forEach(element =>{
    //   console.log(JSON.stringify(element.dimensionValues) + ' ' + JSON.stringify(element.metricValues));
    // })
  const launchActivityData = response.data.rows[0].metricValues[0].value;
  return launchActivityData;
}
async function getSessionsPerUserPerWeek(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "sessionsPerUser" }
      ] 
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

  const launchActivityData = response.data.rows[0].metricValues[0].value;
  return launchActivityData;
}
async function getNewUsersPerWeek(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "newUsers" }
      ] 
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

  const launchActivityData = response.data.rows[0].metricValues[0].value;

  return launchActivityData;
}
async function getActiveUsersPerMonth(analyticsApiUrl, accessToken) {
  const results = [];
  const currentDate = new Date();
  currentDate.setDate(1); // set to the first of the current month

  let startDate = new Date(2021, 1, 1); // Starting from February 2021, month index is 0-based so February is 1

  while (startDate < currentDate) {
    // last day of the current month
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    // always the first of the month
    const formattedStartDate = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-01`; 
    const formattedEndDate = endDate.toISOString().split('T')[0];
    //console.log(`Fetching data from ${formattedStartDate} to ${formattedEndDate}`);

    try {
      const response = await axios.post(analyticsApiUrl, {
        dateRanges: [{ startDate: formattedStartDate, endDate: formattedEndDate }],
        metrics: [{ name: "activeUsers" }]
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const totalActiveUsers = response.data.rows?.[0]?.metricValues[0].value ?? 0;
      results.push({ month: formattedStartDate, totalActiveUsers });

      // Properly increment the month
      startDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1); // move to the first day of the next month
    } catch (error) {
      console.error(`Error fetching data for ${formattedStartDate} to ${formattedEndDate}:`, error);
      // Continue to next month in case of an error
      startDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    }
  }

  return results;
}
async function getUserRetention(analyticsApiUrl, accessToken){
  const today = new Date();
  // Calculate yesterday's date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  // Calculate the date 42 days ago from today
  const daysAgo42 = new Date(today);
  daysAgo42.setDate(daysAgo42.getDate() - 42);
  // Function to format a date into "YYYY-MM-DD"
  function formatDate(date) {
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2); // Add leading 0 if necessary
    const day = ("0" + date.getDate()).slice(-2); // Add leading 0 if necessary
    return `${year}-${month}-${day}`;
  }

  // Format both dates
  const formattedYesterday = formatDate(yesterday);
  const formattedDaysAgo42 = formatDate(daysAgo42);

  console.log("Yesterday's date: ", formattedYesterday);
  console.log("42 days ago from today: ", formattedDaysAgo42);

  // GA User Retention Request
  const response = await axios.post(analyticsApiUrl,
    {
      dimensions: [{ name: "cohort" },{ name: "cohortNthDay" }],
      metrics: [
        { 
          name: "cohortRetentionFraction",
          expression: "cohortActiveUsers/cohortTotalUsers"
        }
      ],
      cohortSpec: {
        cohorts: [
          {
            dimension: "firstSessionDate",
            dateRange: { startDate: formattedDaysAgo42, endDate: formattedYesterday }
          }
        ],
        cohortsRange: {
          endOffset: 42,
          granularity: "DAILY"
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    return response.data.rows;
}
async function getUserRetention30Day(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "activeUsers" }
      ] 
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

  const retention30DaysData = response.data.rows[0].metricValues[0].value;

  return retention30DaysData;
}
async function getReturningUsersPerWeek(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    {
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "date" },{ name: "newVsReturning" }],
      metrics: [{ name: "totalUsers" }]
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    return response.data.rows;
}
async function getAverageActiveUsageTime(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    {
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" },{ name: "userEngagementDuration" }]
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    return response.data.rows;
}

async function getTotalPurchasers(analyticsApiUrl, accessToken){
  const response = await axios.post(analyticsApiUrl,
    {
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      metrics: [{ name: "totalPurchasers" }]
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      }
    });

    //console.log(response.data);

    return response.data.rows;
}

module.exports = router;