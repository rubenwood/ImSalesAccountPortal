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
  // construct deeplink
  // redirect to deeplink
  // app opens, extracts id token
  // login with open id call (playfab)
  //res.redirect(`immersifyeducation://immersifydental?idToken=${idToken}`);
  res.redirect('/reports.html');
});

// SUB STUFF
const playDeveloper = google.androidpublisher({
  version: 'v3',
  auth: oauth2Client
});
async function listSubscriptions() {
  const response = await playDeveloper.monetization.subscriptions.list({
    packageName: process.env.GOOGLE_APP_PACKAGE_ID
    //startTime: // 'startTime', // Optional parameters
    //endTime: // 'endTime' // Optional parameters
  });
  return response;
}
router.get('/get-google-prods', async (req, res) => {
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
});


async function listSubPurchases() {
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

});

router.get('/get-google-report', async (req, res) => {
  try {
    const url = `https://storage.googleapis.com/${process.env.GOOGLE_BUCKET_BASE}/financial-stats/subscriptions/${process.env.GOOGLE_SUB_FILE_BASE}.monthly_202312_country.csv`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`
      },
      responseType: 'stream' // Assuming you are downloading a file
    });

    // You might want to handle the stream properly here, depending on your needs
    response.data.pipe(res);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});

module.exports = router;