import { getPlayerEmailAddr } from './PlayFabManager.js';
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

export function fetchSegmentPlayers(reqSegmentID){
    const url = `/get-segment-players/${reqSegmentID}`;
    let segmentID = reqSegmentID;
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segmentID })
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


// SEGMENT RELATED FRONT END
export async function getSegmentsClicked(segmentDropdown){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }
    
    let segmentResponse = await fetchSegments();
    let segments = segmentResponse.data.Segments;
    populateSegmentsDropdown(segments, segmentDropdown); // change this
}
export function populateSegmentsDropdown(segments, segmentDropdown) {
    segmentDropdown.innerHTML = '';

    segments.forEach(segment => {
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
    //  // Use map to transform each profile into a promise of email address
    //  const emailPromises = playerProfiles.map(profile => getPlayerEmailAddr(profile.PlayerId));

    //  // Wait for all promises to resolve
    //  const emailList = await Promise.all(emailPromises);
    //  //console.log(emailList);
    //  const emailListString = emailList.join('\n');
    // // Set the email list string as the value of the textarea
    // return emailListString;
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

    let data = await fetchSegmentPlayers(selectedSegmentId);
    playerProfiles = data.data;
    return playerProfiles;
}