const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const s3Router = express.Router();

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();


// Generic call to get JSON files from S3 
s3Router.post('/s3GetJSONFile', async (req, res) => {
  const filepath = req.body.filepath;

  try {
    const data = await getS3JSONFile(filepath);
    res.send(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error fetching data from S3');
  }
});
async function getS3JSONFile(filepath) {
  const params = {
    Bucket: process.env.AWS_BUCKET,
    Key: filepath,
  };

  try {
    const data = await s3.getObject(params).promise();
    const jsonOuput = JSON.parse(data.Body.toString());
    //console.log(jsonOuput);
    return jsonOuput;
  } catch (error) {
    console.error('Error fetching data from S3:', error);
    throw new Error('Error fetching data from S3');
  }
}

async function uploadToS3(buffer, filename, contentType, bucketName, acl = undefined) {
  const params = {
      Bucket: bucketName,
      Key: filename,
      Body: buffer,
      ContentType: contentType
  };

  if(acl != undefined){
    params.ACL = acl;
  }

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

// LIST ALL ITEMS IN FOLDER
function listItems(bucketName, folderName){
  console.log("listing items...");
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Prefix: folderName
    };
    s3.listObjectsV2(params, (err, data) =>{
      if(err){
        console.error('Error listing objects:' , err);
      }else{
        const items = data.Contents.map(item => item.Key);
        resolve(items)
      }
    });
  });
}

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

// GET REPORTS FOLDERS (in Analytics/)
async function getReportFolders(){
  const files = await listItems(process.env.AWS_BUCKET, "Analytics/");
    let folders = files.filter(item => item.endsWith('/'));

    let formattedFolders = [];
    folders.forEach(item => formattedFolders.push(item.replace("Analytics/", "")));
    formattedFolders = formattedFolders.splice(1);
    
    console.log(formattedFolders);
    return formattedFolders;
}

async function generatePresignedUrlsForFolder(folder) {
  const params = {
      Bucket: process.env.AWS_BUCKET,
      Prefix: `Analytics/${folder}/`
  };

  const data = await s3.listObjectsV2(params).promise();
  const urls = data.Contents.map(item => {
      const urlParams = {
          Bucket: process.env.AWS_BUCKET,
          Key: item.Key,
          Expires: 60 * 60 * 24 // 1 day
      };
      const url = s3.getSignedUrl('getObject', urlParams);
      return { filename: item.Key.split('/').pop(), url };
  });

  return urls;
}

module.exports = { 
  s3Router,
  getS3JSONFile, 
  uploadToS3, 
  anyFileModifiedSince, 
  checkFileLastModified, 
  checkFilesLastModifiedList, 
  listItems,
  getReportFolders,
  generatePresignedUrlsForFolder
};