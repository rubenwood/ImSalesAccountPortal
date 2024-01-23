const express = require('express');
const router = express.Router();
const {google} = require('googleapis');
//const apis = google.getSupportedAPIs();

// TEST
router.get('/googletest', (req, res) => {
    res.send('This is the Google route');
});

// OAuth stuff
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK
);

// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  'https://www.googleapis.com/auth/androidpublisher'
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
router.get('/google-login-callback', async (req, res) =>{
  let code = req.query.code;
  console.log(code);
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens);

  console.log(tokens);
  res.send('You made it!');
});

// SUB STUFF
const playDeveloper = google.androidpublisher({
  version: 'v3',
  auth: oauth2Client
});
async function listSubscriptions() {
  const response = await playDeveloper.monetization.subscriptions.list({
    packageName: process.env.GOOGLE_APP_PACKAGE_ID// 'yourPackageName',
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
    packageName: process.env.GOOGLE_APP_PACKAGE_ID, // 'yourPackageName',
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

module.exports = router;