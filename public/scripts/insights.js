import {formatTime} from './utils.js';
import {showLessonInsights} from './lesson-insights.js';
import {showSimInsights} from './sim-insights.js';

// INSIGHT DATA MODAL
export function showInsightsModal(reportData) {
    const totalUsersInReport = getTotalUsersInReportHTML(reportData);
    const totalLogins = getTotalLoginsHTML(reportData);
    const totalLoginsPerMonth = getTotalLoginsPerMonthHTML(reportData);
    const userAccessPerPlatform = getUserAccessPerPlatformHTML(reportData);
    const totalPlayTimeAcrossAllUsers = getTotalPlayTimeHTML(reportData);
    const playersWithMostPlayTime = findPlayersWithMostPlayTimeHTML(reportData, 1, 3);
    const playersWithLeastPlayTime = findPlayersWithLeastPlayTimeHTML(reportData, 1, 3);
    const playersWithMostPlays = findPlayersWithMostPlaysHTML(reportData, 1, 3);
    const playersWithLeastPlays = findPlayersWithLeastPlaysHTML(reportData, 1, 3);
    const playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayedHTML(reportData, 1, 3);
    const mostPlayedActivities = findMostPlayedActivitiesHTML(reportData, 1, 10);
    const highestPlayTimeActivities = findHighestPlayTimeActivitiesHTML(reportData, 1, 10);
    //let playsBetweenDates = findPlaysBetweenDatesHTML(reportData, '01/01/2024 00:00:00', '31/01/2024 23:59:59');
    //let totalPlayTimeBetweenDates = totalPlayTimeBetweenDatesHTML(reportData, '01/01/2024 00:00:00', '31/01/2024 23:59:59');

    let content = "";
    content += setupTabsHTML();
    content += totalUsersInReport;
    content += totalLogins;
    content += totalLoginsPerMonth;
    content += userAccessPerPlatform;
    content += totalPlayTimeAcrossAllUsers;
    content += playersWithMostPlayTime;
    content += playersWithLeastPlayTime;
    content += playersWithMostPlays;
    content += playersWithLeastPlays;
    content += playersWithMostUniqueActivities;
    content += mostPlayedActivities;
    content += highestPlayTimeActivities;
    //content += playsBetweenDates;
    //content += totalPlayTimeBetweenDates;

    document.getElementById('insightsContent').innerHTML = content;
    const insightsModel = document.getElementById('insightsModal');
    insightsModel.style.display = 'block';

    setupInsightTabs(reportData);

    window.onclick = function(event) {
        if (event.target == insightsModel) {
            closeInsightsModal();
        }
    }
}
export function closeInsightsModal() {
    document.getElementById('insightsModal').style.display = 'none';
}
export function setupTabsHTML() {
    return `
        <div id="modalTabs">
            <input type="button" id="overviewTab" class="modalTab" value="Overview">
            <input type="button" id="lessonInsightsTab" class="modalTab" value="Lesson Insights">
            <input type="button" id="simInsightsTab" class="modalTab" value="Sim Insights">
        </div>
    `;
}
export function setupInsightTabs(reportData){
    document.getElementById('overviewTab').addEventListener('click', function() {
        showInsightsModal(reportData);
    });
    document.getElementById('lessonInsightsTab').addEventListener('click', function() {
        showLessonInsights(reportData);
    });
    document.getElementById('simInsightsTab').addEventListener('click', function() {
        showSimInsights(reportData);
    });
}


function getTotalUsersInReportHTML(reportData){
    return `<h2>Total Users in Report</h2><br/>${reportData.length}`;
}

export function getTotalLogins(reportData){
    let totalLogins = 0;
    reportData.forEach(data => {
        totalLogins += data.loginData.totalLogins;
    });
    return totalLogins;
}
function getTotalLoginsHTML(reportData){
    return `<h2>Total Logins</h2><br/>${getTotalLogins(reportData)}`;
}

