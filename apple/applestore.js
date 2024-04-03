const jwt = require('jsonwebtoken');
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const router = express.Router();
const zlib = require('zlib');

const privateKey = process.env.APPLE_PKK.replace(/\\n/g, '\n');

let cachedToken = null;
let tokenTimestamp = null;

const generateToken = () => {
    const currentTime = Math.floor(Date.now() / 1000);

    // Check if the existing token is still valid
    if (cachedToken && tokenTimestamp && currentTime - tokenTimestamp < 20 * 60) {
        return cachedToken;
    }

    // Generate a new token
    const jwtHeader = {
        "alg": "ES256",
        "kid": process.env.APPLE_KID,
        "typ": "JWT"
    };
    const jwtPayload = {
        "iss": process.env.APPLE_ISS,
        "iat": currentTime,
        "exp": currentTime + (20 * 60),
        "aud": "appstoreconnect-v1"
    };

    cachedToken = jwt.sign(jwtPayload, privateKey, { header: jwtHeader, algorithm: 'ES256' });
    tokenTimestamp = currentTime;

    return cachedToken;
};

// TEST
router.get('/appletest', async (req, res) => {
    try {
        const jwtoken = generateToken();
        //console.log(jwtoken);
        let resp = await axios.get("https://api.appstoreconnect.apple.com/v1/apps", {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            }
        });
        console.log("\n-------\nSUCCESS\n");
        console.log(resp.data);
        res.send(`you made it!<br/>${JSON.stringify(resp.data)}`);
    } catch (error) {
        console.error("Axios Error:", error.response ? error.response.data : error.message);
        res.status(500).send('Error occurred');
    }
});

let subGroupIds;
router.get('/get-sub-groups', async (req, res) => {
    try {
        const jwtoken = generateToken();
        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/apps/${process.env.APPLE_ID}/subscriptionGroups`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            }
        });
        console.log("\n-------\nSUCCESS\n");
        let subGroups = resp.data.data;
        //console.log(subGroups);
        subGroupIds = subGroups.map((subGroup) => subGroup.id);
        res.send(subGroupIds);
    } catch (error) {
        console.error("Axios Error:", error.response ? error.response.data : error.message);
        res.status(500).send('Error occurred');
    }
});

router.get('/list-subs', async (req, res) => {
    try {
        if(subGroupIds === undefined){
            res.send('No sub groups');
        }

        console.log(subGroupIds[0]);

        const jwtoken = generateToken();
        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/subscriptionGroups/${subGroupIds[0]}/subscriptions`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            }
        });
        console.log("\n-------\nSUCCESS\n");
        console.log(resp.data);
        res.send(JSON.stringify(resp.data));
    } catch (error) {
        console.error("Axios Error:", error.response ? error.response.data : error.message);
        res.status(500).send('Error occurred');
    }
});

