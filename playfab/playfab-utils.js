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
      return response.data; // Return the response data
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

module.exports = { playfabRouter, authenticateSessionTicket };