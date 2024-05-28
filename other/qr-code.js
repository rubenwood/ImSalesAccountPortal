const express = require('express');
const multer = require('multer');
const { createCanvas, loadImage } = require('canvas');
const jsQR = require('jsqr');
const AWS = require('aws-sdk');
require('dotenv').config();

const qrCodeRouter = express.Router();

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const upload = multer();

function getSignedUrl(bucketName, key) {
    const params = {
        Bucket: bucketName,
        Key: key,
        Expires: 60 // URL expiry time in seconds
    };
    return s3.getSignedUrl('getObject', params);
}

async function decodeQRCode(input) {
    async function processImage(img) {
        const canvas = createCanvas(img.width, img.height);
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
            return code.data;
        } else {
            throw new Error('Error decoding QR code.');
        }
    }

    if (input.file) {
        const img = await loadImage(`data:image/png;base64,${input.file.toString('base64')}`);
        return await processImage(img);
    } else if (input.url) {
        const url = new URL(input.url);
        const bucketName = url.pathname.split('/')[1];
        const key = url.pathname.split('/').slice(2).join('/');
        //console.log('Bucket Name:', bucketName);
        //console.log('Key:', key);
        const signedUrl = getSignedUrl(bucketName, key);
        //console.log('Signed URL:', signedUrl);

        try {
            const img = await loadImage(signedUrl);
            return await processImage(img);
        } catch (error) {
            console.error(`Error loading image from signed URL: ${error.message}`);
            throw new Error('Error loading image from signed URL.');
        }
    } else {
        throw new Error('Invalid input.');
    }
}

qrCodeRouter.post('/decode-qr', upload.single('file'), async (req, res) => {
    try {
        let result;
        if (req.file) {
            result = await decodeQRCode({ file: req.file.buffer });
        } else if (req.body.url) {
            result = await decodeQRCode({ url: req.body.url });
        } else {
            throw new Error('No valid input provided.');
        }
        res.json({ text: result });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = { qrCodeRouter };