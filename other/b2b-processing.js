const express = require('express');
const router = express.Router();

const { generateReportByEmailSuffixDB } = require('./suffix');
const { getAccessLevel } = require('../playfab/playfab-utils');

const suffixes = [
    ["qmul.ac.uk"], 
    ["cardiff.ac.uk"], 
    ["jcu.edu.au"], 
    ["phoenixdentalacademy.co.uk"], 
    ["uos.ac.uk"], 
    ["highpoint.edu"],
    ["pnwu.edu"]
]


// call /reporting/gen-suffix-rep?suffixes=suffix1,suffix2,suffix3
// this will get the total users for all of those suffixes
// do this without downloading the S3 files for each search
router.get('/get-total-users-kpi', async (req, res) => {
    // this will happen on the KPI side, so will require a valid (google) login
    if (req.session.idToken === undefined || req.session.idToken === null) {
        res.status(401).json({ error: "not logged in" });
        return;
    }

    try {
        let matchedUsersKVP = [];
        for(const suffixArr of suffixes){
            let matchedUsers = await generateReportByEmailSuffixDB(suffixArr);
            matchedUsersKVP.push({suffix: suffixArr, users: matchedUsers});
        }
        res.send(matchedUsersKVP);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

router.get('/get-total-users', async (req, res) => {
    if (getAccessLevel() != process.env.REQUIRED_ACCESS) {
        res.status(401).json({ error: "not logged in" });
        return;
    }

    try {
        let matchedUsersKVP = [];
        for(const suffixArr of suffixes){
            let matchedUsers = await generateReportByEmailSuffixDB(suffixArr);
            matchedUsersKVP.push({suffix: suffixArr, users: matchedUsers});
        }
        res.send(matchedUsersKVP);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

module.exports = router;