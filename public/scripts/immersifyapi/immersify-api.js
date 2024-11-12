const baseURL = "https://immersify-api.herokuapp.com";

export let jwtoken;

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
            if (jwtoken) {
                clearInterval(interval);
                resolve(jwtoken);
            }
        }, 100); // every 100ms
    });
}

export async function getAreas() {
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
export async function getAreaBrondons(areas){
    const brondonPromises = areas.map(async (area) => {
        const imResp = await imAPIGet(`areas/${area.id}`);
        return { areaId: area.id, brondon: imResp.brondons[0] };
    });

    const brondons = await Promise.all(brondonPromises);
    return brondons;
}

export async function getModules() {
    const modulesUrl = `${baseURL}/modules`;
    const modulesResponse = await fetch(modulesUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await modulesResponse.json();
    return data;
}

export async function getTopics() {
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
export async function getTopicBrondons(topics, limit = 10){
    const brondons = [];
    
    const processBatch = async (batch) => {
        const brondonPromises = batch.map(async (topic) => {
            const imResp = await imAPIGet(`topics/${topic.id}`);
            if(imResp.error == undefined){
                return { topicId: topic.id, brondon: imResp.brondons[0] };
            }
        });
        return await Promise.all(brondonPromises);
    };

    for (let i = 0; i < topics.length; i += limit) {
        const batch = topics.slice(i, i + limit);
        const batchResults = await processBatch(batch);
        brondons.push(...batchResults);
    }

    return brondons;
}

export async function getActivities() {
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

export async function getTreeStructure() {
    const modulesUrl = `${baseURL}/brondon/allActivitiesWithStructureTree`;
    const modulesResponse = await fetch(modulesUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await modulesResponse.json();
    return data;
}

export async function getAreasWithModulesAndTopicsByStatus(status, publicView){
    const url = `${baseURL}/areas/withModuleTopic/${status}/${publicView}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await response.json();
    return data;
}
export async function getAreasWithStructures(status, publicView){
    const url = `${baseURL}/areas/withStructures/${status}/${publicView}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await response.json();
    return data;
}


export async function imAPIGet(endpointURL) {
    const apiURL = `${baseURL}/${endpointURL}`;
    const apiResponse = await fetch(apiURL, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await apiResponse.json();
    return data;
}
export async function imAPIPost(endpointURL, body) {
    console.log(JSON.stringify(body));
    const apiURL = `${baseURL}/${endpointURL}`;
    const apiResponse = await fetch(apiURL, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(body)
    });
    const data = await apiResponse.text();
    return data;
}
export async function imAPIPut(endpointURL, body) {
    console.log(JSON.stringify(body));
    const apiURL = `${baseURL}/${endpointURL}`;
    const apiResponse = await fetch(apiURL, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(body)
    });
    const data = await apiResponse.text();
    return data;
}

export async function imAPIClearCache() {
    console.log("clearing cache");
    const apiURL = `${baseURL}/clear/cache`;
    const apiResponse = await fetch(apiURL, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await apiResponse.json();
    console.log(data);
    return data;
}