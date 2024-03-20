const AWS = require('aws-sdk');
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const bulkRouter = express.Router();

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    connectionString: process.env.PGURL,
    ssl: {
        rejectUnauthorized: false, // Note: This disables certificate validation. See below for a more secure approach.
    },
});

const { anyFileModifiedSince, checkFilesLastModifiedList } = require('./s3-utils');

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
async function getAllS3AccFilesData(Bucket, Prefix, mode) {
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
            const objectParams = {
                Bucket,
                Key: item.Key,
            };
            
            const data = await s3.getObject(objectParams).promise();
            const jsonData = JSON.parse(data.Body.toString('utf-8'));
            if(mode == "chunks"){ 
                filesData.push(jsonData); 
            }else{
                filesData.push(...jsonData);
            }            
            
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

function setAllS3PlayerData(data){ allS3PlayerData = data; }
function getAllS3PlayerData(){ return allS3PlayerData; }

function getJobInProgress(){ return jobInProgress }

let gettingAllPlayersInProgress = false;
let allS3PlayerData;
// Gets all users player data and writes it to a series of JSON files
// TODO: add a way to control which chunk to start at
async function getAllPlayerDataAndUpload() {
    if(gettingAllPlayersInProgress){ console.log("get all player data in progress"); return; }
    gettingAllPlayersInProgress = true;

    let allS3AccDataLastModifiedDates = await checkFilesLastModifiedList(process.env.AWS_BUCKET, 'analytics/');
    let anyS3AccFilesModified = anyFileModifiedSince(allS3AccDataLastModifiedDates, lastDateGotAllS3AccData);

    if (allS3AccData === undefined || anyS3AccFilesModified) {
        allS3AccData = await getAllS3AccFilesData(process.env.AWS_BUCKET, 'analytics/', "chunks");
    }
    console.log(`Length of allS3AccData: ${allS3AccData.length}`);

    //let maxBatches = 1; // just for debugging
    // using all account data from s3, do a get player data request
    // get that data and write it to postgrest database
    let maxBatches = allS3AccData.length; //just for prod
    for (let i = 0; i < allS3AccData.length; i++) {
        console.log(`Processing chunk ${i} with ${allS3AccData[i].length} items.`);
        const playerDataBatch = [];

        // Process the current batch with concurrency control
        await requestPlayerData(allS3AccData[i], 20, playerDataBatch);

        // Once the batch is processed, upload to S3
        const batchNum = i + 1;
        // let partNum = 1;
        // const maxSize = 10 * 1024 * 1024; // 10 MB in bytes
        // let serializedData = JSON.stringify(playerDataBatch, null, 2);

        // if (Buffer.byteLength(serializedData) > maxSize) {
        //     // If the serialized data exceeds the maximum size, split and upload in parts
        //     const parts = splitIntoParts(playerDataBatch, maxSize);
        //     for (const part of parts) {
        //         const fileName = `playfab_playerdata_batch_${batchNum}_${partNum}.json`;
        //         const Key = `analytics/playerdata/${fileName}`;
        //         await uploadToS3(process.env.AWS_BUCKET, Key, part);
        //         partNum++;
        //     }
        // } else {
        //     // If the serialized data does not exceed the maximum size, upload as a single file
        //     const fileName = `playfab_playerdata_batch_${batchNum}_${partNum}.json`;
        //     const Key = `analytics/playerdata/${fileName}`;
        //     await uploadToS3(process.env.AWS_BUCKET, Key, playerDataBatch);
        // }

        for (const playerData of playerDataBatch) {
            console.log(playerData);
            console.log("\n--------------\n");
            // Adjust your INSERT query to match your database schema
            // The following is an example query. Modify it as needed.
            const insertQuery = 'INSERT INTO public."PlayerData"("PlayerDataJSON") VALUES($1)';
            await pool.query(insertQuery, [playerData]);
        }

        if(batchNum >= maxBatches){
            break;
        }
    }

    gettingAllPlayersInProgress = false;
    console.log("Finished processing all player data.");
}
getAllPlayerDataAndUpload(); // testing

function splitIntoParts(data, maxSize) {
    let parts = [];
    let currentPart = [];
    let currentSize = 0;

    for (const item of data) {
        const itemSize = Buffer.byteLength(JSON.stringify(item, null, 2));
        if (currentSize + itemSize > maxSize) {
            parts.push(currentPart);
            currentPart = [item];
            currentSize = itemSize;
        } else {
            currentPart.push(item);
            currentSize += itemSize;
        }
    }

    if (currentPart.length > 0) {
        parts.push(currentPart);
    }

    return parts;
}

async function uploadToS3(Bucket, Key, data) {
    await s3.upload({
        Bucket,
        Key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json'
    }).promise();
    console.log(`Uploaded ${Key}`);
}

async function requestPlayerData(batch, maxConcurrentRequests, playerDataBatch) {
    for (let i = 0; i < batch.length; i += maxConcurrentRequests) {
        const currentSlice = batch.slice(i, i + maxConcurrentRequests);
        const promises = currentSlice.map(element =>
            fetchPlayerData(element.PlayerId).then(playerData => {
                if (playerData) playerDataBatch.push(playerData);
            })
        );
        await Promise.all(promises);
        console.log(`Processed: ${i} to ${ (i + maxConcurrentRequests) }`)
    }
}

async function fetchPlayerData(playerId) {
    try {
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
        return response.data.data;
    } catch (error) {
        console.error('Error fetching player data:', error);
        return null; // Handle errors as needed
    }
}

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