document.addEventListener('DOMContentLoaded', async() => {

    const models = [
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/MusclesOfTheNeck_SH01.glb",
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/Muscles_of_mastication_I.glb",
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/Anatomy_CrossSection2_NoLabels.glb",

        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/Extracranial.glb",
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/Trigeminal_Nerve_Functions2_NoLabels.glb",
        "https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/The_Optic_Nerve2.glb"
    ];

    console.log(window.location.search);
    const params = Object.fromEntries(new URLSearchParams(window.location.search)); 
    
    const modelViewer = document.getElementById('model-viewer');

    //let index = 0;
    //index = params.model;

    let modelName = params.model;

    //if(params.model >= models.length){ index = models.length; }
    //if(params.model < 0){ index = 0; }

    //modelViewer.src = models[index];
    modelViewer.src = `https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/public/${modelName}`;
});
window.onload = function() {
    //document.getElementById('loginModal').style.display = 'block';
};

async function getPresignedAssetURLs(){

}