// QR Code & Deeplink generator code
import { getAreas, getTopics, getTopicBrondons, getActivities, getActivityBrondons, waitForJWT } from '../immersifyapi/immersify-api.js';
import { decodeQRCode, generateQRCodesAndUpload, genQRCode, genTopicCollectionLink } from './qr-code-utils.js';
import { Login } from '../PlayFabManager.js';
import { SearchableList } from '../classes/searchable-list.js';
import { initializeDarkMode } from '../themes/dark-mode.js';

let allURLs = [];
let allQRCodeURLs;
// TODO: cache these in local storage
let areas, topics, activities;
let allTopicBrondons, allActivityBrondons;

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async() => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');

    // login button on modal
    document.getElementById('loginButton').addEventListener('click', Login);
    //wait until jwt for api is defined
    await waitForJWT();
    // hide login modal
    document.getElementById('loginModal').style.display = 'none';

    [areas, topics, activities] = await Promise.all([ getAreas(), getTopics(), getActivities()]);
    console.log("got all areas:\n", areas, "\ntopics:\n" , topics, "\nactivities:\n", activities);

    if (allTopicBrondons == undefined || allActivityBrondons == undefined) {
        [allTopicBrondons, allActivityBrondons] = await Promise.all([getTopicBrondons(topics), getActivityBrondons(activities)]);
    }

    // Ensure that `allTopicBrondons` and `allActivityBrondons` are arrays or objects if expected
    console.log("got topic brondons:\n", allTopicBrondons, "\ngot activity brondons\n", allActivityBrondons);
    doConfetti();

    // generate deeplinks button
    let genDLBtn = document.getElementById('generate-deeplinks');
    genDLBtn.addEventListener('click', async() => { 
        genDLBtn.value = "Generating Deeplinks...";
        await generateDeeplinks();
        doConfetti();
        genDLBtn.value = "Generate Deeplinks";
    });
    // generate (and upload) QR codes
    let genQRBtn = document.getElementById('generate-qr-codes');
    genQRBtn.addEventListener('click', async() => { 
        genQRBtn.value = "Generating QR Codes...";
        allQRCodeURLs = await generateQRCodesAndUpload(allURLs);
        doConfetti();
        genQRBtn.value = "Generate QR Codes";
    });
    // Update database with new links and generated qr codes (must generate qr codes first)
    let updateDBBtn = document.getElementById('update-db');
    updateDBBtn.addEventListener('click', async() => { 
        updateDBBtn.value = "Updating Database...";
        await bulkAddToDatabase(allURLs, allQRCodeURLs);
        doConfetti();
        updateDBBtn.value = "Update Database (NYI)";
    });


    // Manually add a Deeplink / QR Code to the database
    document.getElementById('add-qr-dl-to-db').addEventListener('click', async ()=>{
        let deeplink = document.getElementById('manual-dl-input').value.trim();      

        if(deeplink.includes("AddTopic"))
        {
            // get topic id and name from url
            let topicIdFromLink = extractIdFromUrl(deeplink);            
            let topicBrondon = allTopicBrondons.find(item => item.topicId === topicIdFromLink).brondon;            
            let topicName = topicBrondon.externalTitle;            
            let imageName = "Topic_"+topicName.replace(/[^a-zA-Z0-9]/g, "");

            console.log("Topic ID Link:\n" + topicIdFromLink);
            console.log(topicBrondon);
            console.log("Topic name:\n" + topicName);
            console.log("Image name:\n" + imageName);

            let newLink = {
                type:"topic",
                imgName:imageName,
                link:deeplink
            }
            let qrCodeUrls = await generateQRCodesAndUpload([newLink]);
            console.log(qrCodeUrls);
            let resp = await addToDatabase(deeplink, qrCodeUrls[0].qrCodeS3Url, null, null, topicIdFromLink, topicName, null, null, "topic");
            doConfetti();
        } 
        else if(deeplink.includes("LaunchActivity"))
        {
            // get topic id and name from url
            let activityIdFromLink = extractIdFromUrl(deeplink);            
            let activityBrondon = allActivityBrondons.find(item => item.activityId === activityIdFromLink).brondon;            
            let activityName = activityBrondon.externalTitle;            
            let imageName = "Activity_"+activityName.replace(/[^a-zA-Z0-9]/g, "");

            console.log("ACtivity ID Link:\n" + activityIdFromLink);
            console.log(activityBrondon);
            console.log("ACtivity name:\n" + activityName);
            console.log("Image name:\n" + imageName);

            let newLink = {
                type:"activity",
                imgName:imageName,
                link:deeplink
            }
            let qrCodeUrls = await generateQRCodesAndUpload([newLink]);
            console.log(qrCodeUrls);
            let resp = await addToDatabase(deeplink, qrCodeUrls[0].qrCodeS3Url, null, null, null, null, activityIdFromLink, activityName, "activity");
            console.log(resp);
            if(resp.error!=undefined){ alert(resp.error); }
            doConfetti();
        }
    });


    // Manually generate QR code from URL
    document.getElementById('manual-gen-qr-code-btn').addEventListener('click', async() => { 
        let generateQRCodeURL = await genQRCode(document.getElementById('deeplink-qr-code-input').value);
        console.log(`code url: ${generateQRCodeURL}`);
        document.getElementById('generated-qr-img').src = generateQRCodeURL;
        doConfetti();
    });
    // Decodes QR code
    document.getElementById('file-input').addEventListener('change', async(event) => {
        const file = event.target.files[0];
        if (file) {
            let decodedUrl = await decodeQRCode(file);
            document.getElementById('decoded-result').innerHTML = decodedUrl;
        }
    });

    // TODO: refactor duplicate code (qr-code-front)
    // Searchable list (for adding multiple topics)
    const listContainer = document.getElementById('listContainer');
    const searchInput = document.getElementById('searchInput');
    const selectedItemsContainer = document.getElementById('selectedItemsContainer');
    let topicsSelected = [];
    const onListUpdated = (selectedItems) => {
        topicsSelected = selectedItems;
        //console.log('selected topics: ', topicsSelected);
    };
    new SearchableList(allTopicBrondons, listContainer, searchInput, selectedItemsContainer, 'brondon.externalTitle', onListUpdated);
    // topic collection to deeplink
    document.getElementById('gen-selected-topics-dl').addEventListener('click', async()=>{ 
        let topicCollectionLink = genTopicCollectionLink(topicsSelected);
        document.getElementById('selected-topics-dl-output').innerText = topicCollectionLink; 
        let topicCollectionQRCodeURL = await genQRCode(topicCollectionLink);
        document.getElementById('qr-code-topics').src = topicCollectionQRCodeURL;
        doConfetti();
     });    
});
window.onload = function(){
    document.getElementById('loginModal').style.display = 'block';
};

