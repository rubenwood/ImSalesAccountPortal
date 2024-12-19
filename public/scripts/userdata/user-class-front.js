//import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchB2BUsers, fetchSessionData, fetchUsersEventLog, fetchEventDetails } from './user-data-utils.js';
//import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

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
    let returningUsers = await getReturningUsers(newRetPerMonth);
    populateNewRetTable(newRetPerMonth, returningUsers);

    document.getElementById('get-report').value = "Get Report";
}

// RETURNING USERS
async function getReturningUsers(newRetPerMonth) {
    const dateRanges = getMonthlyDateRanges();
    const results = [];

    for (const { startDate, endDate } of dateRanges) {
        const filteredNewRet = newRetPerMonth.filter(
            entry =>
                new Date(entry.startDate) >= new Date(startDate) &&
                new Date(entry.endDate) <= new Date(endDate)
        );
        // get truly returning users per month
        const trulyReturningUsers = getTrulyReturningUsers(filteredNewRet);

        results.push({
            startDate,
            endDate,
            trulyReturningUsers,
        });

        console.log(`${startDate} to ${endDate} = ${trulyReturningUsers.length} truly returning users`);
    }

    console.log(results);
    return results;
}
function getTrulyReturningUsers(newRet) {
    let trulyReturningUsers = [];

    for (const entry of newRet) {
        const { newUsers, returningUsers } = entry;
        const newUserIds = new Set(newUsers.map(user => user.PlayFabId));
        trulyReturningUsers = [
            ...trulyReturningUsers,
            // filter out users in the newUserIds for this month
            ...returningUsers.filter(user => !newUserIds.has(user.PlayFabId)),
        ];
    }

    return trulyReturningUsers;
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
    return results;
}

async function getB2BUsers(){
    const b2bUsers = await fetchB2BUsers();
    console.log(b2bUsers);
    let totalB2BUsers = 0;
    b2bUsers.forEach(element => {
        totalB2BUsers += element.users.matchedUsers.length;
    });
    console.log(`Total B2B Users: ${totalB2BUsers}`);
}

async function populateNewRetTable(newRetPerMonth, returningUsers) {
    const table = document.getElementById('new-ret-table');
    table.innerHTML = `<thead><tr><th>Date</th><th>New</th><th>Returning</th></tr></thead><tbody></tbody>`;

    const tbody = table.querySelector("tbody");

    newRetPerMonth.forEach((entry, index) => {
        const row = tbody.insertRow();

        const trulyReturningUsers = returningUsers[index].trulyReturningUsers || []; // Ensure alignment
        row.insertCell(0).innerHTML = `${entry.startDate} - ${entry.endDate}`;
        row.insertCell(1).innerHTML = `${entry.newUsers.length}`;
        row.insertCell(2).innerHTML = `${trulyReturningUsers.length}`;
    });

    await getB2BUsers();

    doConfetti();
}

//HELPER
function getMonthlyDateRanges() {
    const currentDate = new Date();
    const dateRanges = [];
    
    for (let i = 0; i < 12; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() - i;
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        dateRanges.push({
            startDate: startDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            endDate: endDate.toISOString().split('T')[0],
        });
    }
    
    return dateRanges.reverse(); // Ensure order from earliest to latest
}