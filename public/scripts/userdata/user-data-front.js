import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers } from './user-data-utils.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);
    // wait for login
    await waitForJWT();
    // Button events
    document.getElementById('event-log-btn').addEventListener('click', eventLogBtnClicked);
    document.getElementById('new-ret-btn').addEventListener('click', newRetBtnClicked);
    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};


async function eventLogBtnClicked(){
    const startDateElement = document.getElementById('event-log-start-date');
    const endDateElement = document.getElementById('event-log-end-date');
    const startDate = new Date(startDateElement.value).toISOString();
    const endDate = new Date(endDateElement.value).toISOString();

    const eventLog = await fetchEventLog(startDate, endDate);
    console.log(eventLog);
}

async function newRetBtnClicked(){
    const startDateElement = document.getElementById('new-ret-start-date');
    const endDateElement = document.getElementById('new-ret-end-date');

    const startDate = new Date(startDateElement.value).toISOString();
    const endDate = new Date(endDateElement.value).toISOString();

    const newRet = await fetchNewReturningUsers(startDate, endDate);
    console.log(newRet);
}