async function generateDeeplinks(){
    console.log("Setting up the page...");
    allURLs = [];
    try {
        const addTopicLinks = genAddTopicLinks(allTopicBrondons);
        const launchActivityLinks = genLaunchActivityLinks(activities, allActivityBrondons);
        const [launcherSectionLinks, setAreaLinks] = await Promise.all([
            genLauncherSectionLinks(["Explore","Library","Progress","Feed","Shop"]),
            genSetAreaLinks(areas)
        ]);

        const launcherSectionLinksElement = document.getElementById('launcherSectionLinks');
        const areaLinksElement = document.getElementById('setAreaLinks');
        const addTopicLinksElement = document.getElementById('addTopicLinks');
        const launchActivityLinksElement = document.getElementById('launchActivityLinks');

        let launcherSectionURLs = [];
        launcherSectionLinks.forEach(element => { launcherSectionURLs.push(element.link); });
        const launcherSectionLinksStr = launcherSectionURLs.join('\n');
        launcherSectionLinksElement.value = launcherSectionLinksStr;

        let setAreaURLs = [];
        setAreaLinks.forEach(element => { setAreaURLs.push(element.link); });
        const setAreaLinksStr = setAreaURLs.join('\n');
        areaLinksElement.value = setAreaLinksStr;

        let addTopicURLs = [];
        addTopicLinks.forEach(element => { addTopicURLs.push(element.link); });
        const addTopicLinksStr = addTopicURLs.join('\n');
        addTopicLinksElement.value = addTopicLinksStr;

        let launchActivityURLs = [];
        //console.log(launchActivityLinks);
        launchActivityLinks.forEach(element => { launchActivityURLs.push(element.link); });
        const launchActivityLinksStr = launchActivityURLs.join('\n');
        launchActivityLinksElement.value = launchActivityLinksStr;

        const ssoLinksElement = document.getElementById('ssoLinks');
        const ssoLinks = await genSSOLinks();
        let ssoURLs = [];
        ssoLinks.forEach(element => { ssoURLs.push(element.link); });
        const ssoLinksStr = ssoURLs.join('\n');
        ssoLinksElement.value = ssoLinksStr;

        // clear cache deeplink
        //https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FClearCache%5D

        // add to all URLs, so that we can generate the QR codes
        allURLs.push(...launcherSectionLinks);
        allURLs.push(...setAreaLinks);
        allURLs.push(...addTopicLinks);
        allURLs.push(...launchActivityLinks);
        allURLs.push(...ssoLinks);

        // Check for duplicates in allURLs by imgName and modify them to be unique
        let imgNameCount = {};
        allURLs.forEach(element => {
            if (imgNameCount[element.imgName]) {
                imgNameCount[element.imgName]++;
                element.imgName = `${element.imgName}_${imgNameCount[element.imgName]}`;
            } else {
                imgNameCount[element.imgName] = 1;
            }
        });

        // Verify no duplicates exist after modification
        let duplicates = allURLs.reduce((acc, current) => {
            acc[current.imgName] = (acc[current.imgName] || 0) + 1;
            return acc;
        }, {});
        let duplicateElements = allURLs.filter(element => duplicates[element.imgName] > 1);
        if (duplicateElements.length > 0) {
            console.log("Duplicates found after modification:");
            console.log(duplicateElements);
        } else {
            console.log("No duplicates found after modification.");
        }
    } catch (error) {
        console.error("Error setting up page:", error);
    }
}

