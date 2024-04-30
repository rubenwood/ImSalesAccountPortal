import { canAccess } from './access-check.js';
import { writeDataForReport, resetExportData, resetButtonTexts, updateIDList } from './main.js';
import { populateForm, sortAndCombineData } from './academic-area.js';

export async function fetchUsersByClickIDList() {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

    let clickIDList = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if (clickIDList.length < 1) { return; }
    console.log(clickIDList);

    resetButtonTexts();
    document.getElementById('generateReportByClickIDButton').value = "Generating Report By Click ID...";

    try{
        let playerIDList = [];
        const fetchPromises = [];

        // TODO: change this so that each response/page is written to the page when its required 
        for (let page = 1; page <= 1; page++) {
            fetchPromises.push(fetchUsersByClickID(clickIDList.toString(), page));
        }
        const results = await Promise.all(fetchPromises);
        console.log(results);

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
        // Return the parsed JSON response
        return results;
    }catch(error){
        console.error("Error during data fetch: ", error);
    }
}

async function fetchUsersByClickID(clickIDList, page = 1){
    console.log(clickIDList);
    try{
        const url = `/click-id/click-id-count?clickids=${encodeURIComponent(clickIDList.toString())}&page=${page}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorDetails = await response.json();
            throw new Error(errorDetails.message || 'An error occurred');
        }

        return response.json();
    }catch(error){
        console.error("Error during data fetch: ", error);
    }
}