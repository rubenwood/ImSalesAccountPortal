import { waitForJWT, imAPIClearCache, imAPIGet, imAPIPut, imAPIPost, jwtoken } from '../immersifyapi/immersify-api.js';
import { Login } from '../PlayFabManager.js';
import { initializeDarkMode } from '../themes/dark-mode.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async() => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');

    // login button on modal
    document.getElementById('loginButton').addEventListener('click', Login);
    //wait until jwt for api is defined
    await waitForJWT();

    const allLessons = await imAPIGet('lessons');
    console.log(allLessons);
    let brondonInfo = await imAPIGet(`brondons/structure/true/statuses/production`)
    console.log(brondonInfo);

    // hide login modal
    document.getElementById('loginModal').style.display = 'none';

    // Clear cache
    document.getElementById('clearDBCacheBtn').addEventListener('click', imAPIClearCache);
    document.getElementById('clearS3CacheBtn').addEventListener('click', async () => {
        const folders = ['Models/', 'Images/', 'Videos/'];
        for(let folder of folders){
            try {
                const response = await fetch('/cms/clear-s3-cache', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body:JSON.stringify({
                        folderName:folder
                    })
                });
        
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
        
                const data = await response.json();
                console.log('Success:', data);
                doConfetti();
            } catch (error) {
                console.error('Error:', error);
            }
        }        
    });

    document.getElementById('searchLessonNameBtn').addEventListener('click', async ()=>{
        const lessonName = document.getElementById('lessonName').value;
        try {
            const response = await fetch('/cms/search-lesson-name', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ lessonName }),
            });
    
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
    
            const data = await response.json();
            console.log('Success:', data);
            doConfetti();
        } catch (error) {
            console.error('Error:', error);
        }
    })

    // Get Lesson Data
    document.getElementById('getLessonDataBtn').addEventListener('click', async ()=>{
        console.log("getting lesson data");
        let lessonId = document.getElementById('lessonId').value;
        // nerves c143b5d9-c065-4c09-b516-ec14c8d8c858
        // muscles 9a64cac6-f34d-454e-a17f-3b314a6817eb
        let lessonData = await imAPIPost(`lessons/${lessonId}/allData`, { languageId:"english-us" });
        console.log(JSON.parse(lessonData));
        doConfetti();
    });

    // Set Pos Rot Per Point (batch)
    document.getElementById('setRotScaleBatchBtn').addEventListener('click', async () => {
        const values = document.getElementById('rotScaleTextArea').value;
        console.log("setting rot & scale per point");
    
        // Split the input into lines
        const lines = values.split('\n');
    
        // Process each line
        const result = lines.map(line => {
            // Trim the line to remove extra spaces
            const trimmedLine = line.trim();
    
            // Ignore empty lines
            if (trimmedLine === '') {
                return null;
            }
    
            const parts = trimmedLine.split('\t');
            if (parts.length >= 1) {
                const entry = {
                    mpd: parts[0],
                    rotation: parts[1] ? parts[1].replace('Vector3', '').replace('(', '').replace(')', '').split(',').map(Number) : null,
                    scale: parts[2] ? parts[2].replace('Vector3', '').replace('(', '').replace(')', '').split(',').map(Number) : null
                };
                return entry;
            } else {
                return null;
            }
        }).filter(item => item !== null);
    
        console.log(result);
    
        // Send the data to the back end
        try {
            const response = await fetch('/cms/set-mpd-data-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: result })
            });
            const responseData = await response.json();
            console.log(responseData);
            if (response.ok) {
                alert('Data updated successfully');
            } else {
                alert(`Error: ${responseData.error}`);
            }
        } catch (error) {
            console.error('Error sending data to the server:', error);
        }
        doConfetti();
    });

    // Get matching asset paths
    document.getElementById('getMatchingAssetPathsBtn').addEventListener('click', async ()=> {
      const fileInput = document.getElementById('jsonFileInput');
      const file = fileInput.files[0];

      if (!file) {
          alert('Please select a JSON file.');
          return;
      }

      try {
          const text = await file.text();
          const jsonData = JSON.parse(text);

          const duplicates = findDuplicateAssetPaths(jsonData.assets);
          const assetModelUsage = findModelPointUsage(jsonData.points);
          displayResult(duplicates, assetModelUsage);
      } catch (error) {
          console.error('Error reading or parsing JSON file:', error);
          alert('Error reading or parsing JSON file. Please check the file format.');
      }
    });

    // Set Rotation Per Point
    document.getElementById('setRotationBtn').addEventListener('click', async ()=> {
        const modelPointId = document.getElementById('mpdId').value;
        const rotationValue = document.getElementById('setRotationInput').value.split(',').map(Number);
        const dataToSet = 'rotation';
        try {
            const response = await fetch('/cms/set-mpd-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ modelPointId, dataToSet, value: rotationValue }),
            });
    
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
    
            const data = await response.json();
            console.log('Success:', data);
            doConfetti();
    
            alert('rotation updated successfully. Rows affected: ' + data.rowsAffected);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating rotation: ' + error.message);
        }
    });

    // Set Scale Per Point
    document.getElementById('setScaleBtn').addEventListener('click', async () => {
        const modelPointId = document.getElementById('mpdId').value;
        const scaleValue = document.getElementById('setScaleInput').value.split(',').map(Number);
        const dataToSet = 'scale';

        try {
            const response = await fetch('/cms/set-mpd-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ modelPointId, dataToSet, value: scaleValue }),
            });
    
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
    
            const data = await response.json();
            console.log('Success:', data);
            doConfetti();
    
            alert('scale updated successfully. Rows affected: ' + data.rowsAffected);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating scale: ' + error.message);
        }
    });
    //
    /* let body = { languageNames:["english-us"],
        fullFilePath:"Models/Submandibular_Gland.glb",
        assetType:"model",
        pointAssetProperties:{rotation:[35,180,0],scale:[1.2,1.2,1.2]}
    }
    imAPIPost(`createAsset/assignToPoint/4facfd14-2fe6-4c0d-a331-f6e163f732b4`, body); */

    // link models to points
    document.getElementById('linkModelsBtn').addEventListener('click', async () => {
        let values = document.getElementById('linkModelsBatchText').value.split('\n');
    
        for (let value of values) {
            if (value.trim() === '') continue; // Skip empty lines
            let parts = value.split(/\s+/);
    
            let pointId = parts[0];
            let assetType = parts[1];
            let fullFilePath = parts[parts.length - 1]; // The file path is always the last part
    
            // Initialize properties for rotation and scale
            let rotation = null;
            let scale = null;
    
            if (parts.length === 5) {
                // When both rotation and scale are present
                rotation = parts[2];
                scale = parts[3];
            } else if (parts.length === 4) {
                // When either rotation or scale is missing
                if (parts[2].startsWith('Vector3')) {
                    rotation = parts[2];
                } else {
                    scale = parts[2];
                }
            }
    
            // Prepare the pointAssetProperties based on assetType
            let pointAssetProperties = {};
            if (rotation && rotation.startsWith('Vector3')) {
                let rotationValues = rotation.slice(8, -1).split(',').map(Number);
                pointAssetProperties.rotation = rotationValues;
            }
            if (scale && scale.startsWith('Vector3')) {
                let scaleValues = scale.slice(8, -1).split(',').map(Number);
                pointAssetProperties.scale = scaleValues;
            }
    
            // Ensure the fullFilePath is not empty
            if (!fullFilePath) {
                console.warn(`Skipping entry for pointId ${pointId} due to missing fullFilePath.`);
                continue;
            }
    
            // Call the API
            let resp = await imAPIPost(`createAsset/assignToPoint/${pointId}`, {
                languageNames: ["english-us"],
                fullFilePath: fullFilePath,
                assetType: assetType,
                pointAssetProperties: pointAssetProperties
            });
    
            console.log(resp); // Log the response for debugging
            doConfetti();
        }
    });

    // Link video
    document.getElementById('linkVideoBtn').addEventListener('click', async () => {
        const videoPath = document.getElementById('videoPath').value;
        let pointId = document.getElementById('pointIdVideo').value;
        console.log(pointId);
        console.log(videoPath);

        let resp = await imAPIPost(`createAsset/assignToPoint/${pointId}`, {
            languageNames:["english-us"],
            fullFilePath:videoPath,
            assetType:"video",
            pointAssetProperties:{}
        });
        console.log(resp);
    });

    // Set all scales
    document.getElementById('setAllScaleBtn').addEventListener('click', async () => {
        console.log("setting scales for lesson");
        const lessonId = document.getElementById('lessonIdInputForScale').value;
        const scale = document.getElementById('scaleInput').value.split(',').map(Number);

        try {
            const response = await fetch('/cms/set-lesson-scale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ lessonId, scale, jwtoken }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }

            const data = await response.json();
            console.log('Success:', data);
            doConfetti();

            alert('Scale updated successfully. Rows affected: ' + data.rowsAffected);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating scale: ' + error.message);
        }
    });    
    // Set Positions 0
    document.getElementById('setPosBtn').addEventListener('click', async ()=>{
        try {
            const response = await fetch('/cms/set-model-point-pos-zero', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }

            const data = await response.json();
            console.log('Success:', data);

            alert('Positions updated successfully. Rows affected: ' + data.rowsAffected);
            } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating positions: ' + error.message);
            }
    });
    // Set Scales 1
    document.getElementById('setScales1Btn').addEventListener('click', async ()=>{
        try {
            const response = await fetch('/cms/set-model-point-scale-one', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }

            const data = await response.json();
            console.log('Success:', data);

            alert('Positions updated successfully. Rows affected: ' + data.rowsAffected);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while updating positions: ' + error.message);
        }
    });

    document.getElementById('approveBtn').addEventListener('click', async ()=>{
        console.log("approving change...");
        let changeId = document.getElementById('groupChangeId').value;
        let resp = await imAPIPut(`draftChanges/changeGroupId/${changeId}/updateStatus/approved` , {comment: ""});
        console.log(resp);
    });

    // Add User to CMS
    document.getElementById('addUserBtn').addEventListener('click', async ()=>{
        console.log("adding user...");
        let userEmail = document.getElementById('userEmailId').value;
        let resp = await imAPIPost(`users` , {password: "secretpassword", email:userEmail});
        console.log(resp);
    });

});
window.onload = function(){
    document.getElementById('loginModal').style.display = 'block';
};



