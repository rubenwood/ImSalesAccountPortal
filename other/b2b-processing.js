const express = require('express');
const router = express.Router();

const { generateReportByEmailSuffix } = require('./suffix');

// get a list of all B2B customers we work with (suffixes)
// run the search
// return the total

// call /reporting/gen-suffix-rep?suffixes=suffix1,suffix2,suffix3
// this will get the total users for all of those suffixes
// do this without downloading the S3 files for each search
router.get('/get-total-users', async (req, res) => {
    // this will happen on the KPI side, so will require a valid (google) login
    if (req.session.idToken === undefined || req.session.idToken === null) {
        res.status(401).json({ error: "not logged in" });
        return;
    }

    try {
        // Splits the suffixes into an array (could pull from suffix_list?)
        let suffixes = ["qmul.ac.uk", "cardiff.ac.uk", "jcu.edu.au", "phoenixdentalacademy.co.uk"]
        // Pass array of suffixes
        const matchedUsers = await generateReportByEmailSuffix(suffixes);
        console.log("Total B2B users: " + matchedUsers.length);
        res.send(matchedUsers.length);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

module.exports = router;