//import { getPlayerEmailAddr } from './PlayFabManager.js';
import { canAccess } from './access-check.js';
export let playerProfiles;

export function fetchSegments(){
    const url = `/get-segments`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
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

export function fetchSegmentPlayers(reqSegmentID, batchSize){
    const url = `/get-segment-players/${reqSegmentID}`;
    let segmentID = reqSegmentID;
    let maxBatchSize = batchSize == undefined ? 10000 : batchSize;
    console.log(maxBatchSize);

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segmentID, maxBatchSize})
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                console.log(err);
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}

// SEGMENT RELATED FRONT END
export async function getSegmentsClicked(segmentDropdown){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }
    
    let segmentResponse = await fetchSegments();
    let segments = segmentResponse.data.Segments;
    populateSegmentsDropdown(segments, segmentDropdown);
}
export function populateSegmentsDropdown(segments, segmentDropdown) {
    segmentDropdown.innerHTML = '';

    segments.forEach(segment => {
        // filter our certain segments?
        const option = document.createElement("option");
        option.value = segment.Id;
        option.textContent = segment.Name;
        segmentDropdown.appendChild(option);
    });    
}

export async function getPlayersInSegmentClicked(segmentID){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    // Get the selected segment ID from the dropdown
    const selectedSegmentId = segmentID;
    if (!selectedSegmentId) {
        console.log("No segment selected");
        return;
    }

    let data = await fetchSegmentPlayers(selectedSegmentId);
    playerProfiles = data.data.PlayerProfiles;
    return playerProfiles;
}

export async function getPlayerCountInSegment(segmentID){
    //let hasAccess = await canAccess();
    //if(!hasAccess){ return; }

    // Get the selected segment ID from the dropdown
    const selectedSegmentId = segmentID;
    if (!selectedSegmentId) {
        console.log("No segment selected");
        return;
    }

    let data = await fetchSegmentPlayers(selectedSegmentId, 0);
    playerProfiles = data.data;
    return playerProfiles;
}

// GET PLAYERS BY SUFFIX
export async function fetchPlayersBySuffix(suffix){
    const url = `/reporting/gen-suffix-rep/${suffix}`;

    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                console.log(err);
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}