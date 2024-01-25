import { canAccess } from "./access-check.js";
import { fetchSegmentPlayers } from "./segments.js";

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('update-area-btn').addEventListener('click', ()=>UpdatePlayersAcademicArea("test", "test"));
});

async function UpdatePlayersAcademicArea(selectedSegmentId, desiredAcademicArea)
{
    let hasAccess = await canAccess();
    if(!hasAccess){ console.log("no access"); return; }else{ console.log("can access"); }

    // get all plays in a segment
    let segmentPlayers = await fetchSegmentPlayers(selectedSegmentId);
    let playerProfiles = segmentPlayers.data.PlayerProfiles;
    console.log(playerProfiles);

    // iterate over them, update each players AcademicArea field to desiredAcademicArea
    /*for (const player of playerProfiles) {
        let playFabID = player.PlayFabID;
        let AcademicArea = desiredAcademicArea;
        let updateData = {
            AcademicArea
        };

        const url = '/update-user-data';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playFabID, updateData })
        });

        if (!response.ok) {
            console.log(response);
            throw new Error(`Failed to update player ${playFabID}: ${response}`);
        }

        // You can handle the response here if needed
        const responseData = await response.json();
        console.log(`Updated player ${playFabID}:`, responseData);
    }*/
    console.log('All players updated successfully');
    //return 'All players updated successfully';
}