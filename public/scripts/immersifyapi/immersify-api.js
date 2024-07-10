
const baseURL = "https://immersify-api.herokuapp.com";
export let jwtoken;

export async function auth(playfabId, playfabSessionTicket){
    const authUrl = `${baseURL}/auth`;
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ playfabId, playfabSessionTicket })
    });
    const data = await authResponse.json();
    //console.log("auth resp:");
    //console.log(data);
    jwtoken = data.accessToken;
    return data;
}

export async function getAreas(){
    const areasUrl = `${baseURL}/areas`;
    const areasResponse = await fetch(areasUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await areasResponse.json();
    //console.log("areas:");
    //console.log(data);
    return data;
}

export async function getTopics(){
    const topicsUrl = `${baseURL}/topics`;
    const topicsResponse = await fetch(topicsUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await topicsResponse.json();
    //console.log("topics:");
    //console.log(data);
    return data;
}

export async function getActivities(){
    const activitiesUrl = `${baseURL}/activities`;
    const activitiesResponse = await fetch(activitiesUrl, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await activitiesResponse.json();
    //console.log("activities:");
    //console.log(data);
    return data;
}

export async function imAPIGet(endpointURL){
    const apiURL = `${baseURL}/${endpointURL}`;
    const apiResponse = await fetch(apiURL, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${jwtoken}`,
            'Content-Type': 'application/json' 
        }
    });
    const data = await apiResponse.json();
    console.log("got data:");
    console.log(data);
    return data;
}