import { decodeQRCode, getPresignedQRCodeURLs, getPresignedURLForFile } from './qr-code-utils.js';
import { Login } from '../PlayFabManager.js';
import { getAreas, getModules, getTopics, getActivities, getAreaBrondons, getTopicBrondons, getActivityBrondons, waitForJWT, imAPIGet} from '../immersifyapi/immersify-api.js';
import { initializeDarkMode } from '../themes/dark-mode.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

let areas, topics, activities;
let areaBrondons, topicBrondons, activityBrondons;
const Tab = { // enum
    AREAS: Symbol("AREA"),
    TOPICS: Symbol("TOPIC"),
    ACTIVITIES: Symbol("ACTIVITY")
}
let selectedTab;
let qrCodeURLs;

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    qrCodeURLs = await getPresignedQRCodeURLs();
    // event listener for login modal
    document.getElementById('loginButton').addEventListener('click', Login);
    await waitForJWT();

    //const moduleResp = await getModules();
    //const test = await imAPIGet(`modules/${moduleResp[0].id}`);

    document.getElementById('areasTabBtn').addEventListener('click', areasTabClicked);
    document.getElementById('topicsTabBtn').addEventListener('click', topicsTabClicked);
    document.getElementById('activitiesTabBtn').addEventListener('click', activitiesTabClicked);

    // Search listeners
    document.getElementById('search-btn').addEventListener('click', searchClicked);
    document.getElementById('search-input').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            searchClicked();
            event.preventDefault();
        }
    });
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

// SEARCHING
async function searchClicked(){
    // database call to find qr codes matching by:
    // area, module, topic, activity or type
    const searchQuery = document.getElementById('search-input').value.trim();
    if(searchQuery.length > 0){
        console.log("searching for, ", searchQuery);
        setupSearchResult(searchBrondons(searchQuery));
    }else{
        setupSelectedTab();
    }  
}
function setupSearchResult(searchResult){
    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    if(selectedTab == Tab.AREAS){
        for(let entry of searchResult){
            setupAreaEntry(tableBody, entry);
        }
    }
    if(selectedTab == Tab.TOPICS){
        for(let entry of searchResult){
            setupTopicEntry(tableBody, entry);
        }
    }
    if(selectedTab == Tab.ACTIVITIES){
        for(let entry of searchResult){
            setupActivityEntry(tableBody, entry);
        }
    }  
}
function searchBrondons(query){
    console.log(query);
    let queryLower = query.toLowerCase();
    let searchResults = [];

    let brondons;
    switch(selectedTab){
        case Tab.AREAS:
            brondons = areaBrondons;
            break;
        case Tab.TOPICS:
            brondons = topicBrondons;
            break;
        case Tab.ACTIVITIES:
            brondons = activityBrondons;
            break;
    }

    for(let entry of brondons){
        let brondon = entry?.brondon;
        if(brondon == undefined){ continue; }          
        if(brondon.internalTitle.toLowerCase().includes(queryLower) || 
            brondon.externalTitle.toLowerCase().includes(queryLower)){
            console.log("FOUND MATCH: ", entry);
            searchResults.push(entry);
        }
    }

    return searchResults;
}

function setupSelectedTab(){
    switch(selectedTab){
        case Tab.AREAS:
            areasTabClicked();
            break;
        case Tab.TOPICS:
            topicsTabClicked();
            break;
        case Tab.ACTIVITIES:
            activitiesTabClicked();
            break;
    }
}
function setSelectedTab(tab, tabBtn){
    const allTabBtns = document.querySelectorAll('.qr-tab-button');
    allTabBtns.forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    selectedTab = tab;
}

