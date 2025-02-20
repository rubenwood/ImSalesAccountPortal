import { canAccess } from './access-check.js';
import { writeDataForReport, resetExportData, resetButtonTexts, updateIDList } from './main.js';

import { populateAccDataRow, populateLoginData, populateUsageData, getUserEmailFromAccData, calcDaysSince } from './user-report-formatting.js';

export async function fetchAllUsersByArea() {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

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

        let playerIDList = [];
        const fetchPromises = [];

        // TODO: change this so that each response/page is written to the page when its required 
        for (let page = 1; page <= totalPages; page++) {
            fetchPromises.push(fetchUsersByAreaList(areaList.toString(), page)); // TODO: improve efficiency
        }
        const results = await Promise.all(fetchPromises);

        // update the player ID field
        results.forEach(element => {
            element.accountData.forEach(acc => {
                playerIDList.push(acc.PlayFabId);
            })            
        })
        updateIDList(playerIDList);

        const sortedData = sortAndCombineData(results);
        document.getElementById('totalPlayersReport').innerHTML = 'Total users in report: ' + sortedData.length;
        console.log(`Total matched users in area: ${sortedData.length}`);

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

// Combines the usage and account data
export function sortAndCombineData(results) {
    return results.reduce((acc, curr) => {
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
}

async function fetchUsersByAreaList(areaList, page = 1) {
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

export function populateForm(data){
    resetExportData();

    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';

    data.forEach(element => {
        let playFabId = element.accountData.PlayFabId;
        let email = getUserEmailFromAccData(element.accountData.AccountDataJSON);
        let createdDate = new Date(element.accountData.AccountDataJSON.Created);
        let lastLoginDate = new Date(element.accountData.AccountDataJSON.LastLogin);
        let daysSinceLastLogin = calcDaysSince(lastLoginDate);
        let daysSinceCreation = calcDaysSince(createdDate);
        let usageData = element.usageData.UsageDataJSON.Data;
        //console.log(usageData);
        let userPrefData = usageData?.UserPreferenceData?.Value ? JSON.parse(usageData.UserPreferenceData.Value) : undefined;
        let userProfileData = usageData?.UserProfileData?.Value ? JSON.parse(usageData.UserProfileData.Value) : undefined;
        //console.log(userPrefData);
        //console.log(userProfileData);

        let accountExpiryDate = usageData.TestAccountExpiryDate !== undefined ? new Date(usageData.TestAccountExpiryDate.Value) : undefined;
        let accountExpiryDateString = accountExpiryDate !== undefined ? accountExpiryDate.toDateString() : "N/A";
        
        let nclData;
        if(usageData.NclNhsOnboardingData != undefined){
            nclData = JSON.parse(usageData.NclNhsOnboardingData.Value);
        }
        let cpdData;
        if(usageData.NclCpdProgress != undefined){
            cpdData = JSON.parse(usageData.NclCpdProgress.Value);
        }

        try{
            const row = tableBody.insertRow();
            row.className = 'report-row';
            
            let linkedAccounts = element.accountData.AccountDataJSON.LinkedAccounts ? 
                element.accountData.AccountDataJSON.LinkedAccounts.map(acc => acc.Platform).join(", ") : "N/A";

            populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, 
                accountExpiryDateString, "", "", "", linkedAccounts);
            let loginData = populateLoginData(usageData);
            let playerDataNew = usageData.PlayerDataNewLauncher !== undefined ? JSON.parse(usageData.PlayerDataNewLauncher.Value) : undefined;
            let playerData = usageData.PlayerData !== undefined ? JSON.parse(usageData.PlayerData.Value) : undefined;
            let playerDataState = {
                totalActivitiesPlayed:0,
                averageTimePerPlay: 0,
                totalPlays: 0,
                totalPlayTime: 0,
                activityDataForReport: []
            };
            let newDataState = populateUsageData([playerDataNew, playerData], userPrefData, userProfileData, loginData, 
                nclData, cpdData, playerDataState, row);
            let activityDataForReport = newDataState.activityDataForReport;
            let averageTimePerPlay = newDataState.averageTimePerPlay;
            let totalPlays = newDataState.totalPlays;
            let totalPlayTime = newDataState.totalPlayTime;

            // write the data for the insights & export data
            writeDataForReport(playFabId, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation,
                accountExpiryDate, 0, "", "", linkedAccounts, activityDataForReport, totalPlays, totalPlayTime,
                averageTimePerPlay, userPrefData, userProfileData, nclData, cpdData, loginData);
        }catch(error){
            console.error('Error:', error);
            const row = tableBody.insertRow();
            let errorStr = `Error fetching data for user: ${error.message}`;
            row.style.backgroundColor = '#ff8c8cab'; // Highlight the cell in red
            // re-add the rows, but with the error string
            populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, daysSinceCreation, errorStr, 
                "", "", "", "");
        }
    });
}