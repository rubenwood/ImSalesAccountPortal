const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const appEventsRouter = express.Router();

const { getS3JSONFile } = require('../other/s3-utils');

appEventsRouter.get('/get-event-details', async (req, res) => {
    const appEventDetails = await getS3JSONFile('AppEvents/fully_filled_event_descriptions.json');
    res.json(appEventDetails);
});
module.exports = { appEventsRouter };