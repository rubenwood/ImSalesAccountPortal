const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
//const { v4: uuidv4 } = require('uuid');
//const path = require('path');
//const bodyParser = require('body-parser');
const jsQR = require('jsqr');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

const qrCodeRouter = express.Router();
const { qrCodeDBRouter, addDeepLinkQRCode } = require('../database/qr-code-db');

// const s3Unity = new AWS.S3({
//     accessKeyId: process.env.AWS_OTHER_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_OTHER_SECRET_ACCESS_KEY,
//     region: process.env.AWS_OTHER_REGION
// });
// const s3Cms = new AWS.S3({
//     accessKeyId: process.env.AWS_CMS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_CMS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_CMS_REGION
// });

/*AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});*/
AWS.config.update({
    accessKeyId: process.env.AWS_CMS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_CMS_SECRET_ACCESS_KEY,
    region: process.env.AWS_CMS_REGION
});

const s3 = new AWS.S3();
const uploadQRCode = multer({ storage: multer.memoryStorage() });

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
        console.log(bucketName + " " + key);
        const signedUrl = getSignedUrl(bucketName, key);

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

qrCodeRouter.post('/decode-qr', uploadQRCode.single('file'), async (req, res) => {
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

qrCodeRouter.post('/upload-files', uploadQRCode.array('files'), async (req, res) => {
    try {
        const fileUploadPromises = req.files.map(file => {
            const params = {
                Bucket: process.env.AWS_BUCKET,
                Key: `QRCodes/${file.originalname}`,
                Body: file.buffer,
                ContentType: file.mimetype,
                ACL: 'public-read'
            };

            return s3.upload(params).promise();
        });

        const uploadResults = await Promise.all(fileUploadPromises);

        // Use addDeepLinkQRCode to update the database with the file URLs
        const dbUpdatePromises = uploadResults.map(async (result) => {
            const qrCodeUrl = result.Location;
            const deeplink = await decodeQRCode({ url: qrCodeUrl });
            return await addDeepLinkQRCode(deeplink, qrCodeUrl);
        });

        await Promise.all(dbUpdatePromises);

        res.status(200).json({ message: 'Files uploaded successfully' });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Error uploading files' });
    }
});

module.exports = { qrCodeRouter };