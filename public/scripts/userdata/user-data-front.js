import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchUsersEventLog, fetchEventDetails, fetchEventInsights } from './user-data-utils.js';
//import { getNewReturningUsersAnnual } from './user-class-front.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

let eventDetails = "";

document.addEventListener('DOMContentLoaded', async () => {
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);
    await waitForJWT();
    // Button events
    document.getElementById('event-log-btn').addEventListener('click', eventLogBtnClicked);
    //document.getElementById('new-ret-btn').addEventListener('click', newRetBtnClicked);
    document.getElementById('user-journey-div').style.display = 'none';
    document.getElementById('toggle-inspect-user-journ-btn').addEventListener('click', toggleInspectUserJournButtons);

    eventDetails = await fetchEventDetails();
    console.log(eventDetails);

    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

// join the "_Parts" of the logs
function eventLogJoiner(eventLogs) {
    const joinedLogs = [];

    for (const entry of eventLogs) {
        const { PlayFabId, EventLogs, AccountDataJSON } = entry;
        const logsByKey = {};

        // Group logs by base key
        EventLogs.forEach(log => {
            const { EventLogKey, EventLogJSON, EventLogDate } = log;

            const baseKey = EventLogKey.split('_')[0];

            if (!logsByKey[baseKey]) {
                logsByKey[baseKey] = [];
            }

            logsByKey[baseKey].push({ EventLogKey, EventLogJSON, EventLogDate });
        });
        const eventLogsResult = [];

        for (const baseKey in logsByKey) {
            const parts = logsByKey[baseKey];

            // Separate logs with "_Part" and those without
            const logsWithParts = parts.filter(log => log.EventLogKey.includes('_Part'));
            const logsWithoutParts = parts.filter(log => !log.EventLogKey.includes('_Part'));
            // Sort logs with parts by their part number
            logsWithParts.sort((a, b) => {
                const partA = parseInt(a.EventLogKey.split('_Part')[1], 10);
                const partB = parseInt(b.EventLogKey.split('_Part')[1], 10);
                return partA - partB;
            });

            // Concatenate the values of logs with parts
            const joinedLog = logsWithParts.map(part => part.EventLogJSON.Value).join('');

            // Add logs without parts and concatenate with joined ones
            const finalLog = logsWithoutParts.length > 0 
                ? logsWithoutParts[0].EventLogJSON.Value + joinedLog 
                : joinedLog;

            if (finalLog) {
                eventLogsResult.push({
                    EventLogDate: logsWithParts[0]?.EventLogDate || logsWithoutParts[0]?.EventLogDate,
                    EventLogKey: baseKey,
                    EventLogParsed: JSON.parse(finalLog)
                });
            }
        }

        joinedLogs.push({
            PlayFabId: PlayFabId,
            EventLogs: eventLogsResult,
            AccountDataJSON: AccountDataJSON
        });
    }

    return joinedLogs;
}

async function eventLogBtnClicked(){
    document.getElementById('event-log-btn').value = "Getting Report...";

    const startDateElement = document.getElementById('event-log-start-date');
    const endDateElement = document.getElementById('event-log-end-date');
    const startDate = new Date(startDateElement.value).toISOString();
    const endDate = new Date(endDateElement.value).toISOString();

    const eventLogs = await fetchUsersEventLog(startDate, endDate);
    console.log(eventLogs);
    const eventLogsJoined = eventLogJoiner(eventLogs);
    console.log(eventLogsJoined);
    eventLogsJoined.forEach(entry => {
        entry.EventLogs.sort((a, b) => new Date(a.EventLogDate) - new Date(b.EventLogDate));
    }); 

    doConfetti();
    document.getElementById('event-log-btn').value = "Get Report";
    document.getElementById('analyse-user-journ-btn').addEventListener('click', ()=> { analyseUserJourneys(eventLogsJoined) });
    processEventLogs(eventLogsJoined);
    
}

let EventList = [];
function getEventList(eventLogs){    
    EventList = [];

    for(const entry of eventLogs){
        for(const eventLog of entry.EventLogs){
            for(const session of eventLog.EventLogParsed.sessions){
                let existingEntry = EventList.find(item => item.date === session.date);
                if (!existingEntry) {
                    existingEntry = { date: session.date, events: [] };
                    EventList.push(existingEntry);
                }
                existingEntry.events.push(...session.events);
            }
        }
        
    }
    EventList.sort((a,b) => new Date(a.date) - new Date(b.date));
}
let EventIds = [];
function getEventIds(eventLogs){
    for(const entry of eventLogs){
        for(const eventLog of entry.EventLogs){
            for(const session of eventLog.EventLogParsed.sessions){
                for(const event of session.events){
                    if(!EventIds.includes(event.name)){
                        EventIds.push(event.name);
                    }
                }
            }
        }
    }
    //console.log("Event Ids", EventIds);
}

function processEventLogs(eventLogs) {
    console.log(eventLogs);
    //fetchEventInsights(eventLogs);

    getEventList(eventLogs);
    getEventIds(eventLogs);
    populateUserJourneyButtons(eventLogs);

    document.getElementById('total-users-p').innerHTML = `Total users in report: ${eventLogs.length}`;

    let totalDistinctEventLogs = getDistinctEventLogs(eventLogs);
    document.getElementById('total-distinct-logs-p').innerHTML = `Total logs across users: ${totalDistinctEventLogs}`;

    getLogsPerDate(eventLogs);
    const sortedPopularEvents = getMostPopular(eventLogs);
    populateMostPopularTable(sortedPopularEvents);
    getUsersWhoPlayed(sortedPopularEvents);

    graphEventTypesPerDateChartJS();
    graphEventsTimeOfDay();

    graphUserFunnelStepped(eventLogs, steps, ['login', 'launcher_section_change', 'launch_activity', 'popup_opened', 'sign_out'], 1);
    graphUserFunnel(eventLogs);
    graphUserJourney(eventLogs);
}

// Data processors
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
    }
    return totalDistinctEventLogs;
}

