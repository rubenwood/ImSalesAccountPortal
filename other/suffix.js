const AWS = require('aws-sdk');
const express = require('express');
const suffixRouter = express.Router();
const { Pool } = require('pg');

const { anyFileModifiedSince, checkFileLastModified, checkFilesLastModifiedList } = require('./s3-utils');
//const { getAllS3AccData, setAllS3AccData, getLastDateGotAllS3AccData, getAllS3AccFilesData } = require('./bulk-ops');

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

// Route that takes in an array of query param gen-suffix-rep?suffixes=suffix1,suffix2
suffixRouter.get('/gen-suffix-rep', async (req, res) => {
    try {
        // Splits the suffixes into an array
        let suffixes = req.query.suffixes.split(',');
        const matchedUsers = await generateReportByEmailSuffixDB(suffixes);
        res.json(matchedUsers);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    connectionString: process.env.PGURL,
    ssl: {
        rejectUnauthorized: false,
    },
});
async function generateReportByEmailSuffixDB(suffixes) {
    if (suffixes.length < 1) { return; }

    let [suffixMappingsLastModifiedDates] = await Promise.all([
        checkFileLastModified(process.env.AWS_BUCKET, process.env.CONNECTION_LIST_PATH)
    ]);
    let suffixMappingsFilesModified = anyFileModifiedSince(suffixMappingsLastModifiedDates, lastDateGotSuffixMappings);
    let downloadPromises = [];
    // if we haven't got the S3 data yet, go get it 
    if(suffixMappings == undefined || suffixMappingsFilesModified){
        console.log("-- getting s3 suffix file");
        downloadPromises.push(getSuffixMappings().then(data => { suffixMappings = data; }));
    }
    await Promise.all(downloadPromises);

    // Construct LIKE patterns for suffixes and their corresponding mapped values for OpenIDConnect
    const likePatterns = suffixes.map(suffix => `%${suffix}%`);
    const mappedPatterns = suffixes.map(suffix => suffixMappings[suffix])
    .filter(mapping => mapping !== undefined)
    .map(mapping => `%${mapping}%`);

    // Prepare SQL Parameters: one like pattern for ContactEmailAddresses,
    // one for PlayFab login email, and one for OpenIDConnect
    const params = [likePatterns, likePatterns, mappedPatterns];

    // get all accounts that have a login email, or contact email that match a given suffix or 
    // an OpenIDConnect login that matches a given auth url (based off of the suffix)
    const query = `
        SELECT public."AccountData".*
        FROM public."AccountData"
        WHERE EXISTS (
            SELECT *
            FROM jsonb_array_elements(public."AccountData"."AccountDataJSON"::jsonb->'ContactEmailAddresses') AS cea
            WHERE cea->>'EmailAddress' LIKE ANY ($1)
        ) OR EXISTS (
            SELECT *
            FROM jsonb_array_elements(public."AccountData"."AccountDataJSON"::jsonb->'LinkedAccounts') AS la
            WHERE (la->>'Platform' = 'PlayFab' AND la->>'Email' LIKE ANY ($2))
            OR (la->>'Platform' = 'OpenIdConnect' AND la->>'PlatformUserId' LIKE ANY ($3))
        );
    `;

    let pgResult = await pool.query(query, params);
    let pgResultRows = pgResult.rows;

    let matchedUsersMap = new Map();
    let encounteredEmails = new Set();

    pgResultRows.forEach(row => {
        let user = row.AccountDataJSON;
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
                    if (contact.EmailAddress && contact.EmailAddress.includes(suffix) && 
                    !encounteredEmails.has(contact.EmailAddress)) {
                        encounteredEmails.add(contact.EmailAddress);
                        matchedUsersMap.set(user.PlayerId, user);
                    }
                });
            }
        });
    });

    return Array.from(matchedUsersMap.values());
}

module.exports = { suffixRouter, generateReportByEmailSuffixDB };