// generate sso login links
async function genSSOLinks(){
    // get the connection id's from the json
    // there will be some additional id's (for apple, google, eventually facebook (meta))
    const response = await fetch('/reporting/get-connection-ids');
    const connectionIds = await response.json();
    //console.log(connectionIds);
    let links = [];
    connectionIds.forEach(connectionId =>{
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FSSOLogin%3D${connectionId}%5D`;
        links.push({type:'sso', imgName:"SSO_"+connectionId, link});
    });
    return links;
}

// generate launcher section links
async function genLauncherSectionLinks(sections){
    let links = [];
    //console.log(sections);
    sections.forEach(element => {
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FLauncherSection%3D${element}%5D`
        links.push({ type:'section', imgName: "Section_"+element, link });
    });
    return links;
}

// generate setArea links
async function genSetAreaLinks(areas){
    let links = [];
    areas.forEach(element => {
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FsetArea%3D${element.id}%5D`
        links.push({ areaId:element.id, areaName:element.slug, type:'area', imgName:"SetArea_"+element.slug, link });
    });
    return links;
}

// generate add topic links
function genAddTopicLinks(topics){
    let links = [];

    for(const topic of topics){
        console.log(topic);
        let topicId = topic.topicId;
        let topicName = topic?.brondon?.externalTitle;

        let imgName = topic?.brondon?.externalTitle;
        if(imgName == undefined){ console.log(`Cant generate topic link for ${topicId}`); continue; }
        imgName = "Topic_"+imgName.replace(/[^a-zA-Z0-9]/g, "");
        //console.log("topic: " + imgName);

        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FAddTopic%3D${topicId}%5D`
        links.push({ topicId, topicName, type:'topic', imgName, link });
    }
    return links;
}
// generate launch activity links
function genLaunchActivityLinks(activities, activityBrondons){    
    let links = [];    

    console.log(`%${activities.length} brondons len: ${activityBrondons.length}`)

    for(const activityBrondon of activityBrondons){
        let activityId = activityBrondon.activityId;
        let activityName = activityBrondon?.brondon?.externalTitle;
        let activityType = activityBrondon.type == undefined ? 'activity' : activityBrondon.type;
        console.log("ACTIVITY");
        console.log(activityBrondon);
        console.log(activityType);

        let imgName = activityBrondon?.brondon?.externalTitle;
        if(imgName == undefined){ console.log(`Cant generate activity link for ${activityId}`); continue; }
        imgName = "Activity_"+imgName.replace(/[^a-zA-Z0-9]/g, "");

        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FLaunchActivity%3D${activityId}%5D`
        links.push({ activityId, activityName, type:activityType, imgName, link });
    }
    return links;
}
// generate discount code links

// generate topic collection link
/*function genTopicCollectionLink(topicCollection){
    // for each topic in collection, get the topic ID, put into string (comma separated), put that into link
    let topicIdList = [];
    for(const topic of topicCollection){
        topicIdList.push(topic.topicId);
    }
    let topicListStr = topicIdList.join();
    let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FAddTopic%3D${topicListStr}%5D`
    return link;
}*/

// Update the database
async function bulkAddToDatabase(allURLs, allQRCodeURLs) {
    console.log("BULK ADDING");
    console.log(allURLs);
    console.log(allQRCodeURLs);

    if(allURLs == undefined){ console.log("No Deeplinks were generated"); return; }
    if(allQRCodeURLs == undefined){ console.log("No QR Codes were generated"); return; }

    let databaseUpdateData = [];

    allURLs.forEach(urlElement => {
        let qrCodeElement = allQRCodeURLs.find(qrCode => qrCode.imgName === urlElement.imgName);
        if (qrCodeElement) {
            databaseUpdateData.push({
                deeplink: urlElement.link,
                qrCodeUrl: qrCodeElement.qrCodeS3Url,
                areaId:urlElement?.areaId,
                areaName:urlElement?.areaName,
                topicId:urlElement?.topicId,
                topicName:urlElement?.topicName,
                activityId:urlElement?.activityId,
                activityName:urlElement?.activityName,
                type: urlElement.type
            });
        }
    });

    console.log(databaseUpdateData);

    //TODO: change database structure to reflect new data being written
    const addPromises = databaseUpdateData.map(dbData => {
        return addToDatabase(
            dbData.deeplink, 
            dbData.qrCodeUrl,
            dbData.areaId,
            dbData.areaName,
            dbData.topicId,
            dbData.topicName,
            dbData.activityId,
            dbData.activityName,
            dbData.type
        );
    });

    try {
        const results = await Promise.all(addPromises);
        console.log(results);
    } catch (error) {
        console.error("Error adding data to the database:", error);
    }
}
async function addToDatabase(deeplink, qrCodeUrl, areaId, areaName, topicId, topicName, activityId, activityName, type){
    const addDLQRURL = `/qrdb/add-dl-qr`;
    const addDLQRResponse = await fetch(addDLQRURL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ deeplink, qrCodeUrl, areaId, areaName, topicId, topicName, activityId, activityName, type })
    });
    const resp = await addDLQRResponse.json();
    console.log(resp);
    return resp;    
}


// Extract Params
function extractIdFromUrl(url) {
    // Create a URL object from the input URL string
    const urlObj = new URL(url);
    
    // Get the 'dl' parameter from the URL
    const dlParam = urlObj.searchParams.get('dl');
    
    // Decode the 'dl' parameter
    const decodedDlParam = decodeURIComponent(dlParam);
    
    // Extract the ID using a regular expression for either AddTopic or LaunchActivity
    const idMatch = decodedDlParam.match(/(?:AddTopic|LaunchActivity)=([a-f0-9-]+)/);
    
    // If there's a match, return the captured group (the ID)
    if (idMatch && idMatch[1]) {
        return idMatch[1];
    }
    
    // Return null if no ID is found
    return null;
}