// # Logs Per Date
function getLogsPerDate(eventLogs) {
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
                    dateSummary[logDate] = { logCount: 0, userCount: new Set(), eventCount: 0 };
                }

                dateSummary[logDate].logCount += 1;
                dateSummary[logDate].userCount.add(PlayFabId);
                for (const session of log.EventLogParsed.sessions) {
                    dateSummary[logDate].eventCount += session.events.length;
                }
            }
        }
    }

    const sortedDateEntries = Object.entries(dateSummary).sort(([dateA], [dateB]) => {
        return new Date(dateA) - new Date(dateB);
    });

    logsPerDateTable.innerHTML = "<tr><th>Date</th><th># Logs / Users</th><th># Events</th></tr>";

    for (const [date, { logCount, userCount, eventCount }] of sortedDateEntries) {
        const row = logsPerDateTable.insertRow();

        row.insertCell(0).textContent = date;
        row.insertCell(1).textContent = `${logCount} (${userCount.size})`;
        row.insertCell(2).textContent = eventCount;
    }
}

// Most popular
function getMostPopular(eventLogs) {
    const popularEvents = {};

    for (const entry of eventLogs) {
        const { PlayFabId, EventLogs, AccountDataJSON } = entry;

        for(const eventLog of EventLogs){
            for(const session of eventLog.EventLogParsed.sessions){
                for(const event of session.events){
                    const granularEventName = event.name+'~'+event.data[0];
                    if (!popularEvents[granularEventName]) {
                        popularEvents[granularEventName] = { 
                            eventName: event.name, 
                            eventData: event.data, 
                            count: 0,
                            users: new Set()
                        };
                    }

                    popularEvents[granularEventName].count += 1;
                    popularEvents[granularEventName].users.add(AccountDataJSON);                  
                }
            }
        }
    }

    //const sortedEvents = Object.values(popularEvents).sort((a, b) => b.count - a.count);
    const sortedEvents = Object.values(popularEvents).sort((a, b) => b.users.size - a.users.size);
    console.log(sortedEvents);
    return sortedEvents;  
}
function populateMostPopularTable(sortedEvents){
    const popularTable = document.getElementById('popular-events-table');
    popularTable.innerHTML = "<tr><th>Event Name</th><th>Event Data</th><th># Users</th><th># Times triggered</th></tr>";
    //const eventsToFilterOut = ["launch_activity", "display_name_changed"];
    const eventsToFilterOut = ["display_name_changed", "popup_opened", "popup_closed", "login", "sign_out", 
        "hair_colour_set", "skin_tone_set", "avatar_set"];
    for (const entry of sortedEvents) {
        //if(eventsToFilterOut.includes(entry.eventName)){ continue; }
        if(entry.eventName !== "app_open" && entry.eventName !== "login"){ continue; }
        const row = popularTable.insertRow();       

        row.insertCell(0).textContent = entry.eventName;
        row.insertCell(1).textContent = JSON.stringify(entry.eventData);
        row.insertCell(2).textContent = entry.users.size;
        row.insertCell(3).textContent = entry.count;
    }
}
// Users who played vs. not played
function getUsersWhoPlayed(sortedEvents) {
    const startDateElement = document.getElementById('event-log-start-date');
    const endDateElement = document.getElementById('event-log-end-date');
    const startDate = new Date(startDateElement.value).toISOString().split("T")[0];
    const endDate = new Date(endDateElement.value).toISOString().split("T")[0];

    const output = { 
        allUsers: [], 
        notPlayed: [], 
        newWhoPlayed: [], 
        newNotPlayed: [], 
        returningWhoPlayed: [], 
        returningNotPlayed: [] 
    };

    console.log(sortedEvents);

    for (const sortedEntry of sortedEvents) {
        for (const user of sortedEntry.users) {
            if (!output.allUsers.includes(user)) { 
                output.allUsers.push(user); 
            }

            const created = user.Created.split("T")[0];
            const lastLogin = user.LastLogin.split("T")[0];

            if (sortedEntry.eventName === "launch_activity") {
                // Created within time frame
                if (created >= startDate && created <= endDate && !output.newWhoPlayed.some(u => u.user === user)) {
                    output.newWhoPlayed.push({ activityId: sortedEntry.eventData[0], user });
                }
                // Created before startDate & lastLogin between startDate and endDate, then returning
                if (created < startDate && lastLogin >= startDate && lastLogin <= endDate && !output.returningWhoPlayed.some(u => u.user === user)) {
                    output.returningWhoPlayed.push({ activityId: sortedEntry.eventData[0], user });
                }
            }
        }
    }

    // Subtract users in newWhoPlayed and returningWhoPlayed from allUsers to get notPlayed
    const players = new Set([
        ...output.newWhoPlayed.map(entry => entry.user),
        ...output.returningWhoPlayed.map(entry => entry.user)
    ]);
    output.notPlayed = output.allUsers.filter(user => !players.has(user));
    // of the users who have not played anything, classify them as new or returning
    for (const user of output.notPlayed) {
        const created = user.Created.split("T")[0];
        const lastLogin = user.LastLogin.split("T")[0];

        if (created >= startDate && created <= endDate && !output.newNotPlayed.some(u => u.user === user)) {
            output.newNotPlayed.push(user);
        }
        
        if (created < startDate && lastLogin >= startDate && lastLogin <= endDate && !output.returningNotPlayed.some(u => u.user === user)) {
            output.returningNotPlayed.push(user);
        }
    }

    console.log(output);
    populateWhoPlayedTable(output.newWhoPlayed, 'new-played-table');
    populateWhoPlayedTable(output.returningWhoPlayed, 'returning-played-table');
    populateNotPlayedTable([...output.newNotPlayed, ...output.returningNotPlayed], sortedEvents);
    return output;
}
function populateWhoPlayedTable(usersWhoPlayed, tableId){
    const table = document.getElementById(tableId);
    table.innerHTML = "<tr><th>Activity Id</th><th>PlayFabId</th></tr>";
    for (const entry of usersWhoPlayed) {
        const row = table.insertRow();       

        row.insertCell(0).textContent = entry.activityId;
        row.insertCell(1).textContent = entry.user.PlayerId;
    }
}
function populateNotPlayedTable(usersNotPlayed, sortedEvents){
    //console.log(sortedEvents);
    console.log(usersNotPlayed);
    const notPlayedUserTable = document.getElementById('not-played-users-table');
    notPlayedUserTable.innerHTML = "<tr><th>PlayFabId</th></tr>";
    for(const user of usersNotPlayed){        
        notPlayedUserTable.insertRow().insertCell(0).textContent = user.PlayerId;
    }
    //usersNotPlayed.forEach(user => { console.log(user.PlayerId) });
    const table = document.getElementById('not-played-table');
    table.innerHTML = "<tr><th>Event</th><th>Event Data</th><th>Users</th></tr>";
    for (const entry of sortedEvents) {
        // ignore the launch activity event
        if(entry.eventName === "app_open" ||
            entry.eventName === "launch_activity" || 
            entry.eventName === "display_name_changed" ||
            entry.eventName === "avatar_set" ||
            entry.eventName === "skin_tone_set" ||
            entry.eventName === "hair_colour_set"){ continue; }
        // for this event, get its users, and remove any users who do not occur in the usersNotPlayed list
        const usersNotPlayedExclusive = Array.from(entry.users).filter(user => usersNotPlayed.includes(user));
        //console.log(usersNotPlayedExclusive);
        if(usersNotPlayedExclusive.length !== 0){
            const row = table.insertRow();
            row.insertCell(0).textContent = entry.eventName;
            row.insertCell(1).textContent = JSON.stringify(entry.eventData);
            row.insertCell(2).textContent = usersNotPlayedExclusive.length;
        }
    }
}