export function getTotalLoginsPerMonth(reportData) {
    let totalLoginsPerMonth = [];

    reportData.forEach(data => {
        if (!data.loginData || !data.loginData.loginsPerMonth){ console.log("NO LOGIN DATA"); return totalLoginsPerMonth };
        
        data.loginData.loginsPerMonth.forEach(entry => {
            let monthEntry = totalLoginsPerMonth.find(element => element.year === entry.year && element.month === entry.month);

            if (!monthEntry) {
                totalLoginsPerMonth.push({ year: entry.year, month: entry.month, logins: entry.logins });
            } else {
                monthEntry.logins += entry.logins;
            }
        });
    });
    return totalLoginsPerMonth;
}
function getTotalLoginsPerMonthHTML(reportData){
    const totalLoginsPerMonth = getTotalLoginsPerMonth(reportData);
    let output =  "";
    totalLoginsPerMonth.forEach(entry => {
        output += `<b>${entry.month} ${entry.year}</b> ${entry.logins}<br/>`;
    });
    return `<h2>Total Logins Per Month</h2><br/>${output}`;
}


export function getUserAccessPerPlatform(reportData){
    let totalAndroid = 0;
    let totalIOS = 0;
    let totalWeb = 0;

    reportData.forEach(data => {
        if(data.loginData !== undefined && data.loginData.lastLoginAndr !== undefined){
            totalAndroid++;
        }
        if(data.loginData !== undefined && data.loginData.lastLoginIOS !== undefined){
            totalIOS++;
        }
        if(data.loginData !== undefined && data.loginData.lastLoginWeb !== undefined){
            totalWeb++;
        }
    });
    return {totalAndroid, totalIOS, totalWeb};
}
function getUserAccessPerPlatformHTML(reportData){
    let userAccPerPlat = getUserAccessPerPlatform(reportData);
    return `<h2>User Access per platform</h2>
    <br/>Android: ${userAccPerPlat.totalAndroid}<br/>iOS: ${userAccPerPlat.totalIOS}<br/>Web: ${userAccPerPlat.totalWeb}`;
}

// Get total play time across all users
export function getTotalPlayTime(reportData){
    let totalPlayTimeAcrossAllUsers = 0;
    reportData.forEach((data) => {
        totalPlayTimeAcrossAllUsers += data.totalPlayTime;
    });

    return totalPlayTimeAcrossAllUsers;
}
function getTotalPlayTimeHTML(reportData){
    let totalPlayTimeAcrossAllUsers = getTotalPlayTime(reportData);
    return `<h2>Total Play Time across all users</h2><br/>${formatTime(totalPlayTimeAcrossAllUsers)}`;
}

// Get player most play time & Get player least play time
export function findPlayersWithMostPlayTime(reportData, start, end) {
    // Sort the data by totalPlayTime in descending order
    const sortedData = reportData.slice().sort((a, b) => b.totalPlayTime - a.totalPlayTime);

    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, reportData.length);

    // Slice the sorted array to get the range
    const selectedPlayers = sortedData.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithMostPlayTimeHTML(reportData, start, end){
    let selectedPlayers = findPlayersWithMostPlayTime(reportData, start, end);
    let output = '<h2>Users with the most playtime</h2><br/>';

    // Format the result for display (you can customize this part as needed)
    selectedPlayers.map((player, index) => {
        output += `${start + index}. ${player.email}, Total Play Time: ${formatTime(player.totalPlayTime)}<br/>`;
    }).join('\n');

    return output;
}

