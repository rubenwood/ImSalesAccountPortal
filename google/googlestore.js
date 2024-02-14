const axios = require('axios');
const express = require('express');
const router = express.Router();
const {google} = require('googleapis');
const { Storage } = require('@google-cloud/storage');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK
);

// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  'https://www.googleapis.com/auth/androidpublisher',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/devstorage.read_only',
  'openid'
];
const googleauthurl = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',
  // If you only need one scope you can pass it as a string
  scope: scopes
});
// Login (reirect to URI)
router.get('/google-login', (req, res) =>{
  res.redirect(googleauthurl);
});
// callback
let cachedAccessToken;
router.get('/google-login-callback', async (req, res) =>{
  let code = req.query.code;
  console.log(code);
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens);

  console.log(tokens);
  cachedAccessToken = tokens.access_token;
  const idToken = tokens.id_token; // Accessing the id_token
  console.log('\n----ID Token----\n', idToken);
  req.session.idToken = idToken;

  // (for app)
  // construct deeplink
  // redirect to deeplink
  // app opens, extracts id token
  // login with open id call (playfab)
  //res.redirect(`immersifyeducation://immersifydental?idToken=${idToken}`);

  res.redirect(`/reports.html`);
});

// SUB STUFF
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
    //startTime: // 'startTime', // Optional parameters
    //endTime: // 'endTime' // Optional parameters
  });
  return response;
}
router.get('/get-google-purchases', async (req, res) => {
  let subListResp = await listSubPurchases();
  console.log(subListResp);

});*/

// GET GOOGLE SUB REPORT
// returns a full subscription report
router.get('/get-google-report', async (req, res) => {
  if (req.session.idToken == undefined || req.session.idToken == null) { return; }

  try {
    const url = `https://storage.googleapis.com/${process.env.GOOGLE_BUCKET_BASE}/financial-stats/subscriptions/${process.env.GOOGLE_SUB_FILE_BASE}.monthly_202402_country.csv`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`
      }
      //,responseType: 'stream' // Assuming you are downloading a file
    });
    //response.data.pipe(res);
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});

// GET PURCHASERS
// calls GA to get the number of purchasers 
router.get('/get-google-purchasers', async (req, res) => {
  if (req.session.idToken == undefined || req.session.idToken == null) { return; }
  const analyticsApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROP_ID}:runReport`;

  try {    
    let googlePurchasers = await getTotalPurchasers(analyticsApiUrl);
    res.send(googlePurchasers);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});


// GET KPI REPORT
router.get('/get-kpi-report', async (req, res) => {
  const analyticsApiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROP_ID}:runReport`;

  try {
    let userRetention = await getUserRetention(analyticsApiUrl);
    let userRetention30Day = await getUserRetention30Day(analyticsApiUrl);
    let newUsersPerWeek = await getNewUsersPerWeek(analyticsApiUrl);
    let returningUsersPerWeek = await getReturningUsersPerWeek(analyticsApiUrl);
    let activeUsersPerMonth = await getActiveUsersPerMonth(analyticsApiUrl);
    let averageActiveUsageTime = await getAverageActiveUsageTime(analyticsApiUrl); 
    let sessionsPerUserPerWeek = await getSessionsPerUserPerWeek(analyticsApiUrl);
    let activitiesLaunchedPerWeek = await getActivitiesLaunchedPerWeek(analyticsApiUrl);

    let output = { 
      userRetention,
      userRetention30Day,
      newUsersPerWeek,
      returningUsersPerWeek,
      activeUsersPerMonth,
      averageActiveUsageTime,
      sessionsPerUserPerWeek,
      activitiesLaunchedPerWeek,
    };
    res.send(output);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

async function getActivitiesLaunchedPerWeek(analyticsApiUrl){
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
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

  const launchActivityData = response.data.rows[0].metricValues[0].value;
  return launchActivityData;
}
async function getSessionsPerUserPerWeek(analyticsApiUrl){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "sessionsPerUser" }
      ] 
    },
    {
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

  const launchActivityData = response.data.rows[0].metricValues[0].value;
  return launchActivityData;
}
async function getNewUsersPerWeek(analyticsApiUrl){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "newUsers" }
      ] 
    },
    {
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

  const launchActivityData = response.data.rows[0].metricValues[0].value;

  return launchActivityData;
}
async function getActiveUsersPerMonth(analyticsApiUrl){
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
            Authorization: `Bearer ${cachedAccessToken}`,
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
async function getUserRetention(analyticsApiUrl){
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
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

    return response.data.rows;
}
async function getUserRetention30Day(analyticsApiUrl){
  const response = await axios.post(analyticsApiUrl,
    { 
      dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "activeUsers" }
      ] 
    },
    {
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

  const retention30DaysData = response.data.rows[0].metricValues[0].value;

  return retention30DaysData;
}
async function getReturningUsersPerWeek(analyticsApiUrl){
  const response = await axios.post(analyticsApiUrl,
    {
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "date" },{ name: "newVsReturning" }],
      metrics: [{ name: "totalUsers" }]
    },
    {
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

    return response.data.rows;
}
async function getAverageActiveUsageTime(analyticsApiUrl){
  const response = await axios.post(analyticsApiUrl,
    {
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" },{ name: "userEngagementDuration" }]
    },
    {
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

    console.log("ENGAGEMENT TIME PER WEEK");
    console.log(response);

    return response.data.rows;
}

async function getTotalPurchasers(analyticsApiUrl){
  const response = await axios.post(analyticsApiUrl,
    {
      dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
      metrics: [{ name: "totalPurchasers" }]
    },
    {
      headers: {
        Authorization: `Bearer ${cachedAccessToken}`,
      }
    });

    console.log(response.data);

    return response.data.rows;
}


module.exports = router;