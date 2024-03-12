const AWS = require('aws-sdk');
const express = require('express');
const suffixRouter = express.Router();

const { anyFileModifiedSince, checkFileLastModified, checkFilesLastModifiedList } = require('./s3-utils');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

// Get suffix mappings from S3 (connections_list)
let suffixMappings;
let lastDateGotSuffixMappings;
async function getSuffixMappings() {
    console.log("getting s3 suffix mappings");
    const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: process.env.CONNECTION_LIST_PATH
    };

    try {
        const data = await s3.getObject(params).promise();
        const mappings = JSON.parse(data.Body.toString());
    
        const adjustedMappings = {};

        for (const curr of mappings.OpenIDConnections) {
          if (curr.mechanism && curr.mechanism.authorizeURL) {
            const authorizeURL = curr.mechanism.authorizeURL;
            const adjustedAuthorizeURL = authorizeURL // this will need to be updated if any new deviations are added
              .replace(/\/oauth2\/v2\.0\/authorize$/, '')
              .replace(/\/openam\/oauth2\/authorize$/, '');
            adjustedMappings[curr.suffix] = adjustedAuthorizeURL;
          } else {
            console.warn(`Warning: Missing mechanism or authorizeURL for connectionID: ${curr.connectionID}`);
          }
        }
        console.log("got s3 suffix mappings");
        lastDateGotSuffixMappings = new Date();
        return adjustedMappings;
    } catch (err) {
        console.error('Error fetching or processing suffix mappings from S3:', err);
        throw err;
    }
}

// Get All Data from S3
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
            ContinuationToken: continuationToken,
        }).promise();

        for (const item of response.Contents) {
            const objectParams = {
                Bucket,
                Key: item.Key,
            };
            //console.log(`S3: getting file data ${item.Key}`);
            const data = await s3.getObject(objectParams).promise();
            const jsonData = JSON.parse(data.Body.toString('utf-8'));
            filesData.push(...jsonData);
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    lastDateGotAllS3AccData = new Date();

    return filesData;
}

// Modified route that takes in an array of query param gen-suffix-rep?suffixes=suffix1,suffix2
suffixRouter.get('/gen-suffix-rep', async (req, res) => {
    try {
        // Splits the suffixes into an array
        let suffixes = req.query.suffixes.split(',');
        const matchedUsers = await generateReportByEmailSuffix(suffixes);
        res.json(matchedUsers);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

async function generateReportByEmailSuffix(suffixes) {
    let matchedUsersMap = new Map();
    let encounteredEmails = new Set();

    let [allS3AccDataLastModifiedDates, suffixMappingsLastModifiedDates] = await Promise.all([
        checkFilesLastModifiedList(process.env.AWS_BUCKET, 'analytics/'),
        checkFileLastModified(process.env.AWS_BUCKET, process.env.CONNECTION_LIST_PATH)
    ]);
    let anyS3AccFilesModified = anyFileModifiedSince(allS3AccDataLastModifiedDates, lastDateGotAllS3AccData);
    let suffixMappingsFilesModified = anyFileModifiedSince(suffixMappingsLastModifiedDates, lastDateGotSuffixMappings);

    // if we haven't got the S3 data yet, go get it 
    if(suffixMappings == undefined || suffixMappingsFilesModified){
        console.log("-- getting s3 suffix file");
        suffixMappings = await getSuffixMappings();
    }    
    // TODO: rather than waiting on getting all files, just search each file as it comes in
    if(allS3AccData == undefined || anyS3AccFilesModified){
        console.log("-- getting s3 acc file");
        allS3AccData = await getAllS3AccFilesData(process.env.AWS_BUCKET, 'analytics/');
    }

    try {
        allS3AccData.forEach(user => {
            suffixes.forEach(suffix => {
                let checkContact = true;

                if (Array.isArray(user.LinkedAccounts) && user.LinkedAccounts.length > 0) {
                    user.LinkedAccounts.forEach(account => {
                        // if the user has PlayFab or OpenIdConnect account, then don't check contact address
                        if(account.Platform == "PlayFab" || account.Platform == "OpenIdConnect"){ checkContact = false; }

                        if (account.Platform == "PlayFab" && account.Email && account.Email.includes(suffix)){// && !encounteredEmails.has(account.Email)) {
                            encounteredEmails.add(account.Email);
                            matchedUsersMap.set(user.PlayerId, user);
                            checkContact = false;
                        } else if (account.Platform == "OpenIdConnect" && account.PlatformUserId.includes(suffixMappings[suffix])) {
                            matchedUsersMap.set(user.PlayerId, user);
                            checkContact = false;
                        }
                    });
                }

                if (checkContact && Array.isArray(user.ContactEmailAddresses) && !matchedUsersMap.has(user.PlayerId)) {
                    user.ContactEmailAddresses.forEach(contact => {
                        if (contact.EmailAddress && contact.EmailAddress.includes(suffix) && !encounteredEmails.has(contact.EmailAddress)) {
                            encounteredEmails.add(contact.EmailAddress);
                            matchedUsersMap.set(user.PlayerId, user);
                        }
                    });
                }
            });
        });

        return Array.from(matchedUsersMap.values());
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}

module.exports = { suffixRouter, generateReportByEmailSuffix };
