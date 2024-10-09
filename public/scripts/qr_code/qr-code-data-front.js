import { decodeQRCode } from './qr-code-utils.js';
import { Login } from '../PlayFabManager.js';
import { getAreas, getTopics, getActivities, getAreaBrondons, getTopicBrondons, getActivityBrondons, waitForJWT} from '../immersifyapi/immersify-api.js';
import { initializeDarkMode } from '../themes/dark-mode.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');

    // event listener for login modal
    document.getElementById('loginButton').addEventListener('click', Login);
    await waitForJWT();

    document.getElementById('areasTabBtn').addEventListener('click', areasTabClicked);
    document.getElementById('topicsTabBtn').addEventListener('click', topicsTabClicked);
    document.getElementById('activitiesTabBtn').addEventListener('click', activitiesTabClicked);

    // setupPage();
    // Search listeners
    document.getElementById('search-btn').addEventListener('click', searchClicked);
    /*document.getElementById('search-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchClicked();
        }
    });*/
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

// SEARCHING
async function searchClicked() {
    // database call to find qr codes matching by:
    // area, module, topic, activity or type
    console.log("SEARCH 1");
    const searchQuery = document.getElementById('search-input').value.trim();
    if (searchQuery.length > 0) {
        console.log("searching for, ", searchQuery);
    } else {
        setupSelectedTab();
    }  
}
// TODO: make search stricter
// need to handle cases like; "sso" (should return list of sso QR codes, not le"sso"ns)
/*async function searchQRCode(query) {
    console.log("SEARCH");
    try {
        const response = await fetch(`/qrdb/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return await response.json();
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}*/

// SETUP INITIAL PAGE (SHOW ALL RESULTS)
// get all relevant info from DB
let areas, topics, activities;
let areaBrondons, topicBrondons, activityBrondons;
const Tab = {
    AREAS: Symbol("AREA"),
    TOPICS: Symbol("TOPIC"),
    ACTIVITIES: Symbol("ACTIVITY")
}
let selectedTab;


/*async function setupPage(){    
    const [areasResult, topicsResult, activitiesResult] = await Promise.all([getAreas(), getTopics(), getActivities()]);
    areas = areasResult;
    topics = topicsResult;
    activities = activitiesResult;
    
    console.log(topics);
    console.log(activities);
    console.log("-----------");

    let allBrondonData = [];
    areaBrondons = [];
    topicBrondons = [];
    activityBrondons = [];

    //areaBrondons = await getAreaBrondons(areas);
    //console.log(areaBrondons);    
    
    topicBrondons = await getTopicBrondons(topics);
    console.log(topicBrondons);
    
    //activityBrondons = await getActivityBrondons(activities);
    //console.log(activityBrondons);
    
    allBrondonData = [...areaBrondons, ...topicBrondons, ...activityBrondons];
    generateTableByBrondons(allBrondonData, areaBrondons, topicBrondons, activityBrondons);

    // get data from database
    //let dbData = await fetchQRDLData();
    // TODO: update this to use the brondon data
    //generateQRCodeTable(dbData);    

    doConfetti();
}*/

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

async function areasTabClicked(){
    selectedTab = Tab.AREAS;

    if(areas == undefined || areaBrondons == undefined){
        document.getElementById('areasTabBtn').value = "Areas...";
        areas = await getAreas();
        areaBrondons = [];
        areaBrondons = await getAreaBrondons(areas);
        document.getElementById('areasTabBtn').value = "Areas";
        doConfetti();
    }
    //console.log(areaBrondons);

    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${areaBrondons.length}<br/>`

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of areaBrondons){
        setupAreaEntry(tableBody, entry);
    }
}
async function topicsTabClicked(){
    selectedTab = Tab.TOPICS;

    if(topics == undefined || topicBrondons == undefined){
        document.getElementById('topicsTabBtn').value = "Topics...";
        topics = await getTopics();
        topicBrondons = [];
        topicBrondons = await getTopicBrondons(topics);
        document.getElementById('topicsTabBtn').value = "Topics";
        doConfetti();
    }
    //console.log(topicBrondons);
    
    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${topicBrondons.length}<br/>`

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of topicBrondons){
        setupTopicEntry(tableBody, entry);
    }
}
async function activitiesTabClicked(){
    selectedTab = Tab.ACTIVITIES;

    if(activities == undefined || activityBrondons == undefined){
        document.getElementById('activitiesTabBtn').value = "Activities...";
        activities = await getActivities();
        activityBrondons = [];
        activityBrondons = await getActivityBrondons(activities);
        document.getElementById('activitiesTabBtn').value = "Activities";
        doConfetti();
    }
    //console.log(activityBrondons);

    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${activityBrondons.length}<br/>`

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of activityBrondons){
        setupActivityEntry(tableBody, entry);
    }    
}

/*function generateTableByBrondons(allBrondonData, areaBrondons, topicBrondons, activityBrondons){
    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${allBrondonData.length}<br/>
    <b>Area Entries:</b> ${areaBrondons.length}<br/>
    <b>Topic Entries:</b> ${topicBrondons.length}<br/>
    <b>Activity Entries:</b> ${activityBrondons.length}`;

    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    for(let entry of areaBrondons){
        setupAreaEntry(tableBody, entry);
    }
    for(let entry of topicBrondons){
        setupTopicEntry(tableBody, entry);
    }
    for(let entry of activityBrondons){
        setupActivityEntry(tableBody, entry);
    }
}*/

