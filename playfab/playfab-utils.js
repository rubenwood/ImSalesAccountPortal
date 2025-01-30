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

let lastEmailVerificationTime = 0;
async function sendEmailVerification(playFabId) {
    const now = Date.now();
    if (now - lastEmailVerificationTime < 60000) {
        console.error("Verification email can only be sent once per minute.");
        return Promise.reject("Verification email can only be sent once per minute.");
    }
    lastEmailVerificationTime = now;
    
    try {
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Admin/WritePlayerEvent`,
            {
                PlayFabId: playFabId,
                EventName: "EmailVerificationEvent",
                Body: { Status: "SentEmail" }
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


module.exports = { playfabRouter, authenticateSessionTicket, getAccessLevel };