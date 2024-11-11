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