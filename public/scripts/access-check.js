let accessLevel; // cached

export function setAccessLevel(inAccLevel){
    accessLevel = inAccLevel;
}
export function getAccessLevel(){ return accessLevel; }

export async function fetchUserAccess() {
    if(accessLevel == undefined){ return; }
    let userAccess = accessLevel.AccessLevel;

    const url = `/check-access`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAccess }) 
    });

    if (!response.ok) {
        throw new Error('Access check failed');
    }

    return await response.json();
}

export async function canAccess(){
    let accessCheckResponse = await fetchUserAccess();
    if(accessCheckResponse == undefined){ return false; }
    if (!accessCheckResponse.isAuthorized) { return false; } else { return true; }
}