async function areasTabClicked(){
    const tabBtn = document.getElementById('areasTabBtn');
    setSelectedTab(Tab.AREAS, tabBtn);

    if(areas == undefined || areaBrondons == undefined || areas.length <= 0 || areaBrondons.length <= 0){
        tabBtn.value = "Areas...";
        areas = await getAreas();
        areaBrondons = await getAreaBrondons(areas);
        tabBtn.value = "Areas";
        doConfetti();
    }
    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${areaBrondons.length}<br/>`

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of areaBrondons){
        setupAreaEntry(tableBody, entry);
    }
}
async function topicsTabClicked(){
    const tabBtn = document.getElementById('topicsTabBtn');
    setSelectedTab(Tab.TOPICS, tabBtn);

    if(topics == undefined || topicBrondons == undefined || topics.length <= 0 || topicBrondons.length <= 0){
        tabBtn.value = "Topics...";
        topics = await getTopics();
        topicBrondons = await getTopicBrondons(topics);
        tabBtn.value = "Topics";
        doConfetti();
    }
    
    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${topicBrondons.length}<br/>`

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of topicBrondons){
        setupTopicEntry(tableBody, entry);
    }
}
async function activitiesTabClicked(){
    const tabBtn = document.getElementById('activitiesTabBtn');
    setSelectedTab(Tab.ACTIVITIES, tabBtn);

    if(activities == undefined || activityBrondons == undefined || activities.length <= 0 || activityBrondons.length <= 0){
        tabBtn.value = "Activities...";
        activities = await getActivities();
        activityBrondons = await getActivityBrondons(activities);
        tabBtn.value = "Activities";
        doConfetti();
    }

    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${activityBrondons.length}<br/>`

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of activityBrondons){
        setupActivityEntry(tableBody, entry);
    }    
}

function setupCommonElements(tableBody, brondon){
    const brondonData = brondon.brondon;
    const qrCodeFullUrl = getPresignedURLForFile(qrCodeURLs, brondonData.qrCode);

    // Add Header row
    const mainHeaderRow = document.createElement('tr');
    mainHeaderRow.innerHTML = `
        <td><b>Deeplink</b></td>
        <td><b>QR Code</b></td>
        <td><b>Decode</b></td>
    `;
    tableBody.appendChild(mainHeaderRow);
    // Add main row
    const mainRow = document.createElement('tr');
    const resultSpan = document.createElement('span');
    resultSpan.classList.add('decode-result');

    // add decode button
    const decodeButton = document.createElement('button');
    decodeButton.textContent = 'Decode';
    decodeButton.onclick = () => decodeQRCodeFromTable(qrCodeFullUrl, brondonData.deepLink, resultSpan);

    mainRow.innerHTML = `
        <td><a href="${brondonData.deepLink}" target="_blank">${brondonData.deepLink}</a></td>
        <td><img src="${qrCodeFullUrl}" alt="QR Code" width="256" height="256"></td>
        <td></td>
    `;
    mainRow.children[2].appendChild(decodeButton);
    mainRow.children[2].appendChild(resultSpan);
    tableBody.appendChild(mainRow);

    const statusRow = document.createElement('tr');
    statusRow.innerHTML = `
        <td><b>Status</b></td>
        <td colspan="2">${brondonData.status}</td>
    `;
    tableBody.appendChild(statusRow);
}
// SETUP ENTRIES
function setupAreaEntry(tableBody, brondon){
    if(brondon == undefined){ return; }
    const brondonData = brondon.brondon;
    if(brondonData == undefined){ console.log("no brondon data: ", brondon); return; }

    setupCommonElements(tableBody, brondon);
    // Add type row
    const typeRow = document.createElement('tr');
    typeRow.innerHTML = `
        <td><b>Type</b></td>
        <td colspan="2">Area</td>
    `;
    tableBody.appendChild(typeRow);
    // Add Area Id
    const IDRow = document.createElement('tr');
    IDRow.innerHTML = `
        <td><b>ID</b></td>
        <td colspan="2">${brondon.areaId}</td>
    `;
    tableBody.appendChild(IDRow);
    // Add Area Flag row
    const areaFlagRow = document.createElement('tr');
    areaFlagRow.innerHTML = `
        <td><b>Area Name</b></td>
        <td colspan="2">${brondonData.areaFlag}</td>
    `;
    tableBody.appendChild(areaFlagRow);
    // Add Area Internal title row
    const areaIntTitleRow = document.createElement('tr');
    areaIntTitleRow.innerHTML = `
        <td><b>Area Internal Title</b></td>
        <td colspan="2">${brondonData.internalTitle}</td>
    `;
    tableBody.appendChild(areaIntTitleRow);
    // Add Area External title row
    const areaExtTitleRow = document.createElement('tr');
    areaExtTitleRow.innerHTML = `
        <td><b>Area External Title</b></td>
        <td colspan="2">${brondonData.externalTitle}</td>
    `;
    tableBody.appendChild(areaExtTitleRow);

    addEmptyRow(tableBody);
}
function setupTopicEntry(tableBody, brondon){
    if(brondon == undefined){ return; }
    const brondonData = brondon.brondon;
    if(brondonData == undefined){ console.log("no brondon data: ", brondon); return; }

    setupCommonElements(tableBody, brondon);
    // Add type row
    const typeRow = document.createElement('tr');
    typeRow.innerHTML = `
        <td><b>Type</b></td>
        <td colspan="2">Topic</td>
    `;
    tableBody.appendChild(typeRow);
    // Add Topic Id
    const IDRow = document.createElement('tr');
    IDRow.innerHTML = `
        <td><b>ID</b></td>
        <td colspan="2">${brondon.topicId}</td>
    `;
    tableBody.appendChild(IDRow);
    // Add Area Flag row
    const areaRow = document.createElement('tr');
    areaRow.innerHTML = `
        <td><b>Area Name</b></td>
        <td colspan="2">${brondonData.areaFlag}</td>
    `;
    tableBody.appendChild(areaRow);
    // Add Topic row
    const internalTitleRow = document.createElement('tr');
    internalTitleRow.innerHTML = `
        <td><b>Internal Title</b></td>
        <td colspan="2">${brondonData.internalTitle}</td>
    `;
    tableBody.appendChild(internalTitleRow);

    const externalTitleRow = document.createElement('tr');
    externalTitleRow.innerHTML = `
        <td><b>External Title</b></td>
        <td colspan="2">${brondonData.externalTitle}</td>
    `;
    tableBody.appendChild(externalTitleRow);

    addEmptyRow(tableBody);
}
function setupActivityEntry(tableBody, brondon){
    if(brondon == undefined){ return; }
    const brondonData = brondon.brondon;
    if(brondonData == undefined){ console.log("no brondon data: ", brondon); return; }
    setupCommonElements(tableBody, brondon);

    // Add type row
    const typeRow = document.createElement('tr');
    typeRow.innerHTML = `
        <td><b>Type</b></td>
        <td colspan="2">Activity</td>
    `;
    tableBody.appendChild(typeRow);
    // Add Id Row
    const IDRow = document.createElement('tr');
    IDRow.innerHTML = `
        <td><b>ID</b></td>
        <td colspan="2">${brondon.activityId}</td>
    `;
    tableBody.appendChild(IDRow);
    // Add Area Flag row
    const areaRow = document.createElement('tr');
    areaRow.innerHTML = `
        <td><b>Area Name</b></td>
        <td colspan="2">${brondonData.areaFlag}</td>
    `;
    tableBody.appendChild(areaRow);
    // Add Topic row
    // const topicRow = document.createElement('tr');
    // topicRow.innerHTML = `
    //     <td><b>Topic Name</b></td>
    //     <td colspan="2">${item.topic_name}</td>
    // `;
    // tableBody.appendChild(topicRow);
    // Add Activity row
    const internalTitleRow = document.createElement('tr');
    internalTitleRow.innerHTML = `
        <td><b>Internal Title</b></td>
        <td colspan="2">${brondonData.internalTitle}</td>
    `;
    tableBody.appendChild(internalTitleRow);

    const externalTitleRow = document.createElement('tr');
    externalTitleRow.innerHTML = `
        <td><b>External Title</b></td>
        <td colspan="2">${brondonData.externalTitle}</td>
    `;
    tableBody.appendChild(externalTitleRow);

    // Add empty row for spacing
    addEmptyRow(tableBody);
}

// ROW HELPERS
function addEmptyRow(tableBody){
    // Add empty row for spacing
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="3">&nbsp;</td>`;
    tableBody.appendChild(emptyRow);
}
// DECODE
async function decodeQRCodeFromTable(imageSrc, deeplink, resultSpan) {
    const decodedText = await decodeQRCode(imageSrc);
    //console.log(decodedText);
    if (decodedText !== null) {
        compareDecodeToDL(decodedText, deeplink, resultSpan);
    }
}
function compareDecodeToDL(decodeText, dlText, resultSpan) {
    if (decodeText === dlText) {
        resultSpan.textContent = 'correct';
        resultSpan.style.color = 'green';
    } else {
        resultSpan.textContent = 'incorrect';
        resultSpan.style.color = 'red';
    }
}