// SALES REPORT
router.get('/get-sales-report', async (req, res) => {
    try {
        const jwtoken = generateToken();
        const queryParams = {
            'filter[frequency]': 'MONTHLY', // DAILY WEEKLY MONTHLY YEARLY
            'filter[reportType]': 'SALES', // SALES SUBSCRIPTION SUBSCRIBER
            'filter[reportSubType]': 'SUMMARY',
            'filter[vendorNumber]': process.env.APPLE_VEN,
            'filter[reportDate]': '2023-12'            
        };

        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/salesReports`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            },
            params: queryParams,
            responseType: 'arraybuffer'
        });

        let output = await processSalesReport(resp.data);
        //res.send(`${resp.data}\nEND`);
        res.send(`${output}\nEND`);
    } catch (error) {
        console.error("Axios Error:", error.response ? error.response.data : error.message);
        res.status(500).send('Error occurred');
    }
});
async function processSalesReport(respData){
    let saleCount = 0;
    let unitCount = 0;
    let htmlTable = '<table style="border-collapse: collapse; width: 100%;">';

    // Wrap the zlib.gunzip in a Promise
    const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(respData, (err, buffer) => {
            if (err) {
                reject(err);
            } else {
                resolve(buffer.toString());
            }
        });
    }).catch(err => {
        console.error("Decompression Error:", err);
        throw new Error('Error occurred during decompression');
    });

    const rows = decompressed.split('\n');

    rows.forEach((row, index) => {
        let shouldSubtract = false;
        let cells = row.split('\t');
        htmlTable += '<tr>';

        cells.forEach((cell, cellIndex) => {
            if (index === 0) {
                htmlTable += `<th style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${cell}</th>`;
            } else {
                htmlTable += `<td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${cell}</td>`;

                // Increase saleCount if the row has SKU not equal to "1.0"
                // Assuming SKU is in the third column (cellIndex === 2)
                if (cellIndex === 2 && cell !== "1.0") {
                    saleCount++;
                    shouldSubtract = true; // Set the flag to true if condition meets
                }

                // Process unit count based on the flag
                if(cellIndex === 7){
                    let unitValue = parseInt(cell, 10); // Parse the cell value as integer
                    if(shouldSubtract){
                        unitCount -= unitValue; // Subtract if flag is true
                    } else {
                        unitCount += unitValue; // Add if flag is not set (normal case)
                    }
                }
            }
        });

        htmlTable += '</tr>';
    });

    htmlTable += '</table>';
    let output = `<h2>Sale Count: ${saleCount}</h2><h3>${unitCount}</h3><br/>${htmlTable}`;
    return output;
}

// SUBSCRIBER REPORT
router.get('/get-subscriber-report', async (req, res) => {
    try {
        const jwtoken = generateToken();
        const queryParams = {
            'filter[frequency]': 'DAILY', // DAILY WEEKLY MONTHLY YEARLY
            'filter[reportType]': 'SUBSCRIBER', // SALES SUBSCRIBER SUBSCRIPTION SUBSCRIPTION_EVENT 
            'filter[reportSubType]': 'DETAILED',
            'filter[vendorNumber]': process.env.APPLE_VEN,
            'filter[reportDate]':formatDate(daysAgo2),
            'filter[version]':'1_3'
        };

        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/salesReports`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            },
            params: queryParams,
            responseType: 'arraybuffer'
        });

        let output = await decompressData(resp.data);
        let formatted = formatDecompressedData(output);
        let htmlString = '';
        formatted.forEach(element => {
            htmlString += "<br/>" + element + "<br/>";
        });
        res.send(htmlString);
    } catch (error) {
        if (error.response && error.response.data) {
            // Convert buffer to string
            const errorData = error.response.data.toString('utf8');
            console.error("Axios Error:", errorData);
    
            // Parse the string to JSON if it's in JSON format
            try {
                const errorJson = JSON.parse(errorData);
                console.error("Error Details:", errorJson);
            } catch (parseError) {
                console.error("Error parsing JSON:", parseError.message);
            }
        } else {
            console.error("Axios Error:", error.message);
        }
        res.status(500).send('Error occurred');
    }
});

