document.addEventListener('DOMContentLoaded', async() => {

    const models = [
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/MusclesOfTheNeck_S1.glb",
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Muscles_of_mastication_I.glb"
    ];

    console.log(window.location.search);
    const params = Object.fromEntries(new URLSearchParams(window.location.search)); 
    
    const modelViewer = document.getElementById('model-viewer');
    modelViewer.src = models[params.model];
});
window.onload = function() {
    //document.getElementById('loginModal').style.display = 'block';
};