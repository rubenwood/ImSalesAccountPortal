import { canAccess } from './access-check.js';
import { writeDataForReport, resetExportData, resetButtonTexts } from './main.js';

import { populateAccDataRow, populateLoginData, populateUsageData, getUserEmailFromAccData, calcDaysSinceLastLogin, calcDaysSinceCreation } from './user-report-formatting.js';

export async function fetchAllPlayersByArea() {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

    console.log("generate report by academic area clicked");
    let areaList = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if (areaList.length < 1) { return; }

    resetButtonTexts();
    document.getElementById('generateReportByAreaButton').value = "Generating Report By Academic Area...";

    try {
        // Fetch the total number of pages first
        const countUrl = `/aca-area/area-rep-count?areas=${encodeURIComponent(areaList.toString())}`;
        const countResponse = await fetch(countUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await countResponse.json();
        const totalPages = data.totalPages;

        const fetchPromises = [];
        for (let page = 1; page <= totalPages; page++) {
            fetchPromises.push(fetchPlayersByAreaList(areaList.toString(), page));
        }

        const results = await Promise.all(fetchPromises);

        // Combine results from all pages and match usageData with accountData
        const sortedData = results.reduce((acc, curr) => {
            curr.usageData.forEach(ud => {
                const accountDataMatch = curr.accountData.find(ad => ad.PlayFabId === ud.PlayFabId);
                if (accountDataMatch) {
                    acc.push({
                        usageData: ud,
                        accountData: accountDataMatch
                    });
                }
            });
            return acc;
        }, []);

        console.log(`Total matched users in area: ${sortedData.length}`);
        console.log(sortedData);

        populateForm(sortedData);        

        resetButtonTexts();
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    } catch (error) {
        console.error("Error during data fetch: ", error);
    }
}

function populateForm(data){
    resetExportData();

    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';

    data.forEach(element =>{
        const row = tableBody.insertRow();
        row.className = 'report-row';
        let playFabId = element.accountData.PlayFabId;
        let email = getUserEmailFromAccData(element.accountData.AccountDataJSON);
        let createdDate = new Date(element.accountData.AccountDataJSON.Created);
        let lastLoginDate = new Date(element.accountData.AccountDataJSON.LastLogin);
        let daysSinceLastLogin = calcDaysSinceLastLogin(lastLoginDate);    
        let daysSinceCreation = calcDaysSinceCreation(createdDate);
        let userData = element.usageData.UsageDataJSON.Data;
        let accountExpiryDate = userData.TestAccountExpiryDate !== undefined ? new Date(userData.TestAccountExpiryDate.Value) : undefined;
        let accountExpiryDateString = accountExpiryDate !== undefined ? accountExpiryDate.toDateString() : "N/A";
        
        let linkedAccounts = element.accountData.AccountDataJSON.LinkedAccounts ? 
            element.accountData.AccountDataJSON.LinkedAccounts.map(acc => acc.Platform).join(", ") : "N/A";

        populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, 
            accountExpiryDateString, "", "", "", linkedAccounts);
        let loginData = populateLoginData(userData);
        let playerData = userData.PlayerData !== undefined ? JSON.parse(userData.PlayerData.Value) : undefined;
        let playerDataState = {
            averageTimePerPlay: 0,
            totalPlays: 0,
            totalPlayTime: 0,
            activityDataForReport: []
        };
        let newDataState = populateUsageData(playerData, loginData, playerDataState, row);
        let activityDataForReport = newDataState.activityDataForReport;
        let averageTimePerPlay = newDataState.averageTimePerPlay;
        let totalPlays = newDataState.totalPlays;
        let totalPlayTime = newDataState.totalPlayTime;

        // write the data for the insights & export data
        writeDataForReport(playFabId, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation,
             accountExpiryDate, 0, "", "", linkedAccounts, activityDataForReport, totalPlays, totalPlayTime,
             averageTimePerPlay, loginData);
    });
}

async function fetchPlayersByAreaList(areaList, page = 1) {
    const url = `/aca-area/gen-area-rep?areas=${encodeURIComponent(areaList)}&page=${page}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        const errorDetails = await response.json();
        throw new Error(errorDetails.message || 'An error occurred');
    }

    return response.json();
}