export function findPlayersWithLeastPlayTime(reportData, start, end) {
    const sortedData = reportData.slice().sort((a, b) => a.totalPlayTime - b.totalPlayTime);

    start = Math.max(start - 1, 0);
    end = Math.min(end, reportData.length);

    const selectedPlayers = sortedData.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithLeastPlayTimeHTML(reportData, start, end) {
    let selectedPlayers = findPlayersWithLeastPlayTime(reportData, start, end);
    let output = '<h2>Users with the least playtime</h2><br/>';

    selectedPlayers.map((player, index) => {
        output += `${start + index}. ${player.email}, Total Play Time: ${formatTime(player.totalPlayTime)}<br/>`;
    }).join('\n');

    return output;
}

// Get player with most plays & Get player with least plays
export function findPlayersWithMostPlays(reportData, start, end) {
    const sortedData = reportData.slice().sort((a, b) => b.totalPlays - a.totalPlays);

    start = Math.max(start - 1, 0);
    end = Math.min(end, reportData.length);

    const selectedPlayers = sortedData.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithMostPlaysHTML(reportData, start, end) {
    let selectedPlayers = findPlayersWithMostPlays(reportData, start, end);
    let output = '<h2>Users with the most plays</h2><br/>';

    selectedPlayers.map((player, index) => {
        output += `${start + index}. ${player.email}, Total Plays: ${player.totalPlays}<br/>`;
    }).join('\n');

    return output;
}

function findPlayersWithLeastPlays(reportData, start, end) {
    const sortedData = reportData.slice().sort((a, b) => a.totalPlays - b.totalPlays);

    start = Math.max(start - 1, 0);
    end = Math.min(end, reportData.length);

    const selectedPlayers = sortedData.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithLeastPlaysHTML(reportData, start, end){
    let selectedPlayers = findPlayersWithLeastPlays(reportData, start, end);
    let output = '<h2>Users with the least plays</h2><br/>';

    selectedPlayers.map((player, index) => {
        output += `${start + index}. ${player.email}, Total Plays: ${player.totalPlays}<br/>`;
    }).join('\n');

    return output;
}

// Get player with most activities played & Get player with least activities played
export function findPlayersWithMostUniqueActivitiesPlayed(reportData, start, end) {
    // Map each player to an object with email and count of unique activity IDs
    const playersWithUniqueActivityCount = reportData.map(data => {        
        if (data === undefined || !data.activityData || !Array.isArray(data.activityData)) {
            //console.log(`No activities found for ${data.email}`);
            return { email: data.email, uniqueActivitiesCount: 0 };
        }
        
        const uniqueActivityIDs = new Set(data.activityData.map(activity => activity.activityID));
        return { email: data.email, uniqueActivitiesCount: uniqueActivityIDs.size };
    });

    // Sort by uniqueActivitiesCount in descending order
    playersWithUniqueActivityCount.sort((a, b) => b.uniqueActivitiesCount - a.uniqueActivitiesCount);

    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, reportData.length);

    // Slice the array to get the specified range
    const selectedPlayers = playersWithUniqueActivityCount.slice(start, end);
    return selectedPlayers;
}
function findPlayersWithMostUniqueActivitiesPlayedHTML(reportData, start, end) {
    let selectedPlayers = findPlayersWithMostUniqueActivitiesPlayed(reportData, start, end);
    let output =  '<h2>Users with the most unique activities played</h2><br/>';

    // Format the result for display
    selectedPlayers.forEach((player, index) => {
        output += `${start + index}. ${player.email}, unique activities played: ${player.uniqueActivitiesCount}<br/>`;
    });

    return output;
}

// Get most played activity & Get least played activity
export function findMostPlayedActivities(reportData, start, end, activityType = null) {
    let activityCounts = {};
    let activityTypeSuffix = getActivityTypeSuffix(activityType);

    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if (activityType !== null){
                    if(activity.activityType == activityType || activity.activityID.includes(activityTypeSuffix)) {
                        updateActivityCount(activity, activityCounts);
                    }
                }else{
                    updateActivityCount(activity, activityCounts);
                }
            });
        }
    });

    // Convert the object into an array and sort it by count in descending order
    const sortedActivities = Object.values(activityCounts).sort((a, b) => b.playCount - a.playCount);
    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, sortedActivities.length);

    // Slice the array to get the specified range
    const mostPlayedActivities = sortedActivities.slice(start, end);
    return mostPlayedActivities;
}
export function generateMostPlayedHTML(mostPlayedActivities, start){
    let output = "";
    mostPlayedActivities.forEach((activity, index) => {
        output += `${start + index}. <b>ID:</b> ${activity.activityID}, <b>Title:</b> ${activity.activityTitle}, <b>Total Times Played:</b> ${activity.playCount}<br/>`;
    });
    return output;
}
function findMostPlayedActivitiesHTML(reportData, start, end) {
    let mostPlayedActivities = findMostPlayedActivities(reportData, start, end);
    let output = '<h2>Most Played Activities</h2><br/>';
    // Format the result for display
    output += generateMostPlayedHTML(mostPlayedActivities, start);
    return output;
}

