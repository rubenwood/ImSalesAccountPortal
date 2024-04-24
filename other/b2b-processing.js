const express = require('express');
const router = express.Router();

const { generateReportByEmailSuffixDB } = require('./suffix');

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
        let suffixes = ["qmul.ac.uk", "cardiff.ac.uk", "jcu.edu.au", "phoenixdentalacademy.co.uk", "uos.ac.uk", "highpoint.edu"]
        // Pass array of suffixes
        const matchedUsers = await generateReportByEmailSuffixDB(suffixes);
        console.log("Total B2B users: " + matchedUsers.length);

        // Alternative method to break down matchedUsers into groups per suffix
        // this is a bit silly but should work
        //let suffixes = [["qmul.ac.uk"], ["cardiff.ac.uk"], ["jcu.edu.au"], ["phoenixdentalacademy.co.uk"], ["uos.ac.uk"], ["highpoint.edu"]]
        // let matchedUsersKVP = [];
        // for(const suffixArr of suffixes){
        //     let matchedUsers = await generateReportByEmailSuffixDB(suffixArr);
        //     matchedUsersKVP.push({suffix: suffixArr, users: matchedUsers});
        // }        

        res.send(matchedUsers.length.toString());
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Failed to generate report', error: error.message });
    }
});

module.exports = router;