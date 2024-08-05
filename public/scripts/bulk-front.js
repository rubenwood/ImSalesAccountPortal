import { getSegmentsClicked, getPlayersInSegmentClicked } from "./segments.js";
import { UpdatePlayerAcademicArea } from "./bulk.js";
import { Login } from './PlayFabManager.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('get-segments-btn').addEventListener('click', () => getSegmentsClicked(document.getElementById('segment-selection')));
    document.getElementById('get-players-btn').addEventListener('click', async () => {
        let playerProfiles = await getPlayersInSegmentClicked(document.getElementById('segment-selection').value);
        let playerIds = playerProfiles.map(player =>{
            return player.PlayerId;
        });
        console.log(playerIds);
        document.getElementById('player-list').value = playerIds.join('\n');
    });

    
    document.getElementById('update-area-btn').addEventListener('click', () => {
        const playerIdList = document.getElementById('player-list').value.split('\n').filter(Boolean);
        console.log( document.getElementById('player-list').value);
        console.log( document.getElementById('player-list').value.split('\n'));
        console.log(playerIdList);
        console.log("trying to update area");
        UpdatePlayerAcademicArea(playerIdList, document.getElementById('desired-area-txt').value)
    });
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

