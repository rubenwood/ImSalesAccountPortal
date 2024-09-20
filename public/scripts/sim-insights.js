import {setupInsightTabs, setupTabsHTML, findMostPlayedActivities, generateMostPlayedHTML, findHighestPlayTimeActivities, generateHighestPlayTimeHTML} from './insights.js';
import {formatTime} from './utils.js';

export function showSimInsights(reportData){
    let simStats = getSimStats(reportData);

    let content = "";
    content += setupTabsHTML();
    content += "<h2>Simulation Insights</h2>";
    content += "<h2>Total Simulations Play Time</h2>";
    content += formatTime(simStats.totalSimPlayTime);
    content += "<h2>Total Simulations Attempted</h2>";
    content += simStats.totalSimsAttempted;
    content += "<h2>Total Simulation Plays</h2>";
    content += simStats.totalSimPlays;
    content += "<h2>Most Played Simulations</h2>";
    let mostPlayedHTML = generateMostPlayedHTML(simStats.mostPlayedSims, 1);
    content += mostPlayedHTML;
    content += "<h2>Most Played Simulations (Play Time)</h2>";
    let highestPlayTimeHTML = generateHighestPlayTimeHTML(simStats.highestPlayTimeSims, 1);
    content += highestPlayTimeHTML;
    content += "<h2>Average Scores per Simulation</h2>";
    let averageScoresHTML = generateAverageScoredHTML(simStats.averageScores);
    content += averageScoresHTML;

    document.getElementById('insightsContent').innerHTML = content;
    document.getElementById('insightsModal').style.display = 'block';

    setupInsightTabs(reportData);
}

export function getSimStats(reportData){
    let output = {
        totalSimPlayTime:0,
        totalSimsAttempted:0,
        totalSimPlays:0,
        totalSimsCompleted:0,
        mostPlayedSims:[],
        highestPlayTimeSims:[],
        averageScores:[]
    };
    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes('_prac') || activity.activityType == 'Simulation'){ 
                    activity.plays.forEach(play =>{
                        output.totalSimPlayTime += Math.round(Math.abs(play.sessionTime));
                    });
                    output.totalSimsAttempted++;
                    output.totalSimPlays += activity.playCount;
                }
            });
        }
    });

    output.mostPlayedSims = findMostPlayedActivities(reportData, 1, 10, 'Simulation');
    output.highestPlayTimeSims = findHighestPlayTimeActivities(reportData, 1, 10, 'Simulation');
    output.averageScores = calculateAverageScores(reportData);

    return output;
}

function calculateAverageScores(reportData) {
    let scoreSum = {};
    let playCount = {};
    let activityTitles = {};

    reportData.forEach(data => {
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes('_prac') || activity.activityType == 'Simulation'){ 
                    if (!(activity.activityID in scoreSum)) {
                        scoreSum[activity.activityID] = 0;
                        playCount[activity.activityID] = 0;
                        activityTitles[activity.activityID] = activity.activityTitle;
                    }

                    activity.plays.forEach(play => {
                        if ('normalisedScore' in play) {
                            scoreSum[activity.activityID] += play.normalisedScore;
                            playCount[activity.activityID]++;
                        }
                    });
                }
            });
        }
    });

    // Transform the accumulated data into an array of objects
    let averageScoresArray = Object.keys(scoreSum).map(activityID => ({
        id: activityID,
        activityTitle: activityTitles[activityID],
        averageScore: playCount[activityID] > 0 ? scoreSum[activityID] / playCount[activityID] : 0,
    }));
    // sort array
    averageScoresArray.sort((a, b) => b.averageScore - a.averageScore);

    return averageScoresArray;
}
function generateAverageScoredHTML(averageScores){
    let output = "";
    averageScores.forEach((activity, index) => {
        let scoreAsPercentage = activity.averageScore * 100;
        output += `${index + 1}. <b>ID:</b> ${activity.id}, <b>Title:</b> ${activity.activityTitle}, <b>Average Score:</b> ${Math.round(scoreAsPercentage)}%<br/>`;
    });
    return output;
}


// this function will filter the display sims by the chosen area,
// it will need to update all the other stats too
function filterByArea(simList, chosenArea)
{

}