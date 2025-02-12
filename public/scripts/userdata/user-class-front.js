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
    document.getElementById('get-report').addEventListener('click', getUserClassReport);
    document.addEventListener("click", (event) => {
        const modal = document.getElementById("emailList");
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

async function getUserClassReport(){
    document.getElementById('get-report').value = "Getting Report...";
    let newRetPerMonth = await getNewReturningUsersAnnual();
    let returningUsers = await getReturningUsers(newRetPerMonth);
    populateNewRetTable(newRetPerMonth, returningUsers);
    const retRatesPerMonth = calcRetentionRates(newRetPerMonth, returningUsers);

    //const usersWhoPlayed = getUsersWhoPlayed(newRetPerMonth, 11);
    //console.log(usersWhoPlayed);

    document.getElementById('get-report').value = "Get Report";
}

// RETURNING USERS
export async function getReturningUsers(newRetPerMonth) {
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
export async function getNewReturningUsersAnnual() {
    const dateRanges = getMonthlyDateRanges();
    const batchSize = 4;
    const results = [];

    for (let i = 0; i < dateRanges.length; i += batchSize) {
        const batch = dateRanges.slice(i, i + batchSize).map(({ startDate, endDate }) =>
            fetchNewReturningUsers(startDate, endDate)
                .then(newRet => {
                    console.log(newRet);
                    return newRet;
                })
                .catch(error => {
                    console.error(`Failed for ${startDate} - ${endDate}: ${error.message}`);
                    return { startDate, endDate, error: error.message };
                })
        );
        results.push(...(await Promise.all(batch)));
    }

    return results;
}

export async function getB2BUsers(){
    const b2bUsers = await fetchB2BUsers();
    console.log(b2bUsers);
    let totalB2BUsers = 0;
    b2bUsers.forEach(element => {
        totalB2BUsers += element.users.matchedUsers.length;
    });
    console.log(`Total B2B Users: ${totalB2BUsers}`);
}

// total retention rate = this months returning / prev month total users
function calcRetentionRates(newRetPerMonth, returningUsers){
    const output = [];

    newRetPerMonth.forEach((entry, index) => {
        if(index-1 < 0){ return; }
        
        const monthlyRetRates = {}
        const trulyReturningUsers = returningUsers[index].trulyReturningUsers || []; // Ensure alignment
        const trulyReturningUsersPrev = returningUsers[index-1].trulyReturningUsers || []; // returning users from previous month
        const newUsersPrev = newRetPerMonth[index-1].newUsers || [];// new users from previous month

        monthlyRetRates.startDate = entry.startDate;
        monthlyRetRates.endDate = entry.endDate;
        monthlyRetRates.totalRetRate = trulyReturningUsers.length/(newUsersPrev.length+trulyReturningUsersPrev.length);
        output.push(monthlyRetRates);
    });

    console.log(output);
}

async function populateNewRetTable(newRetPerMonth, returningUsers) {
    const table = document.getElementById('new-ret-table');
    table.innerHTML = `<thead><tr><th>Date</th><th>New</th><th>New Users</th><th>Returning</th><th>Returning Users</th></tr></thead><tbody></tbody>`;

    const tbody = table.querySelector("tbody");

    newRetPerMonth.forEach((entry, index) => {
        const row = tbody.insertRow();
        const trulyReturningUsers = returningUsers[index].trulyReturningUsers || []; // Ensure alignment

        row.insertCell(0).innerHTML = `${entry.startDate} - ${entry.endDate}`;
        row.insertCell(1).innerHTML = `${entry.newUsers.length}`;

        // Create "New Users" button
        const newEmailButton = document.createElement("button");
        newEmailButton.textContent = "View New Users";
        newEmailButton.onclick = () => showEmailModal(entry.newUsers);

        const newCell = row.insertCell(2);
        newCell.appendChild(newEmailButton);

        row.insertCell(3).innerHTML = `${trulyReturningUsers.length}`;

        // Create "Returning Users" button
        const retEmailButton = document.createElement("button");
        retEmailButton.textContent = "View Returning Users";
        retEmailButton.onclick = () => showEmailModal(trulyReturningUsers);

        const retCell = row.insertCell(4);
        retCell.appendChild(retEmailButton);
    });

    await getB2BUsers();

    doConfetti();
}
function showEmailModal(users) {
    const modal = document.getElementById("emailList");
    const modalContent = modal.querySelector(".modal-content");

    // Clear previous content
    modalContent.innerHTML = "<h2>Email List</h2><ul>" +
        users.map(user => {
            let userEmail = getUserEmail(user);
            return userEmail !== undefined ? `<li>${userEmail}</li>` : '';
        }).join('') +
        "</ul>";

    modal.style.display = "block";
}


function getUserEmail(user){
    console.log(`${user.PlayFabId}\n${user.AccountDataJSON.LinkedAccounts.length}\n${user.AccountDataJSON.ContactEmailAddresses.length}`)

    if(user.AccountDataJSON.LinkedAccounts.length > 0){
        for(const account of user.AccountDataJSON.LinkedAccounts){
            //if(account.Platform == "PlayFab" || account.Platform == "OpenIdConnect"){ checkContact = false; }
            if (account.Platform == "PlayFab" && account.Email){
                return account.Email;
            }
        }
    }

    if(user.AccountDataJSON.ContactEmailAddresses.length > 0){
        return user.AccountDataJSON.ContactEmailAddresses[0].EmailAddress;
    }
    return undefined;
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