// SUBSCRIPTION REPORT
router.get('/get-subscription-report', async (req, res) => {
    if (req.session.idToken == undefined || req.session.idToken == null) { res.status(401).json({error:"not logged in"}); return; }
    
    console.log(formatDate(daysAgo2));

    try {
        const jwtoken = generateToken();
        const queryParams = {
            'filter[frequency]': 'DAILY', // DAILY WEEKLY MONTHLY YEARLY
            'filter[reportType]': 'SUBSCRIPTION', // SALES SUBSCRIBER SUBSCRIPTION SUBSCRIPTION_EVENT 
            'filter[reportSubType]': 'SUMMARY',
            'filter[vendorNumber]': process.env.APPLE_VEN,
            'filter[reportDate]': formatDate(daysAgo2),
            'filter[version]':'1_3'
        };

        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/salesReports`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            },
            params: queryParams,
            responseType: 'arraybuffer'
        });

        let output = await decompressData(resp.data);

        res.send(output);
    } catch (error) {
        if (error.response && error.response.data) {
            // Convert buffer to string
            const errorData = error.response.data.toString('utf8');
            console.error("Axios Error:", errorData);
    
            // Parse the string to JSON if it's in JSON format
            try {
                const errorJson = JSON.parse(errorData);
                console.error("Error Details:", errorJson);
            } catch (parseError) {
                console.error("Error parsing JSON:", parseError.message);
            }
        } else {
            console.error("Axios Error:", error.message);
        }
        res.status(500).send(`Error occurred ${error.message}`);
    }
});

// SUBSCRIPTION EVENT REPORT
router.get('/get-sub-events-report', async (req, res) => {
    try {
        const jwtoken = generateToken();
        const queryParams = {
            'filter[frequency]': 'DAILY', // DAILY WEEKLY MONTHLY YEARLY
            'filter[reportType]': 'SUBSCRIPTION_EVENT', // SALES SUBSCRIBER SUBSCRIPTION SUBSCRIPTION_EVENT 
            'filter[reportSubType]': 'SUMMARY',
            'filter[vendorNumber]': process.env.APPLE_VEN,
            'filter[reportDate]':formatDate(daysAgo2),
            'filter[version]':'1_3'
        };

        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/salesReports`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            },
            params: queryParams,
            responseType: 'arraybuffer'
        });

        let output = await decompressData(resp.data);
        let formatted = formatDecompressedData(output);
        let htmlString = '';
        formatted.forEach(element => {
            htmlString += "<br/>" + element + "<br/>";
        });
        res.send(htmlString);
    } catch (error) {
        if (error.response && error.response.data) {
            // Convert buffer to string
            const errorData = error.response.data.toString('utf8');
            console.error("Axios Error:", errorData);
    
            // Parse the string to JSON if it's in JSON format
            try {
                const errorJson = JSON.parse(errorData);
                console.error("Error Details:", errorJson);
            } catch (parseError) {
                console.error("Error parsing JSON:", parseError.message);
            }
        } else {
            console.error("Axios Error:", error.message);
        }
        res.status(500).send('Error occurred');
    }
});

async function decompressData(respData){
    const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(respData, (err, buffer) => {
            if (err) {
                reject(err);
            } else {
                //const csvFormatted = buffer.toString().replace(/\t/g, ',');
                //console.log(csvFormatted);
                resolve(buffer.toString());
            }
        });
    }).catch(err => {
        console.error("Decompression Error:", err);
        throw new Error('Error occurred during decompression');
    });
    
    return decompressed;
}

// DOWNLOADS
router.get('/get-apple-downloads', async (req, res) => {
    try {
        const jwtoken = generateToken();
        const queryParams = {
            'filter[frequency]': 'YEARLY', // DAILY WEEKLY MONTHLY YEARLY
            'filter[reportType]': 'SALES', // INSTALLS SALES SUBSCRIPTION SUBSCRIBER
            'filter[reportSubType]': 'SUMMARY',
            'filter[vendorNumber]': process.env.APPLE_VEN,
            'filter[reportDate]': '2023'
        };

        let resp = await axios.get(`https://api.appstoreconnect.apple.com/v1/salesReports`, {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            },
            params: queryParams,
            responseType: 'arraybuffer'
        });

        let output = await processSalesReport(resp.data);
        //res.send(`${resp.data}\nEND`);
        res.send(`${output}\nEND`);
    } catch (error) {
        console.error("Axios Error:", error.response ? error.response.data : error.message);
        res.status(500).send('Error occurred');
    }
});


const yesterday = new Date();
const daysAgo2 = new Date();
const daysAgo7 = new Date();
yesterday.setDate(yesterday.getDate() - 1);
daysAgo2.setDate(yesterday.getDate() - 2);
daysAgo7.setDate(yesterday.getDate() - 7);
const formatDate = (date) => {
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}

module.exports = router;