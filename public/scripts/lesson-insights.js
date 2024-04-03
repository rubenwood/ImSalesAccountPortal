import {setupInsightTabs, setupTabsHTML, findMostPlayedActivities, generateMostPlayedHTML, findHighestPlayTimeActivities, generateHighestPlayTimeHTML} from './insights.js';
import {formatTime} from './utils.js';

export function showLessonInsights(reportData){
    let lessonStats = getLessonStats(reportData);
    //let totalLessonsAttempted = getTotalLessonsAttempted(reportData);
    //let totalLessonsCompleted
    //console.log(totalLessonsAttempted);

    // average lesson play time
    // total lesson play time

    let content = "";
    content += setupTabsHTML();
    content += "<h2>Lessons Insights</h2>";
    content += "<h2>Total Lessons Play Time</h2>";
    content += formatTime(lessonStats.totalLessonPlayTime);
    content += "<h2>Total Lessons Attempted</h2>";
    content += lessonStats.totalLessonsAttempted;
    content += "<h2>Total Lesson Plays</h2>";
    content += lessonStats.totalLessonPlays;
    content += "<h2>Total Lessons Completed</h2>";
    content += lessonStats.totalLessonsCompleted;
    content += "<h2>Most Played Lessons</h2>";
    let mostPlayedHTML = generateMostPlayedHTML(lessonStats.mostPlayedLessons, 1);
    content += mostPlayedHTML;
    content += "<h2>Most Played Lessons (Play Time)</h2>";
    let highestPlayTimeHTML = generateHighestPlayTimeHTML(lessonStats.highestPlayTimeLessons, 1);
    content += highestPlayTimeHTML;

    document.getElementById('insightsContent').innerHTML = content;
    document.getElementById('insightsModal').style.display = 'block';

    setupInsightTabs(reportData);
}

function getLessonStats(reportData){
    let output = {
        totalLessonPlayTime:0,
        totalLessonsAttempted:0,
        totalLessonPlays:0,
        totalLessonsCompleted:0,
        mostPlayedLessons:[],
        highestPlayTimeLessons:[]
    };

    reportData.forEach(data => {
        // Ensure the player has valid activity data
        if (data.activityData && Array.isArray(data.activityData)) {
            data.activityData.forEach(activity => {
                if(activity.activityID.includes('_lesson')){ 
                    activity.plays.forEach(play =>{
                        output.totalLessonPlayTime += Math.round(Math.abs(play.sessionTime));
                    });
                    
                    output.totalLessonsAttempted++
                    output.totalLessonPlays += activity.playCount;
                    if(activity.bestScore >= 100){
                        output.totalLessonsCompleted++;
                    }
                }
            });
        }
    });

    output.mostPlayedLessons = findMostPlayedActivities(reportData, 1, 10, '_lesson');
    output.highestPlayTimeLessons = findHighestPlayTimeActivities(reportData, 1, 10, '_lesson');

    return output;
}