
export function formatTime(secondsTotal) {
    // Handle case where input is 0
    if (secondsTotal == undefined || secondsTotal <= 0) {
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

    return formattedTime.trim();
}
export function formatTimeToHHMMSS(seconds) {
    if(isNaN(seconds)){ return '00:00:00'; }

    seconds = Math.round(seconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(secs).padStart(2, '0');

    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
}
export function formatDate(date) {
    const pad = num => num.toString().padStart(2, '0');

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1); // Months are zero-based
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
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

// Used to display loading "ticks" on a button
export function updateButtonText(button, text, maxTicks) {
    let tickCount = 0; 
    return function() {
        let dots = ".".repeat(tickCount % (maxTicks + 1));
        button.value = `${text}${dots}`;
        tickCount++;
    };
}
// Generate password
export function generatePass(passElement) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const allCharacters = alphabet + digits;
    // Randomly choose a length between 8 and 12
    const length = Math.floor(Math.random() * 5) + 8;
    let password = '';
    // Ensure at least one digit is included
    password += digits[Math.floor(Math.random() * digits.length)];
    // Generate the rest of the password
    for (let i = 1; i < length; i++) {
        password += allCharacters[Math.floor(Math.random() * allCharacters.length)];
    }

    // Shuffle to randomize the position of the digit
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    passElement.value = password;
    return password;
}

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

export async function fetchS3JSONFile(inFilepath){
    const url = `/S3/s3GetJSONFile`;
    let filepath = inFilepath;

    try {
        console.log(`fetching file ${filepath}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', 
            },
            body: JSON.stringify({ filepath }),
        });
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}