// Type per date
function graphEventTypesPerDateChartJS() {
    const chartElement = document.getElementById('chart-event-by-date').getContext('2d');
    // counts by date and event type
    const eventCounts = {};
    EventList.forEach(entry => {
        const date = entry.date;
        entry.events.forEach(event => {
            if (!eventCounts[date]) eventCounts[date] = {};
            if (!eventCounts[date][event.name]) eventCounts[date][event.name] = 0;
            eventCounts[date][event.name] += 1;
        });
    });

    const labels = Object.keys(eventCounts).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    // unique, hash-set, of event types
    const eventTypes = Array.from(new Set(
        Object.values(eventCounts).flatMap(dateEvents => Object.keys(dateEvents))
    ));
     // Populate datasets for each event type
    const datasets = eventTypes.map(eventType => ({
        label: eventType,
        backgroundColor: stringToHexColor(eventType),
        data: labels.map(date => eventCounts[date][eventType] || 0)
    }));

    const eventChart = new Chart(chartElement, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = eventCounts[context.label][context.dataset.label] || 0;
                            return `${context.dataset.label}: ${total}`;
                        }
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                x: {
                    stacked: false,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Event Count'
                    },
                    ticks: {
                        callback: function (value) {
                            if (value === 1 || value % 10 === 0) return value;
                        }
                    }
                }
            }
        }
    });
}

