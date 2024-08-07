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
    document.getElementById('clearCacheBtn').addEventListener('click', imAPIClearCache);

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
        let lessonData = await imAPIPost(`lessons/${lessonId}/allData`, { languageId:"english-uk" });
        //console.log(lessonData);
        console.log(JSON.parse(lessonData));
        doConfetti();
    });

    // Set Pos Rot Per Point (batch)
    document.getElementById('setRotScaleBatchBtn').addEventListener('click', async ()=>{
        const values = document.getElementById('rotScaleTextArea').value;
        console.log("setting rot & scale per point");
        
        // Split the input into lines
        const lines = values.split('\n');
        
        // Process each line
        const result = lines.map(line => {
            const parts = line.split('\t');
            if (parts.length === 3) {
                return {
                    mpd: parts[0],
                    rotation: parts[1].replace('Vector3', '').replace('(', '').replace(')', '').split(',').map(Number),
                    scale: parts[2].replace('Vector3', '').replace('(', '').replace(')', '').split(',').map(Number)
                };
            } else {
                return null;
            }
        }).filter(item => item !== null);
    
        console.log(result);
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
        const scaleValue = document.getElementById('setRotationInput').value.split(',').map(Number);
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

    // Approval
    const changeIds = ["00096d90-3710-4f66-b730-7175d5f3b24e",
        "0217e5d0-56e4-4112-b91c-29e91606bbbb",
        "02f6a7e3-beda-48fa-8507-145122a13c12",
        "05367ec0-ad70-4c67-b1ed-3560595da17c",
        "05b48f53-8d06-4554-a9ba-c0c2690a88bc",
        "05f8cabc-6d91-4ca2-9477-1945b22a9676",
        "08868419-c367-44f6-97d8-d3b94407c0d8",
        "09cef98f-777c-47e2-a3fd-e92c4457a476",
        "0a1f1444-4d81-4e3a-b082-94c6b8d63c5c",
        "0c5292bf-70ab-4c1d-8d10-340976d235d5",
        "0cad4b2d-eb8b-45ae-ad51-d08166ae1e0f",
        "0cd914d4-0ab7-4c58-a154-bc8cc177b625",
        "0d11052c-2bce-4f96-88ac-28f8d6b7bdf0",
        "0d95a2c4-c2f9-4849-b825-76a0c1b0d991",
        "0eb910af-7c8a-4842-a0bc-7f9f930cc772",
        "0ee77066-e277-43c5-b870-67c6c3b287a0",
        "0eeb6c8b-d6bb-4586-8c13-fb61c391f0a6",
        "0f38e88d-1d98-4cd8-8f4f-be350d96aae5",
        "1085be8f-d7bc-48f8-bdb4-302cca3f3474",
        "11849389-99f5-4de5-8b49-8bc0ce42e0b1",
        "11c0d5bd-4999-4d16-86b8-9b973db4f0ef",
        "1309c12b-b547-4a1b-83d1-e68d3610cfbf",
        "13243431-5bbb-4c9e-b018-c6442fe0d119",
        "14d79bcd-3aa8-462f-911e-651b516bfef8",
        "14e635e6-8978-4564-a9f7-b46bb6eb5cd1",
        "1524535e-5dd9-428a-a92e-418c793c9428",
        "15cee815-235b-4146-9dcc-23c0b39ba119",
        "15f30c39-c4bf-422e-84de-892dad63fd25",
        "16987ab0-997f-4cc7-b945-9f13df3bc491",
        "16b351c9-c308-42e5-9f83-56b309f54c4f",
        "16b6b6c1-d4b7-4faf-bbd1-c2109e623bfe",
        "17799502-a7b8-42c3-b342-b1cc98584929",
        "17f0b92a-e42a-40ac-b506-4f72c712f55b",
        "18c9b341-82ed-487d-9c18-3fd353876444",
        "18f1c13d-e43d-42a9-bbd3-b089ceae95d5",
        "197c4e95-559a-4e11-a7c1-aaa6ee2b47a9",
        "1b7aeff4-f05d-473a-bdaa-a1815db859a5",
        "1bd9f72b-c549-4584-8a2f-a7edc8816a03",
        "1c65ced1-dff1-418b-a532-d2f25bfdc6ee",
        "1d163843-2fec-4c36-8c53-675c22d9e91f",
        "1e002d41-d0f3-4b91-bf47-dc9f44cdcc53",
        "1e825eae-a955-448f-b144-5d208ac97ce6",
        "1fcf2ad7-39f1-4476-960c-d4da8581da1d",
        "214b002a-8562-4baa-99cb-908e1750ca1a",
        "21588508-acd7-4c98-bc4a-a1217ff94a02",
        "21e2f607-b13b-4737-8309-cbcf33600f5c",
        "22503c97-a2f8-4f34-9cb5-e857b29627dc",
        "226841d0-c01c-4f3a-b9ce-48e0cae3a18a",
        "22c457ce-1a69-4bbf-8e9d-a007721569bc",
        "2353a6bd-105d-4567-941c-973fae2caa67",
        "23877f94-2601-46dc-bb38-deea84508fc6",
        "250afb6e-0ac4-4ac1-977b-c6a44f2ab0a4",
        "260f4e66-244b-4268-af67-efaaa66ca453",
        "262eb48f-9229-4369-867f-ff598bda0389",
        "26c3aeb8-e918-48f2-84ba-77a856932deb",
        "271e1cdf-437e-4d5e-8654-69a2d9e4d49a",
        "28c1c26a-7e59-415c-85aa-df2ea3025301",
        "28f6e0f5-ecd5-46b6-bce9-230c74ccdfe6",
        "2903047c-6464-46ce-afe7-a1b63b048250",
        "2a509f03-e250-4f96-95fc-bb34f8c6fd26",
        "2a5dab5e-3ddb-4ca0-90a3-6757d3393415",
        "2b50fe9c-74a4-47a1-9d76-36a77658fd24",
        "2e4aef93-2f31-40ec-9b5b-e184c44b0e1f",
        "2e9d2d2c-cd03-45d4-8f4d-f74920691554",
        "302d8fc1-9f64-4026-9a1e-fe577d8c7b5e",
        "30306dbe-cffc-407c-a3ce-5e7b54da59a3",
        "3036f4e8-1d7d-4f32-95a9-6b33491daf61",
        "3155fb48-c8c6-4534-9792-13751299f383",
        "315d4e6a-b35e-4b67-a3bd-7dfaf2a4a8ca",
        "316d2265-c2b1-4aca-9f8d-c9925096d414",
        "31ae4886-7f71-42f4-a622-9d636da3970a",
        "32ff0143-5559-4056-af21-89959c5e28ec",
        "33016e1f-4846-4d15-8c85-dfebf0991149",
        "33211e0a-bfde-40dd-9de1-880c5a9b713c",
        "33f5da01-bcdb-4b57-a285-906f6cc5c9d6",
        "345b65df-5378-45d6-adfe-c242c6e7606f",
        "34cf9f43-b57b-413e-bfa6-92e122cc4d88",
        "3535aa09-6fdd-4d0d-9f80-71e21f83183b",
        "35fa2801-3d2b-4554-b0ff-77de2417ba7a",
        "37ab648b-1011-4c4c-9f74-a9aed9f832ff",
        "39a2abbc-8fe4-4fbf-b26d-b61296bf4e03",
        "3c5cdb69-f933-4688-9c87-8c0447081beb",
        "3cb4a5fd-d141-4ebc-83fe-dc1588b46260",
        "3d18699f-c29e-4804-abe7-7dd1bed04358",
        "3d2186b2-c79d-4372-b720-478223ee42ac",
        "3d25616f-b178-4652-aac8-980d46b04dd3",
        "3d560dcb-5b46-4b1a-b1cd-a5a1a5d8b30b",
        "3ea3b7dd-7e1c-429c-83f7-0fbc89f129a9",
        "3f516b10-01f0-497c-bf77-1b000c2d4775",
        "402edca6-903c-4b49-a226-d9f95a797988",
        "40f1a3ff-7532-4bb8-853b-2002f29be4d0",
        "41d36683-fb67-4382-ac92-fc03eaa250ee",
        "420603b3-6e02-43cd-a7a3-dd25bd891a5a",
        "4327ca74-a1fc-42ba-ad9d-de5dbde97ddc",
        "436fda40-aa86-49ca-8f2f-4753784a6582",
        "43e17447-e80d-47be-8ec7-c078f7be2285",
        "4410ff6f-8077-4eae-8354-397e7e6e6749",
        "4458c49f-9c41-4f35-a188-ff92b31a48bf",
        "446196aa-d97e-4059-ad6f-631081d92e07",
        "44b75f2e-1859-4f8f-b2e0-3cec85d217ee",
        "4786ec72-b675-4ed4-99f2-bd1ef1540a45",
        "49a84adf-047f-40af-908a-2391eadc978b",
        "49f6fa96-d617-4e89-b678-1c1a2f35fbc9",
        "4a56fcef-0d80-47c4-b3f9-299eaa0bead0",
        "4a793f5d-897b-482c-bf21-ed7dfb01ee17",
        "4a7dcafa-7bf1-40b0-bf1f-b2568a409cb2",
        "4c2fffc6-e289-48ff-a803-0d8c841b1c8e",
        "4cba3b18-bf98-435b-99d7-1b8839d10fce",
        "4eccaf33-8016-4445-8de9-9a637a226a74",
        "4fad912d-5203-4dc0-9f3a-3f5e01fbbc8d",
        "4ff35c44-df07-4e6b-93cc-0f304e1fc6d4",
        "4ff9e3f8-efa3-4d4f-a59a-667cb55eb409",
        "518717d4-d949-47fa-86b4-92b30f29a3c3",
        "51cf6d84-c5c8-4125-866f-f6c9f21489be",
        "532bda77-5d0a-4e5b-a6b4-a37d68b367ed",
        "53d7a49c-06dc-4e44-b6e6-9f8f0650f14a",
        "5415b83a-1fd9-4b7d-ab93-c0265ca3b606",
        "543454af-273b-4cc3-a7de-6cc4121b27c0",
        "54f6d467-0e3b-4a51-8261-7ac7688947ea",
        "54f80867-7e46-49fa-a332-d208fd5adc3a",
        "56a78058-b141-4451-b41f-58d5f20417be",
        "59ac993c-73d1-4742-a8c2-4485fa64d29a",
        "5a2efcee-363b-4530-8e4d-e51d914913cb",
        "5a47d782-4493-4684-8a19-05c5c9034841",
        "5cf1fde9-d375-40ed-ae53-22e42530e217",
        "5d45eec9-8197-4181-87a1-af60db558340",
        "5f584637-0dca-4643-b4f2-edbe691844f8",
        "6067144a-0a95-488d-b092-c7de2a5ea78f",
        "612a3719-3273-4570-bca5-0582a5e52551",
        "613a8a11-1b49-45d1-b121-697b8a03010a",
        "61ad1b8b-8563-482e-94c9-b8ad38ac2fe1",
        "62544ca0-4ff5-429c-b339-08d78a35a9c2",
        "6381ba9e-cb2d-492d-b8a0-738da0c99ca6",
        "63bb0b61-a70e-48f5-8fab-e8df9c68a4b9",
        "63e07ee7-f4e8-41cd-a40f-164b20de92ee",
        "659e5b7e-fb97-4f6c-8e0b-e4446c1e0778",
        "66c721e1-87eb-4627-8283-3cafdaa11983",
        "67830e58-5421-43e2-8565-41d5a361b03c",
        "6934d171-c8b8-41cb-8c71-0f60322d6bac",
        "6af10b87-a034-4274-a79b-bf0e48716a58",
        "6afc8bd5-8716-4982-bf1c-aed6704409a7",
        "6b407320-9807-41cd-9a80-fc1b4f3c0962",
        "6bc9eaa3-bff6-4e9f-be04-5ceb9a8e5b6d",
        "6cd2aad7-7224-45a3-b7cf-793dc682572c",
        "6d11f7cb-63da-44d2-8729-308af5d93eab",
        "6d814f48-fc7b-4dd9-82b5-1bd842eb9069",
        "6d99902a-1e72-410a-b47c-7487cabc4b03",
        "6fd7a220-f75c-4175-820e-3bcccc1452d1",
        "70051f1b-98d6-4c86-b085-079f7b9003d8",
        "7009f249-e249-4e12-a554-126c3d0b128f",
        "7126a9f6-88b1-433a-99c2-72a31e1cf883",
        "7131a1f0-0197-4afa-b41d-71d3078c64df",
        "71901659-5cdf-45f1-aa4e-53dd3b21e603",
        "722fe54c-44ad-4e84-a795-47e97383b962",
        "726e50e0-635e-42f8-ba70-420588352a82",
        "72f063f0-f999-45dd-939e-dc83ce362f52",
        "7460755e-2bd1-457e-97cb-526ae9191af8",
        "751894bd-feb8-4d02-b99c-36e1bc55faad",
        "770f6e96-e0c7-4411-a785-630319f96771",
        "77588a82-93fd-4491-9258-55e6eef9aee3",
        "78276b9c-aea4-4dc1-b7da-f0daaa876485",
        "7ae4db97-1ca6-4263-9592-4a2d2daa655c",
        "7af494eb-54bf-4f96-9915-450eb38cf2b3",
        "7b59b113-7b41-4c49-b061-1cbefed01ce9",
        "7fae9ee0-c8a9-49cf-a2ab-59804f0b8766",
        "7fc8f265-fbda-453b-8d08-002c5178ca74",
        "82d7976d-bc47-418b-8a11-c75fe370c929",
        "830f544e-9f44-48ca-8756-2cc6c83531b1",
        "83181e8e-6701-4491-abe3-4a6705036b84",
        "83a79b9e-65bb-498e-b60c-017c6b462a30",
        "84fa5106-e712-4954-a788-1b267a821e28",
        "85ddb282-8c0f-4382-8978-9f28f0172025",
        "86a168e9-6b1a-4054-b922-a1eacc1a6020",
        "86fb4cd5-6767-4706-b764-a66e1fa1d7ef",
        "88ae8857-8ecf-4812-af46-145c020656dd",
        "8999708c-d2f8-4fbd-b883-40c5501b7164",
        "8a98afaa-9b6f-4cf8-add5-a1d7d47da4c4",
        "8ae4643a-e00a-4793-9208-6ca4fc379aaa",
        "8ae7c7f1-794e-4cd4-8f33-f8f11613c328",
        "8af0e823-5106-48f7-89f3-6306330cfbc3",
        "8b0e60a4-e49f-4131-aa38-63653e2bd8c1",
        "8ca25e96-630f-43c2-97e7-48dd41ab41e5",
        "8d188dbe-e644-4ebb-a592-7039a01d8338",
        "8d221b5e-a054-4d7b-b84d-bc0b5638d22e",
        "8d305337-0b97-49d6-9a28-4b26a80825be",
        "8db17ca6-46fc-4ebb-8e2d-8a4c31d0b597",
        "8e0493b1-2dcd-45c3-8993-6564e5e38719",
        "912a5239-7df1-4d32-aa03-2290401b7309",
        "923538c6-6e47-452e-b9c0-48e1709d54a2",
        "93229880-91e6-4ec3-888c-03e9e9df7f88",
        "955b58aa-9c71-4d7a-9bbb-8b761fe2bbb4",
        "95ebadb0-effd-4836-8464-d0c91359b500",
        "96b7dbba-54e7-4edb-a5d8-8e8363659fe9",
        "972c712b-2b9b-4f81-a039-01068f6545be",
        "97375e51-73b5-4b7a-8e95-6590a70a6668",
        "9926e25e-15cc-4f01-9f01-83d7dc4b26c0",
        "9a058a7c-3bc1-4d3a-b8fc-6b376d5478c2",
        "9af391d1-769a-4dfe-8be3-c6b56a5ace06",
        "9bfac33f-b631-498e-8885-d6f0e148b9f7",
        "9ec8d667-8deb-483a-9b49-89f3470df1bd",
        "9f33d40f-6122-4994-9669-28435369f47a",
        "9f9455ce-5549-4a5f-a048-e1556f7f7d85",
        "9fdd4ae4-cfec-4399-94f6-c46fd97bcc1d",
        "a0c1d8fb-0c15-4a61-b4f8-d8a98e913255",
        "a0e474f0-11de-4418-a656-7a0572f4ef06",
        "a1247647-d7d6-4dc6-9bf1-f0dd5f30c4d7",
        "a18f69da-b5e6-4069-8934-62ee8cecd594",
        "a1de6870-49c3-489e-919c-5901b3559ae5",
        "a2ec15a6-0455-4fdf-b609-69657d8c5fa7",
        "a30f8cf8-1f6d-4be2-a57e-ac34482a888b",
        "a31e2708-b144-4caf-9240-9509ae9f88e7",
        "a348087e-b4ed-410e-82b7-2c701ddd13fd",
        "a3e035ad-dcd6-4395-9dd1-fafa4abed4d7",
        "a3f15139-5849-429b-b5aa-b934555532fd",
        "a421e028-7412-4afb-a53e-5f8a76c24735",
        "a513754f-3085-4cf6-9f56-f8bb691a718b",
        "a51d42a4-4514-448b-a846-813355088dfc",
        "a5488d2f-b137-4830-a96b-a2f233700225",
        "a5c70262-398a-4c8c-a030-8606b6678fc5",
        "a5ef4f9d-257e-4922-9fa1-7a4040359d31",
        "a89ffa42-0ab3-48da-acf8-c93bd4abf8de",
        "a90e98c6-aa82-4889-9338-7468d555399b",
        "a9846729-9177-4e29-b0b0-569c83083915",
        "a98bbeeb-4d7b-4e3a-9f3d-94fa2fd029f7",
        "aaf8dd7b-f78d-4262-8e04-2e6c55e033f8",
        "ab6c9b00-8061-4172-a90e-a16138ccba52",
        "ac4ac977-1495-41d2-9f17-79dd89bac460",
        "ac78607d-0909-4cf6-9659-f53581edb948",
        "ad219133-9b75-4b91-993a-dc008e8979a4",
        "ad24d3be-38ad-4507-a47c-c82072f1b87e",
        "ae1c892a-3312-487e-8bf9-b25758980423",
        "ae432115-4326-474e-ae50-3637fb52eae7",
        "af1809ed-6ba2-4ab8-9ecf-eb470e308cf5",
        "b041581a-ca57-4075-bbd2-9a7dd1a3611d",
        "b0c9cec1-ff3c-4790-b6d7-6e0af556a078",
        "b18183f3-99e0-4957-9ebe-7253a98143bf",
        "b18d20d5-2de1-45c6-9699-725a2581a6b9",
        "b24c099e-8546-4e02-99e5-7f4b505e20ad",
        "b2b4f543-5814-4e06-b1fc-de343483bb5a",
        "b35b844e-1a32-4d44-8943-e9ff1a688352",
        "b7ca0ee1-2588-453d-ab95-5e5b8830555b",
        "b830f288-7e28-4d9b-b964-24441697b5e4",
        "b845f931-4514-491f-8224-fe4c876fe167",
        "b9bfe7ed-2a9e-4b70-b055-d3aafc4b6432",
        "bc19570f-66d6-49ec-9682-824c1157a546",
        "bd564535-ec04-464b-a1f7-3ab17d3df588",
        "bd89cc57-fa9f-43e3-b6b7-3ac363bc2604",
        "be5e9f98-51e5-4e41-a1a3-9e5b84912431",
        "c175c92f-f0d1-400e-abbf-7f41ef738a1a",
        "c1a08b93-124e-4110-889c-8b8bbfba4faf",
        "c1aa540f-ddc2-4bc4-997f-505c7bb61de5",
        "c1d14f03-72e0-4c7d-ae55-be78938e0e65",
        "c1e4463e-a1d6-49ef-9164-a21885a99ad4",
        "c20e5302-4ce8-47e5-bf29-0fd1d40dd32f",
        "c3c04556-165b-442c-b235-76389bf462ce",
        "c4409c76-711d-4dcc-84b8-2941b52bac8a",
        "c4e381d0-1353-44ac-813f-b43f01666f22",
        "c501e654-bfad-4f8f-a423-32173a2d9373",
        "c50be39b-0117-446e-b749-de3fae7354ab",
        "c51c9a0f-1f93-4db6-8b6c-db80bf2589cd",
        "c5ca4ff3-9714-46c9-8b9e-834eacc88328",
        "c733c0c9-905f-4ced-900e-8f227b658d8f",
        "c7cff22a-d0ef-49fc-a176-948a8549f51b",
        "c7dfbdd7-084f-4507-8ba5-7c65431c2d54",
        "c85ff4e2-2fb4-4cbe-b645-757c4d7ac48e",
        "c94ee667-bd46-46da-a0b7-7933caebf035",
        "c97f2de3-7a05-46e7-9f4e-b9147db9ee4a",
        "c9a02202-4b84-42d7-b2e1-0a3404e0de7e",
        "ca20686c-b0d0-465d-9398-677af123eeff",
        "ca35ab6e-1411-456b-adbc-f32b9cd81ada",
        "cb157d2f-d2f8-4c73-9180-1c8e30bbac94",
        "cb6fd686-5a0a-4c53-a65c-83bb47efc960",
        "cd79bb38-a70d-4a1c-9413-61eafd5e3788",
        "ce748d78-d5ab-4f27-8d5c-7af48e4374e0",
        "cf39e7d3-70be-4e01-8b0c-05e8ef9c9c68",
        "cfc3c45a-7756-4b7d-9229-5dbdf863e5eb",
        "cfc6db25-9120-48ac-948f-a814b5cb5d43",
        "d008dbb5-c803-48ae-94b6-71e2a207ddf9",
        "d3289dfd-bcf2-431e-babe-3ffda1a084d7",
        "d3b43903-ea4d-42b4-ae29-9bf58f244e50",
        "d4834fc5-34c0-4913-85c3-8692c30845a0",
        "d4a82492-7763-4820-a645-05292a66217b",
        "d4da523d-48bd-473a-8835-c551202e8fa5",
        "d6ece4ae-0846-4aaa-a982-f45c5ec9844f",
        "d7742dd8-a385-4caf-b6b8-d72b5aa0af96",
        "d7e66b32-79f2-4d3d-9c31-16a910f63e58",
        "d81382a1-f26f-40b1-9a57-b9f7f5ac34a5",
        "d8e7b176-b947-4f6f-a85b-178c900e1b2f",
        "d9001aaf-a970-4c88-9442-5f91b2fc9f7e",
        "da1206e2-3885-48ad-9365-3c2c59cc90bb",
        "da779bf5-18d1-4c07-9433-30ecb333552c",
        "db510d00-1a3b-47ba-b902-f78e85f2d3e6",
        "dbe7cad7-be5a-48ba-a978-65d325674e99",
        "dca29a48-574f-4b43-ae10-a9c9c0aa3a71",
        "dd6e8455-4298-42e3-8131-ccc0fb741b2f",
        "dddea01d-fce2-4517-949e-3d6a1be4a2e0",
        "de0fa274-3c6a-4ae4-b08e-2f1c34f748e2",
        "df1fbe82-5b6f-4883-b12d-9a149236a641",
        "dfc840e0-833f-4e95-b37e-e5dfc4ab7516",
        "e0023349-37f9-4bb1-9d73-5064e1b533eb",
        "e02045b6-7c11-4a42-ad64-e1ac29beffce",
        "e0ecf210-c890-4751-bf22-59bce339e7c4",
        "e242350d-fc1a-4da3-a1ab-d64d35fa3f75",
        "e258cb68-38d6-4ba0-9ce3-19380eac0a08",
        "e47f8c8e-ee75-46b2-8e1c-16795f890ca2",
        "e4f36a3a-825b-4ea5-bdfc-b590d3d72e82",
        "e5d25aea-39f4-4c14-8104-78d04075874a",
        "e7078f69-6e31-4a26-a940-dbf395003359",
        "e7f8c84a-c0c4-43be-83ec-535346509252",
        "e7f95829-301f-4d92-8d12-1f6a613989db",
        "e7fae262-e8b9-4173-8c29-4fe22aff6655",
        "e87168a3-51e0-4486-8cfb-7b70df687145",
        "e8c4be0a-975c-4035-9ec3-ba418c4d4716",
        "e92be709-6e75-48af-8e0c-d0d27565ca0a",
        "e9a9e065-22a2-46ed-aa1a-c05e887557f7",
        "ecd08ab2-cd32-4ea8-9486-60e76ce7e102",
        "ed7e376b-78ca-42d4-8b24-c37d162e82ba",
        "ee25abef-7564-451e-b88c-0995442f0453",
        "ee29e295-fa70-45ad-a4ea-9f95ce7f1389",
        "ee48752f-67a4-45d4-947b-cf2e706c913a",
        "ee5b45a1-f6c3-468b-9e29-f40531f83af3",
        "effac339-a954-4496-987c-0c92f5c0d383",
        "f1154597-ab2f-4b7e-bdda-1fe7935768fb",
        "f321e76c-a93f-4ebc-9f90-dada25c92fac",
        "f5080d7d-62b1-47ed-a7ac-26e4fe731391",
        "f5bf69f9-55e8-4d31-aed5-eb1587b46b5d",
        "f632409c-c951-4a6c-bd88-a2e35914d968",
        "f661e508-2cc4-48db-8d7f-efa0e095a96e",
        "f80b7c77-3b2a-4cae-8954-864fa1541c48",
        "f81ff8d2-62f8-4d64-92c0-783b6f1e558e",
        "f83cef26-4e13-408d-8757-73174b9e2e92",
        "f8eae014-5711-4350-b84a-6849fe3a6045",
        "f937e87a-0d34-4da2-9c37-350d819d3925",
        "f9620460-62b2-4982-9fd2-64ed3c1c4453",
        "f989c9f6-93f3-4c14-a314-88e03aab564e",
        "faf96ec7-f0d5-4498-bbb5-9d92e57acc89",
        "fb5117a1-8d2f-41cb-82c0-ab4fc3ea97c8",
        "fb55dfa0-950c-40f9-a509-cfb8be1cdce4",
        "fdf663df-b8de-45b5-a84a-dc6557e96f00",
        "fe6f85db-44cf-4f19-b020-f6aaf4f6974d",
        "ff1ed42c-f94d-4d92-92b6-9def06341f36"]
    document.getElementById('bulkApproveBtn').addEventListener('click', async ()=>{
        let approvedCount = 0;
        for(const id of changeIds){
            console.log(`approving: ${id}`);
            let resp = await imAPIPut(`draftChanges/changeGroupId/${id}/updateStatus/approved` , {comment: ""});
            console.log(resp);
            approvedCount++;
            console.log(`approved count: ${approvedCount}`);
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