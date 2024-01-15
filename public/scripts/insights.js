import { reportData } from "./main.js";

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('insightsButton').addEventListener('click', showInsightsModal);
    document.getElementById('closeInsightsButton').addEventListener('click', closeInsightsModal);
});

// PLAYER DATA MODAL
export function showInsightsModal() {
    console.log("show insights");
    
    // get the insights & populate html 
    let playerWithMostPlayTime = findPlayersWithMostPlayTime(reportData, 1, 3);

    let content = "";
    content += playerWithMostPlayTime;

    document.getElementById('insightsContent').innerHTML = content;
    document.getElementById('insightsModal').style.display = 'block';
}
export function closeInsightsModal() {
    document.getElementById('insightsModal').style.display = 'none';
}

// Get player most play time, Get player least play time
export function findPlayersWithMostPlayTime(reportData, start, end) {
    // Sort the data by totalPlayTime in descending order
    const sortedData = reportData.slice().sort((a, b) => b.totalPlayTime - a.totalPlayTime);

    // Adjusting start and end to be zero-based index
    start = Math.max(start - 1, 0);
    end = Math.min(end, reportData.length);

    // Slice the sorted array to get the range
    const selectedPlayers = sortedData.slice(start, end);

    let output = '<h2>Players with the most playtime</h2><br/>';

    // Format the result for display (you can customize this part as needed)
    selectedPlayers.map((player, index) => {
        output += `${start + index + 1}. ${player.email}, Total Play Time: ${formatTime(player.totalPlayTime)}<br/>`;
    }).join('\n');

    return output;
}


// Get player with most plays
// Get player with least plays

// Get player with most activities played
// Get player with least activities played

// Get most played activity
// Get least played activity


// map plays per date