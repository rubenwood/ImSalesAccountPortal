export function formatTime(secondsTotal) {
    // Handle case where input is 0
    if (secondsTotal <= 0) {
        return "0 seconds";
    }

    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;

    let formattedTime = '';
    if (hours > 0) {
        formattedTime += `${hours} hours `;
    }
    if (minutes > 0 || hours > 0) { // Include minutes if there are hours, or if minutes is not 0
        formattedTime += `${minutes} minutes `;
    }
    // Include seconds if there are minutes or hours, or if seconds is not 0
    if (seconds > 0 || minutes > 0 || hours > 0) {
        formattedTime += `${seconds} seconds`;
    }

    return formattedTime.trim(); // Trim to remove any trailing space
}
export function formatTimeToHHMMSS(seconds) {
    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(secs).padStart(2, '0');

    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
}

export function formatActivityData(activityData) {
    let formattedData = [];

    activityData.forEach(activity => {
        activity.plays.forEach(play => {
            formattedData.push({
                activityID: activity.activityID,
                activityTitle: activity.activityTitle,
                playDate: play.playDate,
                score: play.normalisedScore,
                sessionTime: play.sessionTime
            });
        });
    });
    return formattedData;
}

// Upload to S3
async function uploadToS3(Bucket, Key, data) {
    await s3.upload({
        Bucket,
        Key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json'
    }).promise();
    console.log(`Uploaded ${Key}`);
}

// Used to display loading "ticks" on a button
export function updateButtonText(button, text, maxTicks) {
    let tickCount = 0; 
    return function() {
        let dots = ".".repeat(tickCount % (maxTicks + 1));
        button.value = `${text}${dots}`;
        tickCount++;
    };
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

export let academicAreas;
export async function getAcademicAreas() {
    const url = `/getAcademicAreas`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.academicAreas;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}
getAcademicAreas();


export function fetchUserAccInfoById(playFabID) {
    const url = `/get-user-acc-info-id/${playFabID}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playFabID }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}
// Function to fetch user data for a given email
export function fetchUserAccInfoByEmail(email) {
    const url = `/get-user-acc-info-email/${email}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => ({
                error: true,
                message: err.error || 'An unknown error occurred'
            }));
        }
        return response.json();
    });
}

export function fetchUserProfileById(playFabID) {
    const url = `/get-user-profile-id/${playFabID}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playFabID }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}

export function fetchUserData(playFabID) {
    const url = `/get-user-data/${playFabID}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playFabID }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}