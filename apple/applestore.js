const jwt = require('jsonwebtoken');
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const router = express.Router();

const privateKey = fs.readFileSync(`other/${process.env.APPLE_PK}`);

const generateToken = () => {
    const jwtHeader = {
        "alg": "ES256",
        "kid": process.env.APPLE_KID,
        "typ": "JWT"
    };
    const jwtPayload = {
        "iss": process.env.APPLE_ISS,
        "iat": Math.floor(Date.now() / 1000),
        "exp": Math.floor(Date.now() / 1000) + (20 * 60),
        "aud": "appstoreconnect-v1"
    };

    return jwt.sign(jwtPayload, privateKey, { header: jwtHeader, algorithm: 'ES256' });
};

// TEST
router.get('/appletest', async (req, res) => {
    try {
        const jwtoken = generateToken();
        console.log(jwtoken);
        let resp = await axios.get("https://api.appstoreconnect.apple.com/v1/apps", {
            headers: {
                'Authorization': `Bearer ${jwtoken}`,
            }
        });
        console.log("\n-------\n");
        console.log("SUCCESS");
        console.log(resp.data);
        res.send(`you made it!<br/>${JSON.stringify(resp.data)}`);
    } catch (error) {
        console.error("Axios Error:", error.response ? error.response.data : error.message);
        res.status(500).send('Error occurred');
    }
});


router.get('/get-apple-purchases', (req, res) =>{

});

module.exports = router;