const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const bulkRouter = express.Router();

const { anyFileModifiedSince, checkFileLastModified, checkFilesLastModifiedList } = require('./s3-utils');

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
        jobInProgress = true;
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

let allS3AccData;
let lastDateGotAllS3AccData;
async function getAllS3AccFilesData(Bucket, Prefix) {
    console.log("getting s3 acc data");
    let continuationToken;
    let filesData = [];

    do {
        const response = await s3.listObjectsV2({
            Bucket,
            Prefix,
            Delimiter: '/', // Ignore subfolders by treating slash as delimiter
            ContinuationToken: continuationToken,
        }).promise();

        let index = 0;
        for (const item of response.Contents) {
            //if(item.Key == "analytics/playerdata/"){ continue; }

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
    allS3AccData = filesData;
    return filesData;
}

function setLastDateGotAllS3AccData(newDate){ lastDateGotAllS3AccData = newDate; }
function getLastDateGotAllS3AccData(){ return lastDateGotAllS3AccData; }

function setAllS3AccData(data) { allS3AccData = data; }
function getAllS3AccData() { return allS3AccData; }

function getJobInProgress(){ return jobInProgress }

// Gets all users player data and writes it to a series of JSON files
async function getAllPlayerDataAndUpload()
{
    let allS3AccDataLastModifiedDates = await checkFilesLastModifiedList(process.env.AWS_BUCKET, 'analytics/');
    let anyS3AccFilesModified = anyFileModifiedSince(allS3AccDataLastModifiedDates, lastDateGotAllS3AccData);
    // if we dont have the data, or if there is a new version on S3 then get it
    if(allS3AccData == undefined || anyS3AccFilesModified){
        await getAllS3AccFilesData(process.env.AWS_BUCKET, 'analytics/').then(data => { allS3AccData = data; })
    }

    // for each entry, do the get player data call 
    // and write to JSON 
    // and upload to S3

    //get user data call using this id
    // do 10000 players per batch
    // stagger API calls
    // write each batch to a file
    let batchNumber = 1;
    let maxUserPerBatchCount = 10;
    let playerDataBatch = [];
    let totalBatches = allS3AccData.length / maxUserPerBatchCount;
    console.log(`given ${allS3AccData.length} total users, with ${maxUserPerBatchCount} per batch, there will be ${totalBatches} batches`);
    console.log(allS3AccData[0]);
    console.log(allS3AccData[0].PlayerId);
    
    for(let i = 0; i < allS3AccData.length; i++){
        if(i >= maxUserPerBatchCount){ break; }

        let playerId = allS3AccData[i].PlayerId;
        console.log(playerId);
        try{
            const response = await axios.post(
                `https://${process.env.PLAYFAB_TITLE_ID}.api.main.azureplayfab.com/Admin/GetUserData`,
                { PlayFabId: playerId },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-SecretKey': process.env.PLAYFAB_SECRET_KEY
                    }
                }
            );
            let playerData = response.data.data;
            //console.log(playerData);
            playerDataBatch.push(playerData);
        }catch(error){
            console.log('Error:', error);
        }
        //batchNumber++;
        //let output = {PlayFabId: playerId, PlayerData: playerData};        
        //console.log(output);
    }

    const fileName = `playfab_playerdata_batch_${batchNumber}.json`;
    const Bucket = process.env.AWS_BUCKET;
    const Key = `analytics/playerdata/${fileName}`;
  
    // await s3.upload({
    //     Bucket,
    //     Key,
    //     Body: JSON.stringify(playerDataBatch, null, 2),
    //     ContentType: 'application/json'
    // }).promise();

    console.log("done getting all player data");
}
getAllPlayerDataAndUpload();


// Gets the player data for players stored in all players
bulkRouter.post('/get-all-player-data', async (req,res) => {

});

module.exports = {
    bulkRouter,
    getJobInProgress,
    getAllS3AccData,
    setAllS3AccData,
    getLastDateGotAllS3AccData,
    setLastDateGotAllS3AccData,
    getAllPlayersAndUpload,
    getAllS3AccFilesData,
};