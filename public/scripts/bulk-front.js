import { getSegmentsClicked, getPlayersInSegmentClicked } from "./segments.js";
import { UpdateUserAcademicAreaByEmail } from "./bulk.js";
import { Login } from './PlayFabManager.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginButton').addEventListener('click', Login);
    document.getElementById('get-segments-btn').addEventListener('click', () => getSegmentsClicked(document.getElementById('segment-selection')));
    document.getElementById('get-players-btn').addEventListener('click', async () => {
        let playerEmailList = await getPlayersInSegmentClicked(document.getElementById('segment-selection').value);
        document.getElementById('player-list').value = playerEmailList;
    });
    document.getElementById('update-area-btn').addEventListener('click', () =>
        UpdateUserAcademicAreaByEmail(document.getElementById('player-list').value, document.getElementById('desired-area-txt').value)
    );
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

