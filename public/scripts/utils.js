function formatTime(secondsTotal) {
    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;

    let formattedTime = '';
    if (hours > 0) {
        formattedTime += `${hours} hours `;
    }
    if (minutes > 0 || hours > 0) { // Include minutes if there are hours
        formattedTime += `${minutes} minutes `;
    }
    formattedTime += `${seconds} seconds`;

    return formattedTime;
}

function formatActivityData(activityData) {
    return activityData.map(activity => {
        let playsFormatted = activity.plays.map(play => {
            return `Play Date: ${play.playDate}, Best Score: ${Math.round(play.normalisedScore * 100)}%, Session Time: ${Math.round(play.sessionTime)} seconds`;
        }).join(", "); // Join each play's string with a comma

        return `Activity ID: ${activity.activityID}, Activity Name: ${activity.activityTitle}, Plays: [${playsFormatted}], Total Session Time: ${Math.round(activity.totalSessionTime)}, Best Score: ${activity.bestScore}%`;
    }).join("\n"); // Join each activity's string with a newline
}

// GET LESSON INFO & PRAC INFO
function getLessonInfo(){
    const url = `/getLessonInfo`;
    let area = "ucla";
  
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ area }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        return response.json();
    })
    .then(data =>{
        lessonInfo = data;
    })
  }
function getPracInfo(){
    const url = `/getPracInfo`;
    let area = "ucla";
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ area }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        return response.json();
    })
    .then(data =>{        
        pracInfo = data;
    })
}
  //getLessonInfo();
  //getPracInfo();