function setupCommonElements(tableBody, brondon){
    const brondonData = brondon.brondon;

    const cmsBucket = 'https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/';
    const qrCodeFullUrl = cmsBucket+brondonData.qrCode;

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
    // Add Area row
    const areaRow = document.createElement('tr');
    areaRow.innerHTML = `
        <td><b>Area Name</b></td>
        <td colspan="2">${brondonData.internalTitle}</td>
    `;
    tableBody.appendChild(areaRow);

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
    // Add Area row
    const areaRow = document.createElement('tr');
    areaRow.innerHTML = `
        <td><b>Area Name</b></td>
        <td colspan="2">${brondonData.areaFlag}</td>
    `;
    tableBody.appendChild(areaRow);
    // Add Module row
    // const moduleRow = document.createElement('tr');
    // moduleRow.innerHTML = `
    //     <td><b>Module</b></td>
    //     <td colspan="2">${item.module}</td>
    // `;
    // tableBody.appendChild(moduleRow);
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
    // Add Area row
    const areaRow = document.createElement('tr');
    areaRow.innerHTML = `
        <td><b>Area Name</b></td>
        <td colspan="2">${brondonData.areaFlag}</td>
    `;
    tableBody.appendChild(areaRow);
    // Add Module row
    // const moduleRow = document.createElement('tr');
    // moduleRow.innerHTML = `
    //     <td><b>Module</b></td>
    //     <td colspan="2">${item.module}</td>
    // `;
    // tableBody.appendChild(moduleRow);
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

// Generate the report / html
function generateQRCodeTable(data) {
    const totalHTML = document.getElementById('total-report');
    totalHTML.innerHTML = `<b>Total:</b> ${data.length}`;
    
    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    data.forEach(item => {
        // Add Deeplink, QR Code, Decode row
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
        
        const decodeButton = document.createElement('button');
        decodeButton.textContent = 'Decode';
        decodeButton.onclick = () => decodeQRCodeFromTable(item.qr_code_url, item.deeplink, resultSpan);

        mainRow.innerHTML = `
            <td><a href="${item.deeplink}" target="_blank">${item.deeplink}</a></td>
            <td><img src="${item.qr_code_url}" alt="QR Code" width="256" height="256"></td>
            <td></td>
        `;        
        mainRow.children[2].appendChild(decodeButton);
        mainRow.children[2].appendChild(resultSpan);
        tableBody.appendChild(mainRow);

        // Add Area row
        const areaRow = document.createElement('tr');
        areaRow.innerHTML = `
            <td><b>Area Name</b></td>
            <td colspan="2">${item.area_name}</td>
        `;
        tableBody.appendChild(areaRow);

        // Add Module row
        const moduleRow = document.createElement('tr');
        moduleRow.innerHTML = `
            <td><b>Module</b></td>
            <td colspan="2">${item.module}</td>
        `;
        tableBody.appendChild(moduleRow);

        // Add Topic row
        const topicRow = document.createElement('tr');
        topicRow.innerHTML = `
            <td><b>Topic Name</b></td>
            <td colspan="2">${item.topic_name}</td>
        `;
        tableBody.appendChild(topicRow);

        // Add Activity row
        const activityRow = document.createElement('tr');
        activityRow.innerHTML = `
            <td><b>Activity Name</b></td>
            <td colspan="2">${item.activity_name}</td>
        `;
        tableBody.appendChild(activityRow);

        // Add type row
        const typeRow = document.createElement('tr');
        typeRow.innerHTML = `
            <td><b>Type</b></td>
            <td colspan="2">${item.type}</td>
        `;
        tableBody.appendChild(typeRow);

        // Add stakeholder row
        const stakeHolderRow = document.createElement('tr');
        stakeHolderRow.innerHTML = `
            <td><b>Stakeholder</b></td>
            <td colspan="2">${item.stakeholder}</td>
        `;
        tableBody.appendChild(stakeHolderRow);

        // Add empty row for spacing
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="3">&nbsp;</td>`;
        tableBody.appendChild(emptyRow);
    });
}
// Get all deeplinks & qr codes from db
async function fetchQRDLData() {
    try {
        const response = await fetch('/qrdb/get-all-dl-qr');
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json();
        //console.log(data);
        return data;
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

async function decodeQRCodeFromTable(imageSrc, deeplink, resultSpan) {
    const decodedText = await decodeQRCode(imageSrc);
    console.log(decodedText);
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