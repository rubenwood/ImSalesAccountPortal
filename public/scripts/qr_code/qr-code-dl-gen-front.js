// QR Code & Deeplink generator code
import { decodeQRCode, generateQRCodesAndUpload, genQRCode } from './qr-code-utils.js';
import { Login } from '../PlayFabManager.js';
import { imAPIGet, getAreas, getTopics, getActivities, jwtoken } from '../immersifyapi/immersify-api.js';
import { waitUntil } from '../asyncTools.js';

let allURLs = [];
let allQRCodeURLs;

document.addEventListener('DOMContentLoaded', () => {
    // event listener for login modal
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('generate-qr-codes').addEventListener('click', async () => { 
        allQRCodeURLs = await generateQRCodesAndUpload(allURLs) 
    } );
    document.getElementById('update-db').addEventListener('click', async () => { 
        await bulkAddToDatabase(allURLs, allQRCodeURLs); 
    });
    document.getElementById('manual-gen-qr-code-btn').addEventListener('click', async () => { 
        let generateQRCodeURL = await genQRCode(document.getElementById('deeplink-qr-code-input').value);
        console.log(`code url: ${generateQRCodeURL}`);
        document.getElementById('generated-qr-img').src = generateQRCodeURL;
    });

    // DECODE QR CODE
    document.getElementById('file-input').addEventListener('change', async(event) => {
        const file = event.target.files[0];
        if (file) {
            let decodedUrl = await decodeQRCode(file);
            document.getElementById('decoded-result').innerHTML = decodedUrl;
        }
    });

    setupPage();
});
window.onload = function(){
    document.getElementById('loginModal').style.display = 'block';
};

async function setupPage(){
    console.log("Setting up the page...");
    await waitUntil(() => jwtoken !== undefined);
    console.log("JWToken is defined");

    try {
        const areas = await getAreas();
        const topics = await getTopics();
        const activities = await getActivities();
        //console.log("Data fetched:", { areas, topics, activities });

        const launcherSectionLinksElement = document.getElementById('launcherSectionLinks');
        const launcherSectionLinks = await genLauncherSectionLinks(["Explore","Library","Progress","Feed","Shop"]);
        let launcherSectionURLs = [];
        launcherSectionLinks.forEach(element => { launcherSectionURLs.push(element.link); });
        const launcherSectionLinksStr = launcherSectionURLs.join('\n');
        launcherSectionLinksElement.value = launcherSectionLinksStr;

        const areaLinksElement = document.getElementById('setAreaLinks');
        const setAreaLinks = await genSetAreaLinks(areas);
        let setAreaURLs = [];
        setAreaLinks.forEach(element => { setAreaURLs.push(element.link); });
        const setAreaLinksStr = setAreaURLs.join('\n');
        areaLinksElement.value = setAreaLinksStr;

        const addTopicLinksElement = document.getElementById('addTopicLinks');
        const addTopicLinks = await genAddTopicLinks(topics);
        let addTopicURLs = [];
        addTopicLinks.forEach(element => { addTopicURLs.push(element.link); });
        const addTopicLinksStr = addTopicURLs.join('\n');
        addTopicLinksElement.value = addTopicLinksStr;

        const launchActivityLinksElement = document.getElementById('launchActivityLinks');
        const launchActivityLinks = await genLaunchActivityLinks(activities);
        let launchActivityURLs = [];
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
async function genAddTopicLinks(topics){
    let links = [];
    //console.log(topics);

    for(const topic of topics){
        let imResp = await imAPIGet(`topics/${topic.id}`);
        console.log(imResp);
        let topicId = topic.id;
        let topicName = imResp.brondons[0].externalTitle;

        let imgName = imResp.brondons[0].externalTitle;
        imgName = "Topic_"+imgName.replace(/[^a-zA-Z0-9]/g, "");
        console.log("topic: " + imgName);

        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FAddTopic%3D${topic.id}%5D`
        links.push({ topicId, topicName, type:'topic', imgName, link });
    }
    return links;
}
// generate launch activity links
async function genLaunchActivityLinks(activities){
    let links = [];
    //console.log(activities);

    for(const activity of activities){
        let imResp = await imAPIGet(`activities/${activity.id}`);
        //console.log(imResp);
        let activityId = activity.id;
        let activityName = imResp.data.brondons[0].externalTitle;

        let imgName = imResp.data.brondons[0].externalTitle;
        imgName = "Activity_"+imgName.replace(/[^a-zA-Z0-9]/g, "");
        console.log("activity: " + imgName);

        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FLaunchActivity%3D${activity.id}%5D`
        links.push({ activityId, activityName, type:'activity', imgName, link });
    }
    return links;
}

// generate discount code links

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