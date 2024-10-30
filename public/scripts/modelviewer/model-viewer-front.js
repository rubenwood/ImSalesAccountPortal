document.addEventListener('DOMContentLoaded', async() => {

    console.log(window.location.search);
    const params = Object.fromEntries(new URLSearchParams(window.location.search));     
    const modelViewer = document.getElementById('model-viewer');
    let modelName = params.model;
    modelViewer.src = `https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/${modelName}`;
});
window.onload = function() {
    //document.getElementById('loginModal').style.display = 'block';
};

async function getPresignedAssetURLs(){

}