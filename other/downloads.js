const express = require('express');
const dlRouter = express.Router();

// AUTH USER FOR REPORT
dlRouter.post('/auth', async (req, res) => {
    try {
        if(req.body.pass == process.env.DOWNLOADS_PASS)
        {
            res.send(true);
        }
        else
        {
            res.send(false);
        }        
    } catch (err) {
        res.status(500).send(`Error ${err.message}`);
    }
});

module.exports = { dlRouter };