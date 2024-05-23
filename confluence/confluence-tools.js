const express = require('express');
const axios = require('axios');
const confRouter = express.Router();

// UPDATE CONFLUENCE PAGE
confRouter.put('/update-confluence-page/:pageId', async (req, res) => {
    let email = req.body.email;
    let pass = req.body.pass;
    let area = req.body.area;
    let expiry = req.body.expiry;
    let createdBy = req.body.createdBy;
    let reason = req.body.reason;

    const pageId = req.params.pageId;
    const pageContent = await getPageDetails(pageId);
    let newPageContent = pageContent;

    // Parse the existing content to add a new row to the table
    if (newPageContent.includes("</tbody>")) {
        const newRow = `<tr><td>${email}</td><td>${pass}</td><td>${area}</td><td>${expiry}</td><td>${createdBy}</td><td>${reason}</td></tr>`;
        newPageContent = pageContent.replace("</tbody>", `${newRow}</tbody>`);
    } else {
        console.log("No table found in Confluence page");
        // If no table exists, create one
        newPageContent = `<table><tbody><tr><td><b>Email</b></td><td><b>Password</b></td><td><b>Area</b></td><td><b>Expiry</b></td><td><b>Created / Updated By</b></td><td><b>Reason</b></td></tr></tbody></table>`;
    }

    try {
        const currentVersion = await getCurrentPageVersion(pageId)
        const bodyData = {
        "version": {
            "number": currentVersion+1, 
            "message": "update"
        },
        "title": "Test Accounts (Automated)",
        "type": "page",
        "status": "current",
        "body": {
            "storage": {
            "value": newPageContent,
            "representation": "storage"
            }
        }
        };      

        const response = await axios.put(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}`, 
        JSON.stringify(bodyData), {
        headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`)
            .toString('base64')}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: bodyData
        });

        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating Confluence page');
    }
});
// CONFLUENCE METHODS
async function getCurrentPageVersion(pageId) {
    try {
        const response = await axios.get(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}?expand=version`, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64')}`,
                'Accept': 'application/json'
            }
        });
        return response.data.version.number;
    } catch (error) {
        console.error("Error fetching page version:", error);
        throw error;
    }
}
async function getPageDetails(pageId) {
    try {
        const response = await axios.get(`https://immersify.atlassian.net/wiki/rest/api/content/${pageId}?expand=body.storage`, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_API_TOKEN}`).toString('base64')}`,
                'Accept': 'application/json'
            }
        });
        return response.data.body.storage.value // This is the current page content in storage format
        
    } catch (error) {
        console.error("Error fetching page details:", error);
        throw error;
    }
}

module.exports = { confRouter } ;