export function findHighestPlayTimeActivities(reportData, start, end, activityType = null) {
    let activityPlayTimeTotals = {};
    let activityTypeSuffix = getActivityTypeSuffix(activityType);    

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activityType !== null){
                    if(activity.activityID.includes(activityTypeSuffix) || activity.activityType == activityType){
                        updateActivityPlayTimeTotals(activity, activityPlayTimeTotals);
                    }
                }else{
                    updateActivityPlayTimeTotals(activity, activityPlayTimeTotals);
                }
            });
        }
    });

    // Convert the object into an array and sort it by totalTime in descending order
    const sortedActivitiesByTime = Object.values(activityPlayTimeTotals).sort((a, b) => b.totalTime - a.totalTime);
    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, sortedActivitiesByTime.length);

    // Slice the array to get the specified range
    const highestPlayTimeActivities = sortedActivitiesByTime.slice(start, end);
    return highestPlayTimeActivities;
}
export function generateHighestPlayTimeHTML(mostPlayedActivities, start){
    let output = "";
    mostPlayedActivities.forEach((activity, index) => {
        output += `${start + index}. <b><b>ID:</b></b> ${activity.activityID}, <b>Title:</b> ${activity.activityTitle}, <b>Total Play Time:</b> ${formatTime(Math.round(activity.totalTime))}<br/>`;
    });
    return output;
}
function findHighestPlayTimeActivitiesHTML(reportData, start, end){
    let mostPlayedActivities = findHighestPlayTimeActivities(reportData, start, end);
    let output = '<h2>Most Played Activities (Play Time)</h2><br/>';
    output += generateHighestPlayTimeHTML(mostPlayedActivities, start);
    return output;
}

export function updateActivityCount(activity, activityCounts) {
    const activityKey = activity.activityID + ' - ' + activity.activityTitle;
    if (activityCounts[activityKey]) {
        activityCounts[activityKey].playCount += activity.playCount;
    } else {
        activityCounts[activityKey] = {
            activityID: activity.activityID,
            activityTitle: activity.activityTitle,
            playCount: activity.playCount
        };
    }
}
export function updateActivityPlayTimeTotals(activity, activityPlayTimeTotals) {
    const activityKey = activity.activityID + ' - ' + activity.activityTitle;
    activity.plays.forEach(play => {
        if (activityPlayTimeTotals[activityKey]) {
            activityPlayTimeTotals[activityKey].totalTime += play.sessionTime;
        } else {
            activityPlayTimeTotals[activityKey] = {
                activityID: activity.activityID,
                activityTitle: activity.activityTitle,
                totalTime: play.sessionTime
            };
        }
    });
}

// GET LEGACY ACTIVITY TYPE SUFFIX
function getActivityTypeSuffix(activityType){
    switch(activityType){
        case "Lesson":
            return "_lesson";
        case "Simulation":
            return "_prac";
    }
}

// WIP
// Get total plays between dates
function findPlaysBetweenDates(reportData, startDate, endDate) {
    const parseDate = (dateString) => {
        const parts = dateString.split(" ");
        const dateParts = parts[0].split("/");
        const timeParts = parts[1].split(":");
        // Note: months are 0-based in JavaScript Date
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
    };

    const startDateObj = parseDate(startDate);
    const endDateObj = parseDate(endDate);
    let playsWithinDateRange = [];

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if (activity.plays && Array.isArray(activity.plays)) {
                    activity.plays.forEach(play => {
                        const playDateObj = parseDate(play.playDate);

                        if (playDateObj >= startDateObj && playDateObj <= endDateObj) {
                            playsWithinDateRange.push(play);
                        }
                    });
                }
            });
        }
    });

    return playsWithinDateRange;
}
// formats the output from findPlaysBetweenDates and returns HTML
function findPlaysBetweenDatesHTML(reportData, startDate, endDate) {
    let playsBetweenDates = findPlaysBetweenDates(reportData, startDate, endDate);

    let output = `<h2>Total Plays between ${startDate} and ${endDate}</h2><br/>`;
    output += playsBetweenDates.length;
    return output;
}

function findTotalPlayTimeBetweenDates(reportData, startDate, endDate) {
    const parseDate = (dateString) => {
        const parts = dateString.split(" ");
        const dateParts = parts[0].split("/");
        const timeParts = parts[1].split(":");
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
    };

    const startDateObj = parseDate(startDate);
    const endDateObj = parseDate(endDate);
    let totalPlayTime = 0;

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if (activity.plays && Array.isArray(activity.plays)) {
                    activity.plays.forEach(play => {
                        const playDateObj = parseDate(play.playDate);

                        if (playDateObj >= startDateObj && playDateObj <= endDateObj) {
                            totalPlayTime += Math.round(play.sessionTime);
                        }
                    });
                }
            });
        }
    });
    return totalPlayTime;
}
function totalPlayTimeBetweenDatesHTML(reportData, startDate, endDate) {
    let totalPlayTime = findTotalPlayTimeBetweenDates(reportData, startDate, endDate);

    let formattedPlayTime = formatTime(totalPlayTime);
    let output = `<h2>Total Play Time between ${startDate} and ${endDate}</h2><br/>`;
    output += formattedPlayTime;
    return output;
}