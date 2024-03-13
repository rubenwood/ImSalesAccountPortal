const AWS = require('aws-sdk');
const express = require('express');
const bulkRouter = express.Router();

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

let jobInProgress = false;


async function getAllPlayersAndUpload() {
    let contToken = null;
    let batchNumber = 0;
    let timestamp = new Date();
    console.log(`getting all players ${timestamp}`);
  
    do {
        const response = await axios.post(
            `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetPlayersInSegment`,
            {
                SegmentId: process.env.PLAYFAB_ALLSEG_ID,
                MaxBatchSize: 10000,
                ContinuationToken: contToken,
            },
            {
                headers: {
                    'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
                }
            }
        );
  
        batchNumber++;
        const fileName = `playfab_players_batch_${batchNumber}.json`;
        const Bucket = process.env.AWS_BUCKET;
        const Key = `analytics/${fileName}`;
  
        await s3.upload({
            Bucket,
            Key,
            Body: JSON.stringify(response.data.data.PlayerProfiles, null, 2),
            ContentType: 'application/json'
        }).promise();
  
        contToken = response.data.data.ContinuationToken;
  
    } while (contToken);
  
    jobInProgress = false;
}
bulkRouter.post('/get-all-players', async (req, res) => {
    try {
        await getAllPlayersAndUpload();
        res.json({ message: 'Data retrieval complete. All batches written to S3.' });
    } catch (error) {
        console.error('Error:', error);
        if (error.response && error.response.data) {
            res.status(500).json(error.response.data);
        } else {
            res.status(500).json({ message: error.message, stack: error.stack });
        }
    }
});
// Same as above, but used by cron jobs
bulkRouter.get('/begin-get-all-players', async (req, res) => {
    const secret = req.headers['x-secret-key'];
    if (secret !== "TEST123") {
        return res.status(401).json({ message: 'Invalid or missing secret.' });
    }

    try {
        jobInProgress = true;
        getAllPlayersAndUpload();      
        res.json({ message: 'Begin getting all players initiated successfully.' });
    } catch (error) {
        jobInProgress = false;
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to initiate getting all players.' });
    }
});

async function getAllS3AccFilesData(Bucket, Prefix) {
    console.log("getting s3 acc data");
    let continuationToken;
    let filesData = [];

    do {
        const response = await s3.listObjectsV2({
            Bucket,
            Prefix,
            ContinuationToken: continuationToken,
        }).promise();

        let index = 0;
        for (const item of response.Contents) {
            const objectParams = {
                Bucket,
                Key: item.Key,
            };
            
            const data = await s3.getObject(objectParams).promise();
            const jsonData = JSON.parse(data.Body.toString('utf-8'));
            filesData.push(...jsonData);
            index++;
            console.log(`S3: got file ${index} / ${response.Contents.length}`);
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    lastDateGotAllS3AccData = new Date();
    console.log("got all s3 acc data");
    return filesData;
}

// Gets the player data for players stored in all players
bulkRouter.post('/get-all-player-data', async (req,res) => {

});

bulkRouter.exports = {
    getAllPlayersAndUpload,
    getAllS3AccFilesData,
};