export async function fetchB2BUsers(){
    console.log(localStorage.getItem("PlayFabId"));
    const response = await fetch('/b2b/get-total-users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({
            PlayFabId: localStorage.getItem("PlayFabId")
        })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch B2B users');
    }

    return await response.json();
}

// Users & Topics in feed
export async function fetchUsersTopicsInFeed(topicIds) {
    const response = await fetch('/userdata/get-users-topic-feed', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topicIds })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}

// Users Event Log
export async function fetchUsersEventLog(startDate, endDate){
    const response = await fetch('/userdata/get-users-event-log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate, endDate })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user event logs');
    }

    return await response.json();
}

// Event Details
export async function fetchEventDetails(){
    const response = await fetch('/appevents/get-event-details');

    if (!response.ok) {
        throw new Error('Failed to fetch event details');
    }

    return await response.json();
}


// New Vs. Returning
export async function fetchNewReturningUsers(startDate, endDate) {
    const response = await fetch('/userdata/get-new-returning-users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate, endDate })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}

// Session Debug Data
export async function fetchSessionData() {
    const response = await fetch('/userdata/get-session-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}
export async function fetchUsersSessionData(playFabIds) {
    const response = await fetch('/userdata/get-users-session-data', {
        method: 'POST',        
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playFabIds })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}

// Users Player Data New Launcher
export async function fetchUsersPlayerDataNewLauncher(playFabIds) {
    const response = await fetch('/userdata/get-users-player-data-nl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playFabIds })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}


// AI Insights
export async function fetchEventInsights(eventLogs) {
    const response = await fetch('/ai/eventlog-insights', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventLogs)
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}