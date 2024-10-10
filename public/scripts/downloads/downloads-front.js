document.addEventListener('DOMContentLoaded', async() => {    
    document.getElementById('loginButton').addEventListener('click', () => submitPass());
    document.getElementById('download-btn').addEventListener('click', () => download());
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

async function submitPass(){
    let inPass = document.getElementById('password').value;
    
    try{
        let response = await fetch('/downloads/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pass: inPass })
        });
        let result = await response.json();
        
        if(result != true){
            console.log("Access denied");
            document.getElementById('error-txt').innerHTML = 'Incorrect password. Please try again.';
            return;
        }
        
        document.getElementById('loginModal').style.display = 'none';
    }catch(err){
        console.error("Error during authentication", err);
        document.getElementById('error-loading').innerHTML = 'Oops! An error occurred. Please try again later.';
    }
}

function download(){
    const downloadLink = document.createElement('a');
    downloadLink.href = 'https://s3.eu-west-1.amazonaws.com/com.immersifyeducation.cms/Models/Debug/DanCringeSphere003.glb';
    downloadLink.click();
}