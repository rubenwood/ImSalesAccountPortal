import {setupInsightTabs, setupTabsHTML} from './insights.js';
import {formatTime} from './utils.js';

export function showSimInsights(reportData){
    let simsStats = getTotalSimsAttempted(reportData);
    //let totalSimsCompleted

    // average sim play time
    // total sim play time
    // average sim score

    let content = "";
    content += setupTabsHTML();
    content += "<h2>Simulation Insights</h2>";
    content += "<h2>Total Simulations Play Time</h2>";
    content += formatTime(simsStats.totalSimPlayTime);
    content += "<h2>Total Simulations Attempted</h2>";
    content += simsStats.totalSimsAttempted;
    content += "<h2>Total Simulation Plays</h2>";
    content += simsStats.totalSimPlays;

    document.getElementById('insightsContent').innerHTML = content;
    document.getElementById('insightsModal').style.display = 'block';

    setupInsightTabs(reportData);
}

function getTotalSimsAttempted(reportData){
    let output = {
        totalSimPlayTime:0,
        totalSimsAttempted:0,
        totalSimPlays:0,
        totalSimsCompleted:0
    };
    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes("_prac")){ 
                    activity.plays.forEach(play =>{
                        output.totalSimPlayTime += Math.round(Math.abs(play.sessionTime));
                    });
                    output.totalSimsAttempted++;
                    output.totalSimPlays += activity.playCount;
                }
            });
        }
    });

    return output;
}