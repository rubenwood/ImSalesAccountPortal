import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchUsersEventLog, fetchEventDetails } from './user-data-utils.js';
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
        const { PlayFabId, EventLogs } = entry;
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

            //console.log(finalLog);
            //console.log(PlayFabId);
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
            EventLogs: eventLogsResult
        });
    }

    return joinedLogs;
}

async function eventLogBtnClicked(){
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
    processEventLogs(eventLogsJoined);
}

let EventList = [];
function getEventList(eventLogs){
    console.log(eventLogs);
    
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
    console.log("Event list", EventList);
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
    console.log("Event Ids", EventIds);
}

function processEventLogs(eventLogs) {
    getEventList(eventLogs);
    getEventIds(eventLogs);
    populateUserJourneyButtons(eventLogs);

    document.getElementById('total-users-p').innerHTML = `Total users in report: ${eventLogs.length}`;

    let totalDistinctEventLogs = getDistinctEventLogs(eventLogs);
    document.getElementById('total-distinct-logs-p').innerHTML = `Total logs across users: ${totalDistinctEventLogs}`;

    getLogsPerDate(eventLogs);

    graphEventTypesPerDateChartJS();
    graphEventsTimeOfDay();

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

    logsPerDateTable.innerHTML = "<tr><th>Date</th><th># Logs / Users</th><th># Events</th></tr>";
    for (const [date, { logCount, userCount, eventCount }] of Object.entries(dateSummary)) {
        const row = logsPerDateTable.insertRow();

        row.insertCell(0).textContent = date;
        row.insertCell(1).textContent = `${logCount} (${userCount.size})`;
        row.insertCell(2).textContent = eventCount;
    }
}

// Type per date
function graphEventTypesPerDateChartJS() {
    const chartElement = document.getElementById('chart-event-by-date').getContext('2d');
    // counts by date and event type
    const eventCounts = {};
    EventList.forEach(entry => {
        const date = entry.date;
        console.log("date", date);
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
const steps = ['app_open', 'login', 'launch_activity', 'sign_out'];
//const steps = ['app_open', 'login', 'launch_activity', 'sign_out', 'launch_activity'];
//const steps = ['launch_activity', 'sign_out', 'launch_activity'];
//const steps = ['sign_out', 'launch_activity'];


function countEventOccurrences(eventLogs, steps) {
    const userStepProgress = {};

    eventLogs.forEach(log => {
        const PlayFabId = log.PlayFabId;

        log.EventLogs.forEach(eventLog => {
            eventLog.EventLogParsed.sessions.forEach(session => {
                const events = session.events;
                let eventTriggered = [];

                events.forEach((event, eventIndex) => {
                    if (steps.includes(event.name)) {
                        const currentStepIndex = steps.indexOf(event.name);

                        // For each event, we check if the user has triggered the previous step
                        if (currentStepIndex === 0 || eventTriggered.includes(steps[currentStepIndex - 1])) {
                            if (!userStepProgress[PlayFabId]) {
                                userStepProgress[PlayFabId] = [];
                            }

                            userStepProgress[PlayFabId][currentStepIndex] = true;
                            eventTriggered.push(event.name);
                        }
                    }
                });
            });
        });
    });

    // Count how many users completed each step
    const stepCounts = steps.map((step, index) => {
        return {
            step,
            count: Object.keys(userStepProgress).filter(userId => {
                // Check if the user completed the previous step and the current step
                return (index === 0 || userStepProgress[userId][index - 1]) && userStepProgress[userId][index];
            }).length
        };
    });

    return stepCounts;
}

function addFunnelStepClicked(eventLogs, eventName) {
    steps.push(eventName);
    graphUserFunnel(eventLogs);
}
function removeLastStepClicked(eventLogs){
    steps.pop();
    graphUserFunnel(eventLogs);
}

let funnelChart = null;
let listenersInitialized = false;
// User Funnel
function graphUserFunnel(eventLogs) {
    if(!listenersInitialized){
        const inputField = document.getElementById('funnel-event-step-in');
        document.getElementById('add-funnel-step-btn').addEventListener('click', () => {
            addFunnelStepClicked(eventLogs, inputField.value);
        });    
        document.getElementById('remove-funnel-step-btn').addEventListener('click', () => {
            removeLastStepClicked(eventLogs);
        });
        listenersInitialized = true;
    }

    const stepCounts = countEventOccurrences(eventLogs, steps);
    const labels = stepCounts.map(count => count.step);
    const data = stepCounts.map(count => count.count);

    const ctx = document.getElementById('chart-user-funnel').getContext('2d');

    // Destroy in order to refresh (when adding steps)
    if (funnelChart) { funnelChart.destroy(); }
    
    funnelChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '# Users',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Event Steps'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Users'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
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
    console.log(eventLog);
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
    .data(d => (d.data.details || "").split("\r\n")) // Split details into lines
    .enter().append("tspan")
    .attr("x", 0) // Align all lines at the same horizontal position
    .attr("dy", (line, i) => i * 12) // Offset each line within the text block
    .text(line => line); // Set the text for each line

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


async function newRetBtnClicked(){
    const startDateElement = document.getElementById('new-ret-start-date');
    const endDateElement = document.getElementById('new-ret-end-date');

    const startDate = new Date(startDateElement.value).toISOString();
    const endDate = new Date(endDateElement.value).toISOString();

    const newRet = await fetchNewReturningUsers(startDate, endDate);
    console.log(newRet);
}