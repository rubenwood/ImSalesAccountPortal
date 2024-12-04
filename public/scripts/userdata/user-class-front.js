import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchUsersEventLog, fetchEventDetails } from './user-data-utils.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);
    await waitForJWT();
    // Button events
    document.getElementById('get-report').addEventListener('click', getUserClassReport)
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};


async function getUserClassReport(){
    document.getElementById('get-report').value = "Getting Report...";
    let newRetPerMonth = await getNewReturningUsersAnnual();
    populateNewRetTable(newRetPerMonth);

    document.getElementById('get-report').value = "Get Report";
}

// Function to call the API and collect results
async function getNewReturningUsersAnnual() {
    const dateRanges = getMonthlyDateRanges();
    const results = [];
    
    for (const { startDate, endDate } of dateRanges) {
        try {
            const newRet = await fetchNewReturningUsers(startDate, endDate);
            console.log(newRet);
            results.push(newRet);
        } catch (error) {
            console.error(`Failed for ${startDate} - ${endDate}: ${error.message}`);
            results.push({ startDate, endDate, error: error.message });
        }
    }
    
    console.log(results);

    return results;
}
function populateNewRetTable(newRetPerMonth){
    const table = document.getElementById('new-ret-table');
    table.innerHTML = `<th>Date</th><th>New</th><th>Returning</th>`;
    newRetPerMonth.forEach(entry =>{
        const row = table.insertRow();
        row.insertCell(0).innerHTML = `${entry.startDate} - ${entry.endDate}`;
        row.insertCell(1).innerHTML = `${entry.newUsers.length}`;
        row.insertCell(2).innerHTML = `${entry.returningUsers.length}`;
    })
    
}



//HELPER
function getMonthlyDateRanges() {
    const currentDate = new Date();
    const dateRanges = [];
    
    for (let i = 0; i < 12; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() - i;
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0); // Last day of the month
        
        dateRanges.push({
            startDate: startDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            endDate: endDate.toISOString().split('T')[0],
        });
    }
    
    return dateRanges.reverse(); // Ensure order from earliest to latest
}
