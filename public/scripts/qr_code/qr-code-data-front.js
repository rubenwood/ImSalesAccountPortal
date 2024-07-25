import { decodeQRCode } from './qr-code-utils.js';
import { Login } from '../PlayFabManager.js';
import { getAreas, getTopics, getActivities, waitForJWT} from '../immersifyapi/immersify-api.js';
import { initializeDarkMode } from '../themes/dark-mode.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', () => {
     // setup dark mode toggle
     initializeDarkMode('darkModeSwitch');

    setupPage();

    // event listener for login modal
    document.getElementById('loginButton').addEventListener('click', Login);

    // add event listener for uploading qr codes
    document.getElementById('upload-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const files = document.getElementById('file-input').files;
        if (files.length > 0) {
            await uploadQRCodeFiles(files);
        }
    });

    // Search listeners
    document.getElementById('search-btn').addEventListener('click', searchClicked);
    document.getElementById('search-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchClicked();
        }
    });
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

async function uploadQRCodeFiles(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    try {
        const response = await fetch('/qr/upload-files', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            alert('Files uploaded successfully');
            fetchQRDLData(); // Refresh the data after upload
        } else {
            alert('Error uploading files');
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        alert('Error uploading files');
    }
}

// SEARCHING
async function searchClicked() {
    // database call to find qr codes matching by:
    // area, module, topic, activity or type
    console.log("SEARCH 1");
    const searchQuery = document.getElementById('search-input').value.trim();
    if (searchQuery.length > 0) {
        const searchResults = await searchQRCode(searchQuery);
        generateReport(searchResults);
    } else {
        setupPage();
    }  
}
// TODO: make search stricter
// need to handle cases like; "sso" (should return list of sso QR codes, not le"sso"ns)
//
async function searchQRCode(query) {
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
}

// SETUP INITIAL PAGE (SHOW ALL RESULTS)
// get all relevant info from DB
let areas, topics, activities;
async function setupPage(){
    await waitForJWT();
    // TODO: Use promise here
    const [areasResult, topicsResult, activitiesResult] = await Promise.all([getAreas(), getTopics(), getActivities()]);
    areas = areasResult;
    topics = topicsResult;
    activities = activitiesResult;
    
    // get data from database
    let dbData = await fetchQRDLData();
    generateReport(dbData);

    doConfetti();
}

// Generate the report / html
function generateReport(data) {
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