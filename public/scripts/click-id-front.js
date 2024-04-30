import { canAccess } from './access-check.js';
import { writeDataForReport, resetExportData, resetButtonTexts, updateIDList } from './main.js';

export async function fetchUsersByClickIDList(test, page = 1) {
    let hasAccess = await canAccess();
    if (!hasAccess) { return; }

    let clickIDList = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if (clickIDList.length < 1) { return; }
    console.log(clickIDList);

    resetButtonTexts();
    document.getElementById('generateReportByClickIDButton').value = "Generating Report By Click ID...";

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

        // Parse the JSON from the response
        const jsonResponse = await response.json();
        console.log(jsonResponse);

        resetButtonTexts();
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
        // Return the parsed JSON response
        return jsonResponse;
    }catch(error){
        console.error("Error during data fetch: ", error);
    }
}