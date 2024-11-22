const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const appEventsRouter = express.Router();

const { getS3JSONFile } = require('../other/s3-utils');

// pull the event details json everyday (CRON JOB)
// process into a new table - AppEventDetails

// develop end points to get details 
// get-event-details (done)
// get-event-details-by-name (TODO)

appEventsRouter.get('/get-event-details', async (req, res) => {
    const appEventDetails = await getS3JSONFile('AppEvents/fully_filled_event_descriptions.json');
    res.json(appEventDetails);
});

module.exports = { appEventsRouter };