import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchSessionData, fetchUsersEventLog, fetchEventDetails } from './user-data-utils.js';
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
    let returningUsers = await getUsersWithLoginHistory(newRetPerMonth);
    populateNewRetTable(newRetPerMonth, returningUsers);

    document.getElementById('get-report').value = "Get Report";
}


// RETURNING USERS
async function getUsersWithLoginHistory(newRetPerMonth) {
    const sessionData = await fetchSessionData();
    const dateRanges = getMonthlyDateRanges();
    const results = [];
    for (const { startDate, endDate } of dateRanges) {
        const returningUsers = getReturningUsers(newRetPerMonth, sessionData, startDate, endDate);
        const output = {
            startDate,
            endDate,
            returningUsers
        }
        results.push(output);
        console.log(`${startDate} to ${endDate} = ${returningUsers.length} returning users`);
    }

    
    console.log(results);
}
function getReturningUsers(newRetPerMonth, sessionData, startDate, endDate) {
    const returningUsers = [];

    const startDateObj = new Date(startDate + 'T00:00:00');
    const endDateObj = new Date(endDate + 'T23:59:59');

    // Find the new users for the given month
    const currentMonthNewUsers = newRetPerMonth.find(
        (range) => range.startDate === startDate && range.endDate === endDate
    )?.newUsers || [];

    console.log(`${startDateObj} ${endDateObj} ${currentMonthNewUsers.length}`);

    // Create a Set of PlayFabIds for quick lookup of new users in the current month
    const currentMonthNewUserIds = new Set(currentMonthNewUsers.map((user) => user.PlayFabId));

    for (const entry of sessionData) {
        const sessionDataStr = entry.UsageDataJSON.Data?.SessionDebugData?.Value;
        const sessionDataJSON = JSON.parse(sessionDataStr);
        const sessions = sessionDataJSON.sessions;

        for (const session of sessions) {
            const loginHistory = session.loginHistory;

            if (loginHistory !== undefined) {
                for (const login of loginHistory) {
                    const loginDate = convertToDate(login);

                    if (isNaN(loginDate)) {
                        console.error(`Invalid login date: ${login}`);
                        continue;
                    }

                    if (loginDate >= startDateObj && loginDate <= endDateObj) {
                        console.log(`User ${entry.UsageDataJSON.PlayFabId} has a login between ${startDate} and ${endDate}`);

                        // Exclude new users for the current month from returning users
                        if (!currentMonthNewUserIds.has(entry.UsageDataJSON.PlayFabId)) {
                            if (!returningUsers.some(user => user.UsageDataJSON.PlayFabId === entry.UsageDataJSON.PlayFabId)) {
                                returningUsers.push(entry);
                            }
                        } else {
                            console.log(`User ${entry.UsageDataJSON.PlayFabId} is a new user in ${startDate}`);
                        }

                        // Retrieve AccountDataJSON from the matching new user in the current month
                        const matchingNewUser = currentMonthNewUsers.find(user => user.PlayFabId === entry.UsageDataJSON.PlayFabId);
                        if (matchingNewUser) {
                            console.log(`Found AccountDataJSON for ${entry.UsageDataJSON.PlayFabId}:`, matchingNewUser);
                            // Optionally, you can add the AccountDataJSON to the entry object if needed
                            entry.AccountDataJSON = matchingNewUser.AccountDataJSON;
                        }
                    }
                }
            }
        }
    }

    return returningUsers;
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
function populateNewRetTable(newRetPerMonth, returningUsers){
    const table = document.getElementById('new-ret-table');
    table.innerHTML = `<th>Date</th><th>New</th><th>Returning</th>`;
    
    console.log(returningUsers);

    newRetPerMonth.forEach(entry =>{
        const row = table.insertRow();
        row.insertCell(0).innerHTML = `${entry.startDate} - ${entry.endDate}`;
        row.insertCell(1).innerHTML = `${entry.newUsers.length}`;
        //row.insertCell(2).innerHTML = `${entry.returningUsers.length}`;
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
        const endDate = new Date(year, month + 1, 0);
        
        dateRanges.push({
            startDate: startDate.toISOString().split('T')[0], // Format: YYYY-MM-DD
            endDate: endDate.toISOString().split('T')[0],
        });
    }
    
    return dateRanges.reverse(); // Ensure order from earliest to latest
}
// convert date to js date object
function convertToDate(login) {
    if (typeof login !== "string") {
        console.error(`Invalid input: Expected a string, but got ${typeof login}`);
        return NaN;  // Return NaN for invalid input
    }

    let date = parseDateFormat(login, "dd-MM-yyyy HH:mm:ss");
    
    if (isNaN(date)) {
        // Try dd.mm.yyyy format
        date = parseDateFormat(login, "dd.MM.yyyy HH:mm:ss");
    }
    
    if (isNaN(date)) {
        // Try dd/mm/yyyy format
        date = parseDateFormat(login, "dd/MM/yyyy HH:mm:ss");
    }
    
    if (isNaN(date)) {
        // Try to parse it as a general ISO date (e.g., "2024-12-04T15:08:42")
        date = new Date(login);
    }

    return date;
}

function parseDateFormat(dateStr, format) {
    let delimiter;
    if (dateStr.includes("-")) {
        delimiter = "-";
    } else if (dateStr.includes(".")) {
        delimiter = ".";
    } else if (dateStr.includes("/")) {
        delimiter = "/";
    } else {
        console.error(`Unknown delimiter in date string: ${dateStr}`);
        return NaN; // Return NaN for unsupported formats
    }

    // Split the dateStr based on the identified delimiter
    const dateParts = dateStr.split(delimiter);

    //console.log(`dateStr: ${dateStr}, delimiter: ${delimiter}, dateParts:`, dateParts);

    // If the parts of the date are less than expected, log and return NaN
    if (dateParts.length < 3) {
        console.error(`Invalid date format: ${dateStr}`);
        return NaN;
    }

    let day, month, year, hours, minutes, seconds;

    // Check if the format includes time (HH:mm:ss)
    if (format.includes("HH:mm:ss")) {
        // Extract day, month, and year
        [day, month] = [parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1];

        // Separate year and time (if present)
        const yearAndTime = dateParts[2].split(" ");
        year = parseInt(yearAndTime[0], 10);

        if (yearAndTime.length > 1) {
            // Extract time parts
            const timeParts = yearAndTime[1].split(":");
            [hours, minutes, seconds] = [
                parseInt(timeParts[0], 10),
                parseInt(timeParts[1], 10),
                parseInt(timeParts[2], 10)
            ];
        }
    } else {
        // Format does not include time, so only parse date components
        [day, month, year] = [parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10)];
    }

    //console.log(`Parsed day: ${day}, month: ${month + 1}, year: ${year}`);
    //console.log(`Parsed hours: ${hours}, minutes: ${minutes}, seconds: ${seconds}`);

    if (
        day !== undefined &&
        month !== undefined &&
        year !== undefined &&
        (hours === undefined || (hours !== undefined && minutes !== undefined && seconds !== undefined))
    ) {
        return new Date(year, month, day, hours || 0, minutes || 0, seconds || 0);
    } else {
        console.error(`Failed to parse date: ${dateStr} with format: ${format}`);
        return NaN; // Return NaN if parsing failed
    }
}