// Regex to check if the time is in HH:MM:SS:SSS format
const timeFormatRegex = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9]):([0-5]?[0-9]):(\d{3})$/;
// Time of day chart
function graphEventsTimeOfDay() {
    const ctx = document.getElementById('chart-event-by-date-time').getContext('2d');

    const eventPoints = [];

    EventList.forEach(entry => {
        const date = entry.date;
        entry.events.forEach(event => {
            const eventTimeString = event.time;

            const match = timeFormatRegex.exec(eventTimeString);
            if (match) {
                const [hours, minutes, seconds] = match.slice(1, 4).map(Number);
                const timeOfDay = hours * 60 + minutes + seconds / 60;

                eventPoints.push({
                    x: date,
                    y: timeOfDay,
                    eventType: event.name,
                });
            }
        });
    });

    const sortedDates = Array.from(new Set(eventPoints.map(p => p.x))).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('/').map(Number);
        const [dayB, monthB, yearB] = b.split('/').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });

    const eventTypes = Array.from(new Set(eventPoints.map(p => p.eventType)));

    const datasets = eventTypes.map(eventType => {
        const data = eventPoints
            .filter(p => p.eventType === eventType)
            .map(p => ({
                x: sortedDates.indexOf(p.x) > -1 ? p.x : null, // Ensure date alignment
                y: p.y
            }));

        return {
            label: eventType,
            data: data,
            backgroundColor: stringToHexColor(eventType),
            pointRadius: 5,
        };
    });

    const eventChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            labels: sortedDates,
            datasets: datasets,
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const eventType = context.dataset.label;
                            const date = context.raw.x;
                            const timeOfDay = context.raw.y;
                            const time = new Date(timeOfDay * 60 * 1000);
                            const hours = time.getHours();
                            const minutes = time.getMinutes();
                            return `${eventType} on ${date} at ${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Date',
                    },
                    labels: sortedDates,
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 10,
                    },
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Time of Day',
                    },
                    ticks: {
                        min: 0,
                        max: 24 * 60,
                        stepSize: 60,
                        callback: function(value) {
                            const date = new Date(value * 60 * 1000);
                            const hours = date.getHours();
                            const minutes = date.getMinutes();
                            return `${hours}:${minutes < 10 ? '0' + minutes : minutes}`;
                        }
                    }
                }
            }
        }
    });
}

// User Funnel Graph
const steps = ['login', 'launcher_section_change', 'launch_activity', 'sign_out'];

let funnelChart = null;
let listenersInitialized = false;
// User Funnel
function graphUserFunnelStepped(eventLogs, steps, keyEvents = [], minFlow = 2) {
    const eventFlowMap = {};
    const eventUsersMap = {};

    const eventPriority = {
        "app_open": 1,
        "login": 2,
        "launcher_section_change": 3,
        "launch_activity": 4,
        "popup_opened":5,
        "popup_closed":6
    };

    eventLogs.forEach(log => {
        const sessions = log.EventLogs.flatMap(eLog => eLog.EventLogParsed.sessions);

        sessions.forEach(session => {
            // Extract, filter, and sort events by priority or time
            const events = session.events
                .map(e => ({ name: e.name, time: e.time }))
                .filter(e => keyEvents.length === 0 || keyEvents.includes(e.name)) // Apply key event filter
                .sort((a, b) => {
                    const priorityA = eventPriority[a.name] || Number.MAX_SAFE_INTEGER;
                    const priorityB = eventPriority[b.name] || Number.MAX_SAFE_INTEGER;
                    return priorityA - priorityB || a.time.localeCompare(b.time);
                })
                .map(e => e.name);

            if (events.includes(steps[0])) {
                // Track users at each event step
                events.forEach((event, index) => {
                    if (!eventUsersMap[event]) {
                        eventUsersMap[event] = new Set();
                    }
                    eventUsersMap[event].add(log.PlayFabId);
                });

                for (let i = 0; i < events.length - 1; i++) {
                    // from - to connections (flow graph)
                    const from = events[i];
                    const to = events[i + 1];
                    const key = `${from} -> ${to}`;

                    // Track unique user transitions
                    if (!eventFlowMap[key]) {
                        eventFlowMap[key] = new Set();
                    }
                    eventFlowMap[key].add(log.PlayFabId);
                    
                    if (steps && i + 1 >= steps.length){ break; }
                }
            }
        });
    });

    // handle low frequency flows
    const sankeyData = [];
    let otherCount = 0;
    Object.entries(eventFlowMap).forEach(([key, usersSet]) => {
        const userCount = usersSet.size;
        if (userCount >= minFlow) {
            const [from, to] = key.split(" -> ");
            sankeyData.push({ from, to, flow: userCount });
        } else {
            otherCount += userCount; // Group low-frequency connections
        }
    });

    if (otherCount > 0) {
        sankeyData.push({ from: "Other", to: "Other", flow: otherCount });
    }

    // Create the Sankey chart
    const ctx = document.getElementById('userFlowSankey').getContext('2d');
    new Chart(ctx, {
        type: 'sankey',
        data: {
            datasets: [{
                label: 'User Event Funnel',
                data: sankeyData,
                colorFrom: '#4285F4',
                colorTo: '#34A853',
                hoverColor: '#FFA500',
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'User Funnel'
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

function graphUserFunnel(eventLogs) {
    if (!listenersInitialized) {
        const inputField = document.getElementById('funnel-event-step-in');
        document.getElementById('add-funnel-step-btn').addEventListener('click', () => {
            addFunnelStepClicked(eventLogs, inputField.value);
        });
        document.getElementById('remove-funnel-step-btn').addEventListener('click', () => {
            removeLastStepClicked(eventLogs);
        });
        listenersInitialized = true;
    }

    const steppedData = analyseFunnelSteps(eventLogs, steps);

    const stepLabels = steppedData.stepData.map(step => step.stepName);
    const stepUserCounts = steppedData.stepData.map(step => step.users.length);

    const nonStepEventNames = Array.from(
        new Set(
            steppedData.nonStepData.flatMap(step =>
                Object.keys(step.events)
            )
        )
    );

    const nonStepDatasets = nonStepEventNames.map(eventName => ({
        label: `${eventName}`,
        data: steppedData.nonStepData.map(step => step.events[eventName] || 0),
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
    }));

    const stepDataset = {
        label: 'Users',
        data: stepUserCounts,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
    };

    const ctx = document.getElementById('chart-user-funnel').getContext('2d');

    if (funnelChart) {
        funnelChart.destroy();
    }

    funnelChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stepLabels,
            datasets: [stepDataset, ...nonStepDatasets]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Event Steps'
                    },
                    stacked: false
                },
                y: {
                    title: {
                        display: true,
                        text: 'Counts'
                    },
                    beginAtZero: true,
                    stacked: false
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            barPercentage: 0.9,
            categoryPercentage: 0.8
        }
    });
}

function analyseFunnelSteps(eventLogs, steps) {
    const stepData = [];
    const nonStepData = [];
    const userStepProgress = {};

    // Initialize the data structure for each step
    steps.forEach((step, index) => {
        stepData.push({
            stepIndex: index,
            stepName: step,
            users: new Set(),
            events: {}
        });
        nonStepData.push({ // users who didnt do this step
            stepIndex: index,
            stepName: step,
            users: [],
            events: {}// Non-matching events triggered at this step
        });
    });

    // Track user progression through the steps and user events
    eventLogs.forEach(log => {
        const PlayFabId = log.PlayFabId;

        log.EventLogs.forEach(eventLog => {
            eventLog.EventLogParsed.sessions.forEach(session => {
                const events = session.events;
                let lastStepReached = -1;

                // Track events in the order they are triggered for each user
                if (!userStepProgress[PlayFabId]) {
                    userStepProgress[PlayFabId] = [];
                }

                events.forEach(event => {
                    const stepIndex = steps.indexOf(event.name);

                    // If the event matches a step in the funnel
                    if (stepIndex !== -1) {
                        if (stepIndex === 0 || lastStepReached === stepIndex - 1) {
                            // User progressed to this step
                            lastStepReached = stepIndex;
                            // Track the user in this step
                            stepData[stepIndex].users.add(PlayFabId);
                            // Count the event
                            stepData[stepIndex].events[event.name] = 
                                (stepData[stepIndex].events[event.name] || 0) + 1;
                            // Record user's step progress
                            userStepProgress[PlayFabId][stepIndex] = true;
                        }
                    }
                });
            });
        });
    });

    // Generate nonStepData by analysing the differences
    stepData.forEach((currentStepData, index) => {
        if (index === 0) {
            // Step 0 has no "previous step" so no nonStepData
            return;
        }

        const previousStepUsers = Array.from(stepData[index - 1].users);
        const currentStepUsers = Array.from(currentStepData.users);
        const nonMatchingUsers = previousStepUsers.filter(
            userId => !currentStepUsers.includes(userId)
        );

        // Track non-matching users and their events
        nonMatchingUsers.forEach(userId => {
            nonStepData[index].users.push(userId);

            let userEventList = [];

            eventLogs.forEach(log => {
                if (log.PlayFabId === userId) {
                    log.EventLogs.forEach(eventLog => {
                        eventLog.EventLogParsed.sessions.forEach(session => {
                            session.events.forEach((event, eventIndex) => {
                                // If event has not been recorded yet for this user
                                if (!userEventList.includes(event.name)) {
                                    userEventList.push(event.name);
                                }
                            });
                        });
                    });
                }
            });

            let eventName = userEventList[index];
            nonStepData[index].events[eventName] = (nonStepData[index].events[eventName] || 0) + 1;
        });
    });

    // Convert Sets to Arrays for readability
    stepData.forEach(step => {
        step.users = Array.from(step.users);
    });

    console.log(nonStepData);

    return { stepData, nonStepData };
}
function addFunnelStepClicked(eventLogs, eventName) {
    steps.push(eventName);
    graphUserFunnel(eventLogs);
}
function removeLastStepClicked(eventLogs){
    steps.pop();
    graphUserFunnel(eventLogs);
}

// User Journey
function toggleInspectUserJournButtons(){
    const userJourneyDiv = document.getElementById('user-journey-div');
    if(userJourneyDiv.style.display == 'block'){
        userJourneyDiv.style.display = 'none';
    }else{
        userJourneyDiv.style.display = 'block';
    }
}

function populateUserJourneyButtons(eventLogs){
    const userJourneyDiv = document.getElementById('user-journey-div');
    for(const eventLog of eventLogs){
        let button = document.createElement('input');
        button.setAttribute('type', 'button');
        button.setAttribute('id', `user-journ-btn-${eventLog.PlayFabId}`);
        button.setAttribute('value', `Inspect ${eventLog.PlayFabId}`);

        userJourneyDiv.appendChild(button);
        button.addEventListener('click', () =>{ graphUserJourney(eventLog) });
    }    
}
function graphUserJourney(eventLog, width = 1800, height = 800) {
    // Transform data to D3js; single eventLog, sorting events by time, linking sequentially
    const transformedData = {
        name: `PlayFabId: ${eventLog.PlayFabId}`,
        children: eventLog.EventLogs.flatMap(log => 
            log.EventLogParsed.sessions.map(session => ({
                name: `Session: ${session.sessionId}`,
                children: session.events
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .reduceRight((nextEvent, event) => [{
                        name: `${event.name} (${event.time})`,                        
                        details: event.data.join("\r\n"),
                        children: nextEvent
                    }], [])
            }))
        )
    };

    d3.select("#dendrogram").html("");

    const svg = d3.select("#dendrogram")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom().on("zoom", (event) => {
            svg.attr("transform", event.transform);
        }))
        .append("g")
        .attr("transform", "translate(100, 50)");

    const tree = d3.tree().nodeSize([80, 400]);

    const root = d3.hierarchy(transformedData);
    tree(root);

    // Draw links between nodes
    svg.selectAll(".link")
        .data(root.links())
        .enter().append("line")
        .attr("class", "link")
        .attr("x1", d => d.source.y)
        .attr("y1", d => d.source.x)
        .attr("x2", d => d.target.y)
        .attr("y2", d => d.target.x)
        .style("stroke", "#ccc")
        .style("stroke-width", 1.5);

        const nodeGroup = svg.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);
    
    nodeGroup.append("circle")
        .attr("r", 5)
        .style("fill", "#0088ee");
    
    nodeGroup.append("text")
        .attr("dy", 3)
        .attr("x", d => d.children ? -10 : 10)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);
    
    // Persistent details below each node
    nodeGroup.append("text")
    .attr("x", -5)
    .attr("y", 30)
    .style("text-anchor", "left")
    .style("font-size", "10px")
    .style("fill", "#555")
    .selectAll("tspan")
    .data(d => (d.data.details || "").split("\r\n"))
    .enter().append("tspan")
    .attr("x", 0) // Align all lines at the same horizontal position
    .attr("dy", (line, i) => i * 12) // Offset each line within the text block
    .text(line => line);

}

function analyseUserJourneys(eventLogs){
    //console.log(eventLogs);
    const table = document.getElementById('analyse-user-journ-table');
    table.innerHTML = `<tr>
        <th>ID</th>
        <th>Login Type</th>
        <th>B2B / B2C</th>
        <th># Sessions</th>
        <th>New / Returning</th>
        <th>Location</th>        
        <th>Launcher</th>
        <th>Explore</th>
        <th>Feed</th>
        <th>Progress</th>
        <th>Shop popup</th>
        <th>Explore Module popup</th>
        <th>Topic popup</th>
        <th>Play Activity popup</th>
        </tr>`;

    const userIds = document.getElementById('analyse-user-journ-ids').value.split('\n');
    const matchingUsers = eventLogs.filter(entry => userIds.includes(entry.PlayFabId));
    console.log(matchingUsers);
    
    for(const user of matchingUsers){
        //graphUserJourney(user);
        const row = table.insertRow();
        row.insertCell(0).textContent = user.PlayFabId;        
        row.insertCell(1).textContent = determineLoginType(user);
        row.insertCell(2).textContent = "";// B2B / B2C
        // find this user in eventLogs
        const userEvents = user.EventLogs.flatMap(log => log.EventLogParsed.sessions);
        console.log(userEvents);
        row.insertCell(3).textContent = userEvents.length; // # sessions
        row.insertCell(4).textContent = ""; // New / Returning
        row.insertCell(5).textContent = user.AccountDataJSON?.Locations?.LastLogin?.CountryCode; // Location

        row.insertCell(6).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "launcher_section_change"));
        row.insertCell(7).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "launcher_section_change" && event.data[0] === "section:Explore"));
        row.insertCell(8).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "launcher_section_change" && event.data[0] === "section:Feed"));
        row.insertCell(9).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "launcher_section_change" && event.data[0] === "section:Progress"));
        row.insertCell(10).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "popup_opened" && event.data[0] === "popup_name:ShopManager"));
        row.insertCell(11).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "popup_opened" && event.data[0] === "popup_name:ExploreModulePopup"));
        row.insertCell(12).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "popup_opened" && event.data[0] === "popup_name:TopicPopupManager"));
        row.insertCell(13).textContent = userEvents.some(session => session.events.some(event => 
            event.name === "popup_opened" && event.data[0] === "popup_name:PlayActivityPopup"));
    }
    
}

// Helper
function stringToHexColor(inString) {
    let hash = 0;
    for (let i = 0; i < inString.length; i++) {
        hash = inString.charCodeAt(i) + ((hash << 5) - hash);
    }

    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).slice(-2);
    }
    return color;
}

function determineLoginType(user){
    let loginType = "EMAIL";

    const loginPlatform = user.AccountDataJSON?.LinkedAccounts[0]?.Platform;
    const loginPlatformId = user.AccountDataJSON?.LinkedAccounts[0]?.PlatformUserId;

    if(loginPlatformId.includes("google")){
        return "GOOGLE";
    }

    switch(loginPlatform){
        case "Apple":
            return "APPLE";
        case "PlayFab":
            return "EMAIL";
        case "OpenIdConnect":
            return "UNISSO";
    }

    return loginType;
}