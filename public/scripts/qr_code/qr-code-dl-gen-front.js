// QR Code & Deeplink generator code
import { imAPIGet, getAreas, getTopics, getTopicBrondons, getActivities, getActivityBrondons, waitForJWT } from '../immersifyapi/immersify-api.js';
import { decodeQRCode, generateQRCodesAndUpload, genQRCode } from './qr-code-utils.js';
import { Login } from '../PlayFabManager.js';
import { SearchableList } from '../classes/searchable-list.js';

let allURLs = [];
let allQRCodeURLs;
let areas, topics, activities;
let allTopicBrondons, allActivityBrondons;

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async() => {
    // login button on modal
    document.getElementById('loginButton').addEventListener('click', Login);
    //wait until jwt for api is defined
    await waitForJWT();
    [areas, topics, activities] = await Promise.all([ getAreas(), getTopics(), getActivities()]);
    console.log("got all areas:\n", areas, "\ntopics:\n" , topics, "\nactivities:\n", activities);
    [allTopicBrondons, allActivityBrondons] = await Promise.all([getTopicBrondons(topics), getActivityBrondons(activities)]);
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


    // Searchable list
    const listContainer = document.getElementById('listContainer');
    const searchInput = document.getElementById('searchInput');
    const selectedItemsContainer = document.getElementById('selectedItemsContainer');
    let topicsSelected = [];
    const onListUpdated = (selectedItems) => {
        topicsSelected = selectedItems;
        console.log('selected topics: ', topicsSelected);
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
        // clear cache deeplink
        //https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FClearCache%5D

        /*const ssoLinksElement = document.getElementById('ssoLinks');
        const ssoLinks = await genSSOLinks();
        let ssoURLs = [];
        ssoLinks.forEach(element => { ssoURLs.push(element.link); });
        const ssoLinksStr = ssoURLs.join('\n');
        ssoLinksElement.value = ssoLinksStr;*/
        const addTopicLinks = genAddTopicLinks(allTopicBrondons);
        const launchActivityLinks = genLaunchActivityLinks(allActivityBrondons);
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
        console.log(launchActivityLinks);
        launchActivityLinks.forEach(element => { launchActivityURLs.push(element.link); });
        const launchActivityLinksStr = launchActivityURLs.join('\n');
        launchActivityLinksElement.value = launchActivityLinksStr;

        // add to all URLs, so that we can generate the QR codes
        allURLs.push(...launcherSectionLinks);
        allURLs.push(...setAreaLinks);
        allURLs.push(...addTopicLinks);
        allURLs.push(...launchActivityLinks);

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
    console.log("AREAS");
    console.log(areas);
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
        //console.log(topic);
        let topicId = topic.topicId;
        let topicName = topic.brondon.externalTitle;

        let imgName = topic.brondon.externalTitle;
        imgName = "Topic_"+imgName.replace(/[^a-zA-Z0-9]/g, "");
        //console.log("topic: " + imgName);

        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FAddTopic%3D${topicId}%5D`
        links.push({ topicId, topicName, type:'topic', imgName, link });
    }
    return links;
}
// generate launch activity links
function genLaunchActivityLinks(activities){
    console.log("CALLED");
    let links = [];
    console.log(activities);

    for(const activity of activities){
        let activityId = activity.activityId;
        let activityName = activity.brondon.externalTitle;

        let imgName = activity.brondon.externalTitle;
        imgName = "Activity_"+imgName.replace(/[^a-zA-Z0-9]/g, "");
        console.log("activity img name: " + imgName);

        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FLaunchActivity%3D${activityId}%5D`
        links.push({ activityId, activityName, type:'activity', imgName, link });
    }
    return links;
}

// generate discount code links

// generate topic collection link
function genTopicCollectionLink(topicCollection){
    // for each topic in collection, get the topic ID, put into string (comma seperated), put that into link
    let topicIdList = [];
    for(const topic of topicCollection){
        topicIdList.push(topic.topicId);
    }
    //console.log("topic id list: ", topicIdList);
    let topicListStr = topicIdList.join();
    //console.log("topic id list string: ", topicListStr);
    let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FAddTopic%3D${topicListStr}%5D`
    //console.log("topic collection link: ", link);
    return link;
}

// Update the database
async function bulkAddToDatabase(allURLs, allQRCodeURLs) {
    console.log("BULK ADDING");
    console.log(allURLs);
    console.log(allQRCodeURLs);

    let databaseUpdateData = [];

    allURLs.forEach(urlElement => {
        let qrCodeElement = allQRCodeURLs.find(qrCode => qrCode.imgName === urlElement.imgName);
        if (qrCodeElement) {
            databaseUpdateData.push({
                deeplink: urlElement.link,
                qrCodeUrl: qrCodeElement.qrCodeS3Url,
                areaId:urlElement.areaId,
                areaName:urlElement.areaName,
                topicId:urlElement.topicId,
                topicName:urlElement.topicName,
                activityId:urlElement.activityId,
                activityName:urlElement.activityName,
                type: urlElement.type
            });
        }
    });

    console.log(databaseUpdateData);

    //TODO: change database structure to reflect new data being written
    /*for(dbData of databaseUpdateData){
        let dbResp = await addToDatabase(
            element.deeplink, 
            element.qrCodeUrl,
            element.areaId,
            element.areaName,
            element.topicId,
            element.topicName,
            element.activityId,
            element.activityName,
            element.type);
        console.log(dbResp);
    }*/
}
async function addToDatabase(deeplink, qrCodeUrl, areaId, areaName, topicId, topicName, activityId, activityName, type){
    const addDLQRURL = `/add-dl-qr`;
    const addDLQRResponse = await fetch(addDLQRURL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ deeplink, qrCodeUrl, areaId, areaName, topicId, topicName, activityId, activityName, type })
    });
    const resp = await addDLQRResponse.json();
    //console.log(resp);
}