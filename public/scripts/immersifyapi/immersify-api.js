const baseURL = "https://immersify-api.herokuapp.com";

let jwtoken;

export async function auth(playfabId, playfabSessionTicket) {
    const authUrl = `${baseURL}/auth`;
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ playfabId, playfabSessionTicket })
    });
    const data = await authResponse.json();
    // TODO: move this to server side and add HTTP-only
    jwtoken = data.accessToken;
    return data;
}
export function waitForJWT() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            //const jwt = getCookie('jwtoken');
            if (jwtoken) {
                clearInterval(interval);
                resolve(jwtoken);
            }
        }, 100); // every 100ms
    });
}
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    console.log(`${parts}`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export async function getAreas() {
    //const jwtoken = getCookie('jwtoken');
    const areasUrl = `${baseURL}/areas`;
    const areasResponse = await fetch(areasUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await areasResponse.json();
    return data;
}

export async function getTopics() {
    //const jwtoken = getCookie('jwtoken');
    const topicsUrl = `${baseURL}/topics`;
    const topicsResponse = await fetch(topicsUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await topicsResponse.json();
    return data;
}
export async function getTopicBrondons(topics){
    const brondonPromises = topics.map(async (topic) => {
        const imResp = await imAPIGet(`topics/${topic.id}`);
        return { topicId: topic.id, brondon: imResp.brondons[0] };
    });

    const brondons = await Promise.all(brondonPromises);
    return brondons;
}

export async function getActivities() {
    //const jwtoken = getCookie('jwtoken');
    const activitiesUrl = `${baseURL}/activities`;
    const activitiesResponse = await fetch(activitiesUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await activitiesResponse.json();
    return data;
}
export async function getActivityBrondons(activities, limit = 10) {
    const brondons = [];
    
    const processBatch = async (batch) => {
        const brondonPromises = batch.map(async (activity) => {
            const imResp = await imAPIGet(`activities/${activity.id}`);
            return { activityId: activity.id, brondon: imResp.data.brondons[0] };
        });
        return await Promise.all(brondonPromises);
    };

    for (let i = 0; i < activities.length; i += limit) {
        const batch = activities.slice(i, i + limit);
        const batchResults = await processBatch(batch);
        brondons.push(...batchResults);
    }

    return brondons;
}

export async function imAPIGet(endpointURL) {
    //const jwtoken = getCookie('jwtoken');
    const apiURL = `${baseURL}/${endpointURL}`;
    const apiResponse = await fetch(apiURL, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await apiResponse.json();
    //console.log("got data:");
    //console.log(data);
    return data;
}