// QR Code & Deeplink generator code
import { decodeQRCode, generateQRCodesAndUpload } from './qr-code-utils.js';
import { shortenUrl } from './deeplink-utils.js';
import { Login } from '../PlayFabManager.js';
import { getAreas, getTopics, getActivities, jwtoken } from '../immersifyapi/immersify-api.js';
import { waitUntil } from '../asyncTools.js';

document.addEventListener('DOMContentLoaded', () => {
    // event listener for login modal
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('generate-qr-codes').addEventListener('click', ()=> { generateQRCodesAndUpload(allURLs) } );

    setupPage();
});
window.onload = function(){
    document.getElementById('loginModal').style.display = 'block';
};

let allURLs = []; // TODO: change this to include name and url
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
        const launcherSectionLinks = genLauncherSectionLinks(["Explore","Progress","Feed", "Shop"])
        const launcherSectionLinksStr = launcherSectionLinks.join('\n');
        launcherSectionLinksElement.value = launcherSectionLinksStr;

        const areaLinksElement = document.getElementById('setAreaLinks');
        const setAreaLinks = genSetAreaLinks(areas);
        const setAreaLinksStr = setAreaLinks.join('\n');
        areaLinksElement.value = setAreaLinksStr;

        const addTopicLinksElement = document.getElementById('addTopicLinks');
        const addTopicLinks = genAddTopicLinks(topics);
        const addTopicLinksStr = addTopicLinks.join('\n');
        addTopicLinksElement.value = addTopicLinksStr;

        const launchActivityLinksElement = document.getElementById('launchActivityLinks');
        const launchActivityLinks = genLaunchActivityLinks(activities);
        const launchActivityLinksStr = launchActivityLinks.join('\n');
        launchActivityLinksElement.value = launchActivityLinksStr;

        allURLs.push(...launcherSectionLinks);
    } catch (error) {
        console.error("Error setting up page:", error);
    }
}

// generate launcher section links
function genLauncherSectionLinks(sections){
    let links = [];
    console.log(sections);
    sections.forEach(element => {
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FLauncherSection%3D${element}%5D`
        links.push(link);
    });
    return links;
}

// generate setArea links
function genSetAreaLinks(areas){
    let links = [];
    console.log(areas);
    areas.forEach(element => {
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FsetArea%3D${element.id}%5D`
        links.push(link);
    });
    return links;
}

// generate add topic links
function genAddTopicLinks(topics){
    let links = [];
    console.log(topics);
    topics.forEach(element => {
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FAddTopic%3D${element.id}%5D`
        links.push(link);
    });
    return links;
}
// generate launch activity links
function genLaunchActivityLinks(activities){
    let links = [];
    console.log(activities);
    activities.forEach(element => {
        let link = `https://immersifyeducation.com/deeplink?dl=%5Bimmersifyeducation%3A%2F%2Fimmersifydental%3FLaunchActivity%3D${element.id}%5D`
        links.push(link);
    });
    return links;
}

// generate discount code links

// for all links, generate qr codes

