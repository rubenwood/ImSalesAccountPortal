import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchUsersEventLog } from './user-data-utils.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);
    // wait for login
    await waitForJWT();
    // Button events
    document.getElementById('event-log-btn').addEventListener('click', eventLogBtnClicked);
    //document.getElementById('new-ret-btn').addEventListener('click', newRetBtnClicked);
    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};


async function eventLogBtnClicked(){
    const startDateElement = document.getElementById('event-log-start-date');
    const endDateElement = document.getElementById('event-log-end-date');
    const startDate = new Date(startDateElement.value).toISOString();
    const endDate = new Date(endDateElement.value).toISOString();

    const eventLogs = await fetchUsersEventLog(startDate, endDate);
    processEventLogs(eventLogs);
}

function processEventLogs(eventLogs) {
    console.log(eventLogs);

    // Display total number of users
    document.getElementById('total-users-p').innerHTML = `Total users in report: ${eventLogs.length}`;

    let totalDistinctEventLogs = getDistinctEventLogs(eventLogs);
    document.getElementById('total-distinct-logs-p').innerHTML = `Total logs across users: ${totalDistinctEventLogs}`;

    getLogsPerDate(eventLogs);
}

function getDistinctEventLogs(eventLogs){
    let totalDistinctEventLogs = 0;

    for (const entry of eventLogs) {
        const { PlayFabId, EventLogs } = entry;

        const uniqueDates = new Set();
        for (const log of EventLogs) {
            if (log.EventLogDate) {
                uniqueDates.add(log.EventLogDate);
            }
        }
        totalDistinctEventLogs += uniqueDates.size;

        //console.log(`User ${PlayFabId} has ${uniqueDates.size} distinct event logs.`);
    }
    return totalDistinctEventLogs;
}

function getLogsPerDate(eventLogs){
    const logsPerDateTable = document.getElementById('logs-per-date-table');

    const dateSummary = {};

    for (const entry of eventLogs) {
        const { PlayFabId, EventLogs } = entry;

        const uniqueDatesForUser = new Set();

        for (const log of EventLogs) {
            const logDate = log.EventLogDate;

            if (logDate && !uniqueDatesForUser.has(logDate)) {
                uniqueDatesForUser.add(logDate);

                if (!dateSummary[logDate]) {
                    dateSummary[logDate] = { logCount: 0, userCount: new Set() };
                }

                dateSummary[logDate].logCount += 1;
                dateSummary[logDate].userCount.add(PlayFabId);
            }
        }
    }

    // Clear any existing table rows (except headers)
    logsPerDateTable.innerHTML = "<tr><th>Date</th><th>Log Count</th><th>User Count</th></tr>";
    for (const [date, { logCount, userCount }] of Object.entries(dateSummary)) {
        const row = logsPerDateTable.insertRow();
        
        row.insertCell(0).textContent = date;
        row.insertCell(1).textContent = logCount;
        row.insertCell(2).textContent = userCount.size;
    }
}



async function newRetBtnClicked(){
    const startDateElement = document.getElementById('new-ret-start-date');
    const endDateElement = document.getElementById('new-ret-end-date');

    const startDate = new Date(startDateElement.value).toISOString();
    const endDate = new Date(endDateElement.value).toISOString();

    const newRet = await fetchNewReturningUsers(startDate, endDate);
    console.log(newRet);
}