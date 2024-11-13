import { canAccess } from '../access-check.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, getPlayerEmailAddr } from '../PlayFabManager.js';
import { waitForJWT, imAPIGet, getTopicBrondons } from '../immersifyapi/immersify-api.js';
import { fetchNewReturningUsers, fetchUsersEventLog } from './user-data-utils.js';
//import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }


document.addEventListener('DOMContentLoaded', async () => {
    initializeDarkMode('darkModeSwitch');
    document.getElementById('loginButton').addEventListener('click', Login);
    await waitForJWT();
    // Button events
    document.getElementById('event-log-btn').addEventListener('click', eventLogBtnClicked);
    //document.getElementById('new-ret-btn').addEventListener('click', newRetBtnClicked);
    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};


// join the parts of the logs
function eventLogJoiner(eventLogs) {
    const joinedLogs = [];

    for (const entry of eventLogs) {
        const { PlayFabId, EventLogs } = entry;
        const logsByKey = {};

        EventLogs.forEach(log => {
            const { EventLogKey, EventLogJSON, EventLogDate } = log;

            const baseKey = EventLogKey.split('_')[0];

            if (!logsByKey[baseKey]) {
                logsByKey[baseKey] = [];
            }

            logsByKey[baseKey].push({ EventLogKey, EventLogJSON, EventLogDate });
        });

        const eventLogsResult = [];

        // For each baseKey (EventLog without PartX), we join the parts
        for (const baseKey in logsByKey) {
            const parts = logsByKey[baseKey];

            // Separate logs into those with parts and those without
            const logsWithParts = parts.filter(log => log.EventLogKey.includes('_Part'));
            const logsWithoutParts = parts.filter(log => !log.EventLogKey.includes('_Part'));

            // Sort the logs with parts based on the part number (e.g., Part1, Part2)
            logsWithParts.sort((a, b) => {
                const partA = a.EventLogKey.split('_')[1];
                const partB = b.EventLogKey.split('_')[1];
                return partA.localeCompare(partB);
            });

            const allLogs = [...logsWithoutParts, ...logsWithParts];

            let joinedLog = allLogs.map(part => part.EventLogJSON.Value).join('');
            eventLogsResult.push({
                EventLogDate: allLogs[0].EventLogDate,
                EventLogKey: baseKey,
                EventLogParsed: JSON.parse(joinedLog)
            });
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
    console.log(EventList);
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
}

function processEventLogs(eventLogs) {
    getEventList(eventLogs);
    getEventIds(eventLogs);

    document.getElementById('total-users-p').innerHTML = `Total users in report: ${eventLogs.length}`;

    let totalDistinctEventLogs = getDistinctEventLogs(eventLogs);
    document.getElementById('total-distinct-logs-p').innerHTML = `Total logs across users: ${totalDistinctEventLogs}`;

    getLogsPerDate(eventLogs);

    //graphEventTypesPerDate();
    graphEventTypesPerDateChartJS();
    graphEventsTimeOfDay();
    createUserFunnelGraph(eventLogs);
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
function graphEventTypesPerDateChartJS(){
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

    const labels = Object.keys(eventCounts);
    // unique, hash-set, of event types
    const eventTypes = Array.from(new Set(
        Object.values(eventCounts).flatMap(dateEvents => Object.keys(dateEvents))
    ))
    // Populate datasets for each event type
    const datasets = eventTypes.map(eventType => ({
        label: eventType,
        backgroundColor: getColour(eventType),
        data: labels.map(date => eventCounts[date][eventType] || 0) 
    }));    

    const eventChart = new Chart(chartElement, {
        type: 'bar',
        data: {
            labels: labels,  // Dates
            datasets: datasets  // Event types and counts
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
                        // Using logarithmic style in linear scale by adjusting the tick values
                        callback: function(value) {
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
    console.log(eventPoints);

    const labels = Array.from(new Set(eventPoints.map(p => p.x)));
    const eventTypes = Array.from(new Set(eventPoints.map(p => p.eventType)));

    const datasets = eventTypes.map(eventType => {
        const data = eventPoints.filter(p => p.eventType === eventType).map(p => ({ x: p.x, y: p.y }));

        return {
            label: eventType,
            data: data,
            backgroundColor: getColour(eventType),
            pointRadius: 5,
        };
    });

    const eventChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            labels: labels,
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
                    labels: labels,
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
const steps = ['app_open', 'login', 'launch_activity'];
function countEventOccurrences(eventLogs, steps) {
    const userStepProgress = {};
  
    eventLogs.forEach(log => {
      const playFabId = log.PlayFabId;
      log.EventLogs.forEach(eventLog => {
        eventLog.EventLogParsed.sessions.forEach(session => {
          const events = session.events;
  
          let stepIndex = 0;
  
          events.forEach(event => {
            // If the event is part of the steps we care about, then we can move to the next step
            if (steps.includes(event.name)) {
              const currentStep = steps[stepIndex];
  
              // If the event is the current step, count the user for that step and move to next step
              if (event.name === currentStep) {
                if (!userStepProgress[playFabId]) {
                  userStepProgress[playFabId] = {};
                }
                userStepProgress[playFabId][currentStep] = true;
                stepIndex++;
              }
            }
          });
        });
      });
    });
  
    const stepCounts = steps.map(step => ({
      step,
      count: Object.keys(userStepProgress).filter(playFabId => userStepProgress[playFabId][step]).length
    }));
  
    return stepCounts;
}
// User Funnel
function createUserFunnelGraph(eventLogs){
    const stepCounts = countEventOccurrences(eventLogs, steps);

    const labels = stepCounts.map(count => count.step);
    const data = stepCounts.map(count => count.count);

    const ctx = document.getElementById('chart-user-funnel').getContext('2d');
    const funnelChart = new Chart(ctx, {
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


// Helper
function getColour(eventType) {

    return stringToHexColor(eventType);
    // const colorMap = {
    //     "app_open": "#4e79a7",
    //     "login": "#f28e2b",
    //     "theme_changed": "#e15759",
    //     "sign_out": "#76b7b2",
    //     "avatar_changed":"#32a852",
    //     "language_changed":"##6effec",
    //     "popup_opened":"#eb4034",
    //     "popup_closed":"#eba134"
    // };
    // return colorMap[eventType] || "#8c564b";
}
function stringToHexColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
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