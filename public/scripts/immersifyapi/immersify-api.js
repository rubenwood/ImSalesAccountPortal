const baseURL = "https://immersify-api.herokuapp.com";

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
    document.cookie = `jwtoken=${data.accessToken};path=/;Secure;SameSite=Strict`;
    return data;
}
export function waitForJWT() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const jwt = getCookie('jwtoken');
            if (jwt) {
                clearInterval(interval);
                resolve(jwt);
            }
        }, 100); // every 100ms
    });
}
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export async function getAreas() {
    const jwtoken = getCookie('jwtoken');
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
    const jwtoken = getCookie('jwtoken');
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
    let brondons = [];
    for(const topic of topics){
        const imResp = await imAPIGet(`topics/${topic.id}`);
        brondons.push({topicId:topic.id, brondon:imResp.brondons[0]});
    }
    return brondons;
}

export async function getActivities() {
    const jwtoken = getCookie('jwtoken');
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
export async function getActivityBrondons(activities){
    let brondons = [];
    for(const activity of activities){
        const imResp = await imAPIGet(`activities/${activity.id}`);
        //console.log(imResp);
        // type is: imResp.data.type
        brondons.push({activityId:activity.id, brondon:imResp.data.brondons[0]});
    }
    return brondons;
}

export async function imAPIGet(endpointURL) {
    const jwtoken = getCookie('jwtoken');
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