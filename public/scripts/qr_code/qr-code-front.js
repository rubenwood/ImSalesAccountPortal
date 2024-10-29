import { getModules, getTopicBrondons } from "../immersifyapi/immersify-api.js";

document.addEventListener('DOMContentLoaded', async () => {  
    const qrCodeSection = document.getElementById('qr-code-section');

    qrCodeSection.appendChild();
});

function makeModuleButtons(){
    let moduleExternalTitle;
    let moduleIconPath;

    const moduleButtonHTML = `
        <button class="accordion">
            <img src="${moduleIconPath}"> 
            ${moduleExternalTitle}
        </button>`;    
}

function makeTopicPanel(){
    let topicPanelHTML = '';
    topicPanelHTML += `<div class="panel">`;

    // for each topic:
    let topicExternalTitle;
    let topicIconPath;
    let topicQRCode;
    topicPanelHTML = `    
        <div class=" row_wrap">
            <div class="topic_img">
                <img src="${topicIconPath}" >
                <h3>${topicExternalTitle}</h3>
            </div>
            <div class="qr_img">
                <img src="${topicQRCode}" alt="QR Code" >
            </div>
        </div>`;
    //
    topicPanelHTML += `</div>`;
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