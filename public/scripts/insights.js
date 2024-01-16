import { reportData } from "./main.js";
import { formatTime } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('insightsButton').addEventListener('click', showInsightsModal);
    document.getElementById('closeInsightsButton').addEventListener('click', closeInsightsModal);
});

// INSIGHT DATA MODAL
export function showInsightsModal() {   
    let totalPlayTimeAcrossAllUsers = getTotalPlayTimeHTML(reportData);
    let playersWithMostPlayTime = findPlayersWithMostPlayTimeHTML(reportData, 1, 3);
    let playersWithLeastPlayTime = findPlayersWithLeastPlayTimeHTML(reportData, 1, 3);
    let playersWithMostPlays = findPlayersWithMostPlaysHTML(reportData, 1, 3);
    let playersWithLeastPlays = findPlayersWithLeastPlaysHTML(reportData, 1, 3);
    let playersWithMostUniqueActivities = findPlayersWithMostUniqueActivitiesPlayedHTML(reportData, 1, 3);
    let mostPlayedActivities = findMostPlayedActivitiesHTML(reportData, 1, 10);
    let playsBetweenDates = findPlaysBetweenDatesHTML(reportData, '01/01/2024 00:00:00', '16/01/2024 23:59:59');

    let content = "";
    content += totalPlayTimeAcrossAllUsers;
    content += playersWithMostPlayTime;
    content += playersWithLeastPlayTime;
    content += playersWithMostPlays;
    content += playersWithLeastPlays;
    content += playersWithMostUniqueActivities;
    content += mostPlayedActivities;
    content += playsBetweenDates;

    document.getElementById('insightsContent').innerHTML = content;
    document.getElementById('insightsModal').style.display = 'block';
}
export function closeInsightsModal() {
    document.getElementById('insightsModal').style.display = 'none';
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
    let output = '<h2>Players with the most playtime</h2><br/>';

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
    let output = '<h2>Players with the least playtime</h2><br/>';

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
    let output = '<h2>Players with the most plays</h2><br/>';

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
    let output = '<h2>Players with the least plays</h2><br/>';

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
            console.log(`No activities found for ${data.email}`);
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
    console.log(selectedPlayers);
    return selectedPlayers;
}
function findPlayersWithMostUniqueActivitiesPlayedHTML(reportData, start, end) {
    let selectedPlayers = findPlayersWithMostUniqueActivitiesPlayed(reportData, start, end);
    let output =  '<h2>Players with the most unique activities played</h2><br/>';

    // Format the result for display
    selectedPlayers.forEach((player, index) => {
        output += `${start + index}. ${player.email}, unique activities played: ${player.uniqueActivitiesCount}<br/>`;
    });

    return output;
}

// Get most played activity & Get least played activity
export function findMostPlayedActivities(reportData, start, end) {
    let activityCounts = {};

    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
                data.activityData.forEach(activity => {
                    const activityKey = activity.activityID + ' - ' + activity.activityTitle;
                    if (activityCounts[activityKey]) {
                        activityCounts[activityKey].count += activity.playCount;
                    } else {
                        activityCounts[activityKey] = {
                            id: activity.activityID,
                            title: activity.activityTitle,
                            count: activity.playCount
                        };
                    }
            });
        }
    });

    // Convert the object into an array and sort it by count in descending order
    const sortedActivities = Object.values(activityCounts).sort((a, b) => b.count - a.count);
    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, sortedActivities.length);

    // Slice the array to get the specified range
    const mostPlayedActivities = sortedActivities.slice(start, end);
    return mostPlayedActivities;
}
function findMostPlayedActivitiesHTML(reportData, start, end) {
    let mostPlayedActivities = findMostPlayedActivities(reportData, start, end);
    let output = '<h2>Most Played Activities</h2><br/>';

    // Format the result for display
    mostPlayedActivities.forEach((activity, index) => {
        output += `${start + index}. ID: ${activity.id}, Title: ${activity.title}, Total Times Played: ${activity.count}<br/>`;
    });

    return output;
}

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