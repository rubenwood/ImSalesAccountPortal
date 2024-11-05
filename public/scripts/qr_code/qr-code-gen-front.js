import { getAreas, getModules, getTopics, getTopicBrondons, getActivities, getActivityBrondons, imAPIGet, waitForJWT } from '../immersifyapi/immersify-api.js';
import { decodeQRCode, genQRCode, genTopicCollectionLink } from './qr-code-utils.js';
import { shortenUrl } from './deeplink-utils.js';
import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login } from '../PlayFabManager.js';
import { SearchableList } from '../classes/searchable-list.js';

let shortURLOutput;
let qrCode;

// TODO: cache these in local storage
let areas, modules, topics, activities;
let allTopicBrondons, allActivityBrondons;

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');
    // login button on modal
    document.getElementById('loginButton').addEventListener('click', Login);
    // wait until jwt for api is defined
    await waitForJWT();
    // hide login modal
    document.getElementById('loginModal').style.display = 'none';

    [areas, modules, topics, activities] = await Promise.all([getAreas(), getModules(), getTopics(), getActivities()]);
    console.log("got all areas:\n", areas, "\nmodules:\n", modules, "\ntopics:\n" , topics, "\nactivities:\n", activities);
    //[allTopicBrondons, allActivityBrondons] = await Promise.all([getTopicBrondons(topics), getActivityBrondons(activities)]);
    //console.log("got topic brondons:\n", allTopicBrondons, "\ngot activity brondons:\n", allActivityBrondons);
    doConfetti();

    // TODO: refactor duplicate code
    // Searchable list (for adding multiple topics)
    /*const listContainer = document.getElementById('listContainer');
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
     });*/

     // shorten URL
     document.getElementById('shorten-btn').addEventListener('click', async()=>{
        let urlToShorten = document.getElementById('shorten-url-input').value;
        let shortURL = shortenUrl(urlToShorten);
        document.getElementById('shorten-url-output').innerHTML = shortURL;
     });

    // generate qr code page html
    document.getElementById('gen-qr-page-html-btn').addEventListener('click', async()=> {
        const qrCodeHTML = await generateQRCodePageHTML();
        document.getElementById('qr-code-page-html-output').value = qrCodeHTML;
    });

});
window.onload = function(){
    document.getElementById('loginModal').style.display = 'block';
};

async function generateQRCodePageHTML(){

    const areasWithModuleTopics = await imAPIGet("areas/withModuleTopic/production/public");
    console.log("AMT:\n",areasWithModuleTopics);

    console.log("Generating QR Code Page HTML");

    let output = `<section id="qr-code-section" class="qr_code_sec">`;
    output += makePreambleHTML();

    //TODO: improve this
    for(const module of areasWithModuleTopics.allAreas[0].modules){
        const moduleButtonHTML = makeModuleButton(module.brondons[0]);
        output += moduleButtonHTML;
        // after each module button, add the topic panels
        // get modules with topic structure
        output += makeTopicPanel(module.topics);
    }

    output += `</section>`;

    output += makeEndHTML();

    console.log(output);
    return output;
}

function makePreambleHTML(){
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
        <link rel="stylesheet" type="text/css" href="../theme_style.css">  
    </head>
    <body>
    <div class="form-container">`;
}

function makeModuleButton(moduleBrondon){
    console.log(moduleBrondon);
    if(moduleBrondon == undefined){ return ''; }
    if(moduleBrondon.iconPath == undefined){ return ''; }
    if(moduleBrondon.externalTitle == undefined){ return ''; }
    if(moduleBrondon.isTest == "true" || 
        moduleBrondon.comingSoon || 
        moduleBrondon.status != "production"){ return ''; }

    const moduleButtonHTML = `
        <button class="accordion">
            <img src="https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Icon/${moduleBrondon.iconPath.replace("Icon/", "")}">${moduleBrondon.externalTitle}
        </button>`;
    return moduleButtonHTML;
}

function makeTopicPanel(topics){
    let topicPanelHTML = '';
    topicPanelHTML += `<div class="panel">`;

    for(const topic of topics){
        topicPanelHTML += makeTopicRow(topic.brondons[0]);
    }

    topicPanelHTML += `</div>`;
    return topicPanelHTML;
}
function makeTopicRow(topicBrondon){
    console.log(topicBrondon);
    if(topicBrondon == undefined){ return ''; }
    if(topicBrondon.iconPath == undefined){ return ''; }
    if(topicBrondon.externalTitle == undefined){ return ''; }
    if(topicBrondon.isTest == "true" || 
        topicBrondon.comingSoon || 
        topicBrondon.status != "production"){ return ''; }

    const topicRowHTML = `    
        <div class=" row_wrap">
            <div class="topic_img">
                <img src="https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Icon/${topicBrondon.iconPath.replace("Icon/", "")}" >
                <h3>${topicBrondon.externalTitle}</h3>
            </div>
            <div class="qr_img">
                <img src="https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/${topicBrondon.qrCode}" alt="QR Code" >
            </div>
        </div>`;
    return topicRowHTML;
}

function makeEndHTML(){
    return `</div>
<script>
    var acc = document.getElementsByClassName("accordion");
    var i;

    for (i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var panel = this.nextElementSibling;
            if (panel.style.display === "block") {
                panel.style.display = "none";
            } else {
                panel.style.display = "block";
            }
        });
    }
</script>
</body>
</html>`
}


/* add this per module
// insert this:
<button class="accordion">
    <img src="https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Icon/ModuleIcon_HeadNeckAnatomy.png"> 
    Head & Neck Anatomy 
</button>

<div class="panel">
    // then in here, insert this:
    <div class=" row_wrap">
        <div class="topic_img">
            <img src="https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Icon/Topic_Nerves.png" >
            <h3>Cranial Nerves</h3>
        </div>
        <div class="qr_img">
            <img src="https://s3.eu-west-2.amazonaws.com/com.rubenwood.unityaatesting/QRCodes/new/Topic_Cranialnerves.jpg" alt="QR Code" >
        </div>
    </div>
</div>
*/
