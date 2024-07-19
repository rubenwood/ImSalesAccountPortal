const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

async function uploadToS3(buffer, filename, contentType, bucketName) {
  const params = {
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentType: contentType
  };

  return s3.upload(params).promise();
}

function formatSize(size) {
  if (size >= 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (size >= 1024) {
      return (size / 1024).toFixed(2) + ' KB';
  } else {
      return size + ' Bytes';
  }
}

function listS3Files(bucketName, folderNames) {
  if (!bucketName) {
      console.error('Bucket name is required.');
      return;
  }

  if (!folderNames || folderNames.length === 0) {
      console.error('At least one folder name is required.');
      return;
  }

  let promises = folderNames.map(prefix => {
      return new Promise((resolve, reject) => {
          const params = {
              Bucket: bucketName,
              Prefix: prefix
          };

          s3.listObjectsV2(params, (err, data) => {
              if (err) {
                  console.error("Error fetching from", prefix, ":", err);
                  reject(err);
              } else {
                  const filesDetails = data.Contents
                      // Filter out folders
                      .filter(file => !file.Key.endsWith('/'))
                      .map(file => ({
                          FilePath: file.Key,
                          Size: formatSize(file.Size),
                          SizeInBytes: file.Size
                      }));
                  resolve(filesDetails);
              }
          });
      });
  });

  Promise.all(promises).then(results => {
    // Flatten the array of arrays into a single array of file details
      const allFilesDetails = results.flat();
      const filePath = './s3_files_details.csv';
      const csvHeader = 'FilePath,Size,Size In Bytes\n';
      const csvContent = allFilesDetails.map(file => `"${file.FilePath}","${file.Size}",${file.SizeInBytes}`).join('\n');
      fs.writeFileSync(filePath, csvHeader + csvContent, 'utf8');
      console.log(`All file details were written to ${filePath}`);
  }).catch(error => {
      console.error('Failed to fetch files:', error);
  });
}
//listS3Files("com.immersifyeducation.cms", ["ImageData/", "ModelData/"]);

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

module.exports = { uploadToS3, anyFileModifiedSince, checkFileLastModified, checkFilesLastModifiedList  };