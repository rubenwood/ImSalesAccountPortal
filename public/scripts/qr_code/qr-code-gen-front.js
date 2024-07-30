import { getAreas, getTopics, getTopicBrondons, getActivities, getActivityBrondons, waitForJWT } from '../immersifyapi/immersify-api.js';
import { decodeQRCode, genQRCode, genTopicCollectionLink } from './qr-code-utils.js';
import { shortenUrl } from './deeplink-utils.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login } from '../PlayFabManager.js';
import { SearchableList } from '../classes/searchable-list.js';

let shortURLOutput;
let qrCode;

// TODO: cache these in local storage
let areas, topics, activities;
let allTopicBrondons, allActivityBrondons;

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    // login button on modal
    document.getElementById('loginButton').addEventListener('click', Login);
    //wait until jwt for api is defined
    await waitForJWT();
    // hide login modal
    document.getElementById('loginModal').style.display = 'none';

    [areas, topics, activities] = await Promise.all([ getAreas(), getTopics(), getActivities()]);
    console.log("got all areas:\n", areas, "\ntopics:\n" , topics, "\nactivities:\n", activities);
    [allTopicBrondons, allActivityBrondons] = await Promise.all([getTopicBrondons(topics), getActivityBrondons(activities)]);
    console.log("got topic brondons:\n", allTopicBrondons, "\ngot activity brondons\n", allActivityBrondons);
    doConfetti();

    // TODO: refactor duplicate code
    // Searchable list (for adding multiple topics)
    const listContainer = document.getElementById('listContainer');
    const searchInput = document.getElementById('searchInput');
    const selectedItemsContainer = document.getElementById('selectedItemsContainer');
    let topicsSelected = [];
    const onListUpdated = (selectedItems) => {
        topicsSelected = selectedItems;
    };
    new SearchableList(allTopicBrondons, listContainer, searchInput, selectedItemsContainer, 'brondon.externalTitle', onListUpdated);
    // topic collection to deeplink
    document.getElementById('gen-selected-topics-dl').addEventListener('click', async()=>{ 
        let topicCollectionLink = genTopicCollectionLink(topicsSelected);
        document.getElementById('selected-topics-dl-output').innerText = topicCollectionLink; 
        let topicCollectionQRCodeURL = await genQRCode(topicCollectionLink);
        document.getElementById('qr-code-topics').src = topicCollectionQRCodeURL;
        doConfetti();
     }); 


     // shorten URL
     document.getElementById('shorten-btn').addEventListener('click', async()=>{
        let urlToShorten = document.getElementById('shorten-url-input').value;
        let shortURL = shortenUrl(urlToShorten);
        document.getElementById('shorten-url-output').innerHTML = shortURL;
     });

});
window.onload = function(){
    document.getElementById('loginModal').style.display = 'block';
};
