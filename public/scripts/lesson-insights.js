import {setupInsightTabs, setupTabsHTML} from './insights.js';

export function showLessonInsights(reportData){
    console.log(reportData);
    let lessonStats = getLessonStats(reportData);
    //let totalLessonsAttempted = getTotalLessonsAttempted(reportData);
    //let totalLessonsCompleted
    //console.log(totalLessonsAttempted);

    // average lesson play time
    // total lesson play time

    let content = "";
    content += setupTabsHTML();
    content += "<h2>Lessons insights</h2>";
    content += "<h2>Total Lessons Attempted</h2>";
    content += lessonStats.totalLessonsAttempted;
    content += "<h2>Total Lesson Plays</h2>";
    content += lessonStats.totalLessonPlays;
    content += "<h2>Total Lessons Completed</h2>";
    content += lessonStats.totalLessonsCompleted;

    document.getElementById('insightsContent').innerHTML = content;
    document.getElementById('insightsModal').style.display = 'block';

    setupInsightTabs(reportData);
}

function getLessonStats(reportData){
    let output = {
        totalLessonsAttempted:0,
        totalLessonPlays:0,
        totalLessonsCompleted:0
    };
    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes("_lesson")){ 
                    output.totalLessonsAttempted++;
                    output.totalLessonPlays += activity.playCount;
                    if(activity.bestScore >= 100){
                        output.totalLessonsCompleted++;
                    }
                }
            });
        }
    });

    return output;
}