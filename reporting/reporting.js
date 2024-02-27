const AWS = require('aws-sdk');
//const axios = require('axios');
const express = require('express');
const router = express.Router();
// const fs = require('fs').promises; // Using the promise-based version of fs
// const path = require('path');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

// Get suffix mappings from S3 (connections_list)
async function getSuffixMappings() {
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
        
        return adjustedMappings;
    } catch (err) {
        console.error('Error fetching or processing suffix mappings from S3:', err);
        throw err;
    }
}

router.get('/gen-suffix-rep/:suffix', async (req, res) => {
    const { suffix } = req.params;
  
    try {
      const matchedUsers = await generateReportByEmailSuffix(suffix);
      res.json(matchedUsers);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

// Get All Data from S3
async function getAllFilesData(Bucket, Prefix) {
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

            const data = await s3.getObject(objectParams).promise();
            const jsonData = JSON.parse(data.Body.toString('utf-8'));
            filesData.push(...jsonData);
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return filesData;
}

async function generateReportByEmailSuffix(suffix) {
    let matchedUsersMap = new Map();
    let encounteredEmails = new Set();

    let suffixMappings;
    try {
        suffixMappings = await getSuffixMappings();
    } catch (err) {
        console.error('Error fetching suffix mappings:', err);
        throw err;
    }

    const Bucket = process.env.AWS_BUCKET;
    const Prefix = 'analytics/';

    try {
        // Get all file data first
        const allData = await getAllFilesData(Bucket, Prefix);

        // Now process allData to find matches
        allData.forEach(user => {
            let matchedByEmail = false;
            let checkContact = true;
            
            if (Array.isArray(user.LinkedAccounts) && user.LinkedAccounts.length > 0) {
                checkContact = false;
                user.LinkedAccounts.forEach(account => {
                    if (account.Platform === "PlayFab" && account.Email && account.Email.includes(suffix) && !encounteredEmails.has(account.Email)) {
                        encounteredEmails.add(account.Email);
                        matchedUsersMap.set(user.PlayerId, user);
                    } else if (account.Platform === "OpenIdConnect" && account.PlatformUserId.includes(suffixMappings[suffix])) {
                        matchedUsersMap.set(user.PlayerId, user);
                    }
                });
            }

            if (checkContact && !matchedUsersMap.has(user.PlayerId) && Array.isArray(user.ContactEmailAddresses)) {
                user.ContactEmailAddresses.forEach(contact => {
                    if (contact.EmailAddress && contact.EmailAddress.includes(suffix) && !encounteredEmails.has(contact.EmailAddress)) {
                        encounteredEmails.add(contact.EmailAddress);
                        matchedByEmail = true;
                    }
                });

                if (matchedByEmail) {
                    matchedUsersMap.set(user.PlayerId, user);
                }
            }
        });

        return Array.from(matchedUsersMap.values());
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}

// async function generateReportByEmailSuffix(suffix) {
//     const directoryPath = path.join(__dirname, '../data');
//     let matchedUsersMap = new Map(); // Store unique matched users
//     let encounteredEmails = new Set(); // Track encountered emails to prevent duplicates

//     let suffixMappings;
//     try {        
//         suffixMappings = await getSuffixMappings();
//     } catch (err) {
//         console.error('Error fetching suffix mappings:', err);
//         throw err;
//     }

//     //console.log(suffixMappings);

//     try {
//         const files = await fs.readdir(directoryPath);
//         for (const file of files.filter(file => path.extname(file).toLowerCase() === '.json')) {
//             const filePath = path.join(directoryPath, file);
//             const data = await fs.readFile(filePath, 'utf8');
//             const jsonData = JSON.parse(data);

//             jsonData.forEach(user => {
//                 let matchedByEmail = false;
//                 let checkContact = true;
                
//                 if (Array.isArray(user.LinkedAccounts) && user.LinkedAccounts.length > 0) {
//                     checkContact = false;
//                     user.LinkedAccounts.forEach(account => {
//                         if (account.Platform === "PlayFab" && account.Email && account.Email.includes(suffix) && !encounteredEmails.has(account.Email)) {
//                             encounteredEmails.add(account.Email);
//                             matchedUsersMap.set(user.PlayerId, user);
//                         } else if (account.Platform === "OpenIdConnect" && account.PlatformUserId.includes(suffixMappings[suffix])) {
//                             matchedUsersMap.set(user.PlayerId, user);
//                         }
//                     });
//                 }

//                 if (checkContact && !matchedUsersMap.has(user.PlayerId) && Array.isArray(user.ContactEmailAddresses)) {
//                     user.ContactEmailAddresses.forEach(contact => {
//                         if (contact.EmailAddress && contact.EmailAddress.includes(suffix) && !encounteredEmails.has(contact.EmailAddress)) {
//                             encounteredEmails.add(contact.EmailAddress);
//                             matchedByEmail = true;
//                         }
//                     });

//                     if (matchedByEmail) {
//                         matchedUsersMap.set(user.PlayerId, user);
//                     }
//                 }
//             });
//         }

//         return Array.from(matchedUsersMap.values());
//     } catch (err) {
//         console.error('Error:', err);
//         throw err;
//     }
// }

module.exports = router;