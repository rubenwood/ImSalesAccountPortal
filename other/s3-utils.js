const AWS = require('aws-sdk');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

function anyFileModifiedSince(fileTimestamps, date) {
    // must compare 2 Date objects
    return fileTimestamps.some(file => new Date(file.LastModified) > date);
}

async function checkFilesLastModifiedList(bucket, prefix) {
    const params = {
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/', // Ignore subfolders by treating slash as delimiter
    };

    let fileTimestamps = [];

    try {
      const data = await s3.listObjectsV2(params).promise();
      data.Contents.forEach(file => {
        fileTimestamps.push({Key: file.Key, LastModified: file.LastModified});
      });

      return fileTimestamps;
    } catch (err) {
      console.log('Error', err);
    }
}

async function checkFileLastModified(bucket, fileKey) {
    const params = {
      Bucket: bucket,
      Key: fileKey
    };

    let fileTimestamps = [];
  
    try {
      const data = await s3.headObject(params).promise();
      fileTimestamps.push({Key: data.Key, LastModified: data.LastModified});
      return fileTimestamps;
    } catch (err) {
      console.log('Error', err);
    }
}

module.exports = { anyFileModifiedSince, checkFileLastModified, checkFilesLastModifiedList  };