const axios = require('axios');
require('dotenv').config();

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

function uploadToS3(bucketName, fileName, data) {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: JSON.stringify(data)
  };

  s3.upload(params, function(err, data) {
    if (err) {
      console.error("Error uploading data: ", err);
    } else {
      console.log("Successfully uploaded data to " + bucketName + "/" + fileName);
    }
  });
}


async function fetchExchangeRate() {
  const URL = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_API_KEY}/latest/USD`;

  try {
    const response = await axios.get(URL);
    // Process your response here
    //console.log(response.data);
    uploadToS3(process.env.AWS_BUCKET, 'exchangeRateData.json', response.data);
  } catch (error) {
    console.error('Error fetching exchange rate data:', error);
  }
}

fetchExchangeRate();