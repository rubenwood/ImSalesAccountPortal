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

/*async function listSubscriptions() {
  const response = await playDeveloper.monetization.subscriptions.list({
    packageName: process.env.GOOGLE_APP_PACKAGE_ID
    //startTime: // 'startTime', // Optional parameters
    //endTime: // 'endTime' // Optional parameters
  });
  return response;
}*/

/*router.get('/get-google-prods', async (req, res) => {
    let subListResp = await listSubscriptions();
    let subList = subListResp.data;
    let subscriptionProds = subList.subscriptions;
    console.log(subList);
    console.log(subscriptionProds);
    let prodIDs = [];
    subscriptionProds.forEach((prod) =>{
      prodIDs.push(prod.productId);
    })
    res.send(JSON.stringify(prodIDs));
});*/

/*async function listSubPurchases() {
  const response = await playDeveloper.purchases.subscriptions.get({
    packageName: process.env.GOOGLE_APP_PACKAGE_ID,
    subscriptionId: 'com.immersifyeducation.immersifydental.monthly'
  });
  return response;
}*/
/*router.get('/get-google-purchases', async (req, res) => {
  const url = 'https://play.google.com/console/u/0/developers/6876057134054731100/app/4973007238115949118/reporting/subscriptions/overview?from=2024-02-26&to=2024-03-03&product_id=ALL';

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${req.session.cachedAccessToken}`
      }
    });

    const htmlData = response.data;
    console.log(htmlData);
    // Attempt to extract the content using a regular expression
    const regex = /<span class="value _ngcontent-jvh-86" aria-describedby="console-scorecard-label-21">(\d+)<\/span>/;
    const match = regex.exec(htmlData);
    let extractedValue = "";
    if (match && match[1]) {
      extractedValue = match[1];
    }

    console.log(`Extracted Value: ${extractedValue}`);
    res.setHeader('Content-Type', 'text/plain');
    res.send(htmlData);
    //res.send(`Extracted Value: ${extractedValue}`);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Failed to fetch data');
  }
});*/

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
      await delay(700);
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
async function getActiveUsersPerMonth(analyticsApiUrl, accessToken){
  let results = [];
  let startDate = new Date("2023-01-01");
  let currentDate = new Date(); // Current date
  currentDate.setDate(1); // Set to the first of the current month

  while (startDate < currentDate) {
    let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    let formattedStartDate = startDate.toISOString().split('T')[0];
    let formattedEndDate = endDate.toISOString().split('T')[0];

    try {
      const response = await axios.post(analyticsApiUrl,
        {
          dateRanges: [{ startDate: formattedStartDate, endDate: formattedEndDate }],
          metrics: [{ name: "activeUsers" }]
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          }
        });

      // Check if the response has data
      if (response.data.rows && response.data.rows.length > 0) {
        let totalActiveUsers = response.data.rows[0].metricValues[0].value;
        results.push({
          month: formattedStartDate,
          totalActiveUsers
        });
      } else {
        // Handle case where no data is returned for the month
        results.push({
          month: formattedStartDate,
          totalActiveUsers: 0
        });
      }

      // Move to the next month
      startDate = endDate;
    } catch (error) {
      console.error(`Error fetching data for ${formattedStartDate} - ${formattedEndDate}: ${error}`);
      // Handle errors as required for your application
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