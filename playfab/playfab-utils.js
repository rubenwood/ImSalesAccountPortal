const express = require('express');
const axios = require('axios');
const playfabRouter = express.Router();

async function authenticateSessionTicket(ticket) {
  try {
      const response = await axios.post(
          `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/AuthenticateSessionTicket`,
          { SessionTicket: ticket },
          {
              headers: {
                  'Content-Type': 'application/json',
                  'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
              }
          }
      );
      return response.data;
  } catch (error) {
      console.error('Error authenticating session ticket:', error.response ? error.response.data : error.message);
      throw new Error('Failed to authenticate session ticket');
  }
}

// TODO: refactor this to use the above function
playfabRouter.post('/auth-ticket', async (req, res) => {
    try {
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/AuthenticateSessionTicket`,
            { 
              SessionTicket: req.body.sessionTicket
            },
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
      res.status(500).json({
        message: 'An error occurred',
        error: error.message,
        details: error.response ? error.response.data : null
      });
    }
});


async function getAccessLevel(playFabId) {
    try {
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/GetUserData`,
            { 
                PlayFabId:playFabId,
                Keys: ["AccessLevel"]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
                }
            }
        );
        return response.data?.data?.Data?.AccessLevel?.Value;
    } catch (error) {
        console.error('Error authenticating session ticket:', error.response ? error.response.data : error.message);
        throw new Error('Failed to authenticate session ticket');
    }
}
playfabRouter.post('/access-level', async (req, res) => {
    const accLevel = await getAccessLevel(); 
    res.json(accLevel);
});

const lastEmailVerificationTimes = new Map();
async function sendEmailVerification(playFabId) {
    const now = Date.now();
    if (lastEmailVerificationTimes.has(playFabId) && (now - lastEmailVerificationTimes.get(playFabId) < 60000)) {
        console.error("Verification email can only be sent once per minute per user.");
        return Promise.reject("Verification email can only be sent once per minute per user.");
    }
    lastEmailVerificationTimes.set(playFabId, now);
    
    try {
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/WritePlayerEvent`,
            {
                PlayFabId: playFabId,
                EventName: "EmailVerificationDownload",
                Body: { Status: "SentEmailDownload" }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error sending verification email:", error);
        throw error;
    }
}

playfabRouter.post('/sendVerificationEmail', async (req, res) => {
    const { playFabId } = req.body;
    if (!playFabId) {
        return res.status(400).json({ error: "PlayFabId is required" });
    }
    
    try {
        const result = await sendEmailVerification(playFabId);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: "Failed to send verification email", details: error.message });
    }
});

// VERIFIED
const downloadsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Downloads</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" rel="stylesheet" />
  <link rel="stylesheet" type="text/css" href="../styles.css">
  <link rel="stylesheet" type="text/css" href="../theme_style.css">
  <script type="text/javascript" src="https://download.playfab.com/PlayFabClientApi.js"></script>
</head>
<body>

  <div class="body-wrap">
    <section class="header">
      <div class="logo">
        <img src="/immersify_logo.e141b23db21f4b78051561bc464eace7.svg" alt="Immersify Logo" class="login-logo">
      </div>
    </section>
<div class="login_wrap" id="login-area">
  <div class="login_container">
    <div class="login_wrap_fit">
    <div id="login-txt"><h3>Login or Signup to <span>Download</span></h3></div>
    <div id="password-txt"><h3>Enter the given<br/><span>Access Code</span></h3></div>
    <div id="success-txt"><h3>Authentication<br/><span>Successful<img src="../images/success.svg"></span></h3></div>
    <section class="login-signup-wrap" id="login-wrapper">
      <div class="form-general-block">
        <div id="signup-container">

          <div id="download-container">
            <p>Download ready. Click the button below to get your file.</p>
            <button id="windows-download-btn" class="btn-download" type="button"><img src="../images/download.svg" />Download for Windows</button>
            <button id="mac-download-btn" class="btn-download" type="button"><img src="../images/download.svg" />Download for Apple Mac</button>
          </div>        
        </div>
      </div>
     
    </section>
  </div>
  </div>
  
  <section class="desktop-img">
    <img src="../images/desktop.png" />
  </section>
</div>

</div>
  <script type="module" src="../scripts/downloads/downloads-logic-front.js"></script> 
</body>
</html>`;

//https://im-sales-portal-8acc2a83f73b.herokuapp.com/playfab/verified-download
playfabRouter.get('/verified-download', async (req, res) => {
    console.log("req:\n", req);
    console.log("\ntoken:\n", req.query.token);
    const queryToken = req.query.token;

    if(req.query.token){        
         return res.send(downloadsHTML);
    }else{
         return res.send(`<h1>Verification Failed</h1><p>You did not verify in time.</p><a href="/downloads/downloads.html">Go back to downloads</a>`);
    }
    
    if (!queryToken) {
        return res.send(`<h1>Verification Failed</h1><p>You did not verify in time.</p><a href="/downloads/downloads.html">Go back to downloads</a>`);
    }
    try {
        const getEntityTokenResponse = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Authentication/GetEntityToken`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY,
                }
            }
        );
        console.log("\nresponse:\n", getEntityTokenResponse);
        console.log("\nent token:\n", getEntityTokenResponse.data.data.EntityToken);
        console.log("\nent:\n", JSON.stringify(getEntityTokenResponse.data.data.Entity));
        const validationResponse = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Authentication/ValidateEntityToken`,
            { EntityToken:queryToken },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY,
                    'X-EntityToken':getEntityTokenResponse.data.data.EntityToken
                }
            }
        );
        console.log("\nvalidationResponse:\n", validationResponse.data);
    
        if (validationResponse.data && getEntityTokenResponse.data.data && getEntityTokenResponse.data.data.AccountInfo) {
            return res.send(`<h1>Verification Successful</h1><p>Download your files below:</p><a href="/downloads/file1.zip">Download File 1</a><br><a href="/downloads/file2.zip">Download File 2</a>`);
        } else {
            return res.send(`<h1>Verification Failed</h1><p>You did not verify in time.</p><a href="/downloads/downloads.html">Go back to downloads</a>`);
        }
    } catch (error) {
        console.error("Error verifying session:", error);
        return res.send(`<h1>Verification Failed</h1><p>An error occurred during verification.</p><a href="/downloads/downloads.html">Go back to downloads</a>`);
    }
})


module.exports = { playfabRouter, authenticateSessionTicket, getAccessLevel };