function findDuplicateAssetPaths(assets) {
  const pathCounts = {};
  const duplicates = {};

  assets.forEach(asset => {
      const path = asset.path;
      const id = asset.id;

      if (pathCounts[path]) {
          pathCounts[path].count++;
          pathCounts[path].ids.push(id);
          if (pathCounts[path].count === 2) {
              duplicates[path] = pathCounts[path].ids;
          } else if (pathCounts[path].count > 2) {
              duplicates[path].push(id);
          }
      } else {
          pathCounts[path] = { count: 1, ids: [id] };
      }
  });

  return duplicates;
}

function findModelPointUsage(points) {
  const modelUsage = {};

  points.forEach(point => {
      if (point.modelPointData) {
          point.modelPointData.forEach(model => {
              model.assetDataIds.forEach(assetId => {
                  if (!modelUsage[assetId]) {
                      modelUsage[assetId] = [];
                  }
                  modelUsage[assetId].push(model.id);
              });
          });
      }
  });

  return modelUsage;
}

function displayResult(duplicates, assetModelUsage) {
  const resultDiv = document.getElementById('result');
  if (Object.keys(duplicates).length > 0) {
      resultDiv.innerHTML = 'Duplicate asset paths found: <br>';
      for (const [path, ids] of Object.entries(duplicates)) {
          resultDiv.innerHTML += `<strong>Path:</strong> ${path} <br> <strong>IDs:</strong> ${ids.join(', ')} <br>`;
          ids.forEach(id => {
              if (assetModelUsage[id]) {
                  resultDiv.innerHTML += `<strong>Used in modelPointData:</strong> ${assetModelUsage[id].join(', ')} <br>`;
              }
          });
          resultDiv.innerHTML += `<br>`;
      }
  } else {
      resultDiv.innerHTML = 'No duplicate asset paths found.';
  }
}