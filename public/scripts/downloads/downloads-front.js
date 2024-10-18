import { RegisterUserEmailAddressGeneric, LoginGeneric, UpdateUserDataGeneric, ResetPassword } from "../PlayFabManager.js";

document.addEventListener('DOMContentLoaded', async() => {    
    // pword field
    document.getElementById('loginButton').addEventListener('click', () => submitPass());
    // form
    // document.getElementById('existing-btn-yes').addEventListener('click', () => showLoginForm());
    // document.getElementById('existing-btn-no').addEventListener('click', () => showSignUpForm());
    document.getElementById('signup-btn').addEventListener('click', () => signUpBtnClicked());
    document.getElementById('login-btn').addEventListener('click', () => loginBtnClicked());
    // download
    document.getElementById('download-btn').addEventListener('click', () => download());
});
window.onload = function() {
    displayForms();
    document.getElementById('download-container').style.display = 'none';
    // document.getElementById('pwordModal').style.display = 'none';
};


var cdButtons = [].slice.call(document.getElementsByClassName("cd-button"));
if (cdButtons.length > 0) {

		cdButtons.forEach(function (button){
		  button.addEventListener("click", function(e){

		  e.preventDefault();
			button.disabled = true;
      var bspinner = document.getElementById(button.id + "-spinner");
      bspinner.classList.add("spinner");
      
      setTimeout(function () {
      	bspinner.classList.remove("spinner");
        button.disabled = false;
    	}, 4000);
   
		  },false);

		});
}


//#region HIDE / SHOW FORMS
function displayForms(){
    document.getElementById('signup-form').style.display = 'block';
    document.getElementById('login-form').style.display = 'block';
}
function hideForms(){
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('signup-err-msg').style.display = 'none';
    document.getElementById('login-err-msg').style.display = 'none';
    
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
}
function showSignUpForm(){
    // hideForms();
    displayForms();
    document.getElementById('signup-form').style.display = 'block';
}
function showLoginForm(){
    // hideForms();
    displayForms();
    document.getElementById('login-form').style.display = 'block';

}
function hideLoginSignup(){
    document.getElementById('login-signup-forms').style.display = 'none';
    document.getElementById('login-txt').style.display = 'none';
}
function showPasswordForm(){
    document.getElementById('password-txt').style.display = 'block';
    document.getElementById('password-form').style.display = 'block';
}
function hidePasswordForm(){
    document.getElementById('password-txt').style.display = 'none';
    document.getElementById('password-form').style.display = 'none';
}
function hideErrorMessages(){
    document.getElementById('login-err-msg').style.display = 'none';
    document.getElementById('signup-err-msg').style.display = 'none';
}
//#endregion

let ticket;

// SIGN UP
async function signUpBtnClicked(){
    hideErrorMessages();
    
    const email = document.getElementById('signup-email').value;
    const displayName = document.getElementById('signup-display-name').value;
    const password = document.getElementById('signup-password').value;
    await RegisterUserEmailAddressGeneric(email,password,displayName,registerCallback);
}
function registerCallback(response, error){
    if(error){ 
        console.log(error); 
        document.getElementById('signup-err-msg').style.display = 'block';
        document.getElementById('signup-err-msg').innerHTML = error.errorMessage;
        return; 
    }
    ticket = response.data.SessionTicket;

    let AcademicArea = "838134a6-1399-4ede-a54c-569c308ebd09";
    let LastWriteDevice = "";
    const UserProfileDataJSON = {
        selectedAvatarId: "",
        selectedSkinToneId: "",
        selectedHairColourId: "",
        languageOfStudy: "Eng-Uk",
        selectedYearId: 0,
        selectedAbilityId: "",
        activityTypePreference: []
    }
    const userProfileDataStr = JSON.stringify(UserProfileDataJSON);

    const data = {
        AcademicArea,
        LastWriteDevice,
        UserProfileData:userProfileDataStr
    };
    UpdateUserDataGeneric(data,updatedUserDataCallback);
}

// LOGIN
async function loginBtnClicked(){
    hideErrorMessages();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    LoginGeneric(email, password, loginCallback);
}
function loginCallback(response, error){
    if(error){ 
        console.log("ERROR"); console.log(error);
        document.getElementById('login-err-msg').style.display = 'block';
        document.getElementById('login-err-msg').innerHTML = error.errorMessage;
        return;
    }
    ticket = response.data.SessionTicket;
    
    let AcademicArea = "838134a6-1399-4ede-a54c-569c308ebd09";
    const data = {
        AcademicArea
    };
    UpdateUserDataGeneric(data,updatedUserDataCallback);
}

// RESET PASSWORD
async function resetPasswordClicked(){
    let email = '';
    ResetPassword(email, resetPasswordCallback);
}
function resetPasswordCallback(){
    console.log("password reset email sent");
}

// UPDATE USER DATA
function updatedUserDataCallback(){
    hideLoginSignup();
    showPasswordForm();
}

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
        
        document.getElementById('download-container').style.display = 'block';
        document.getElementById('success-txt').style.display = 'block';
        hidePasswordForm();
    }catch(err){
        console.error("Error during authentication", err);
        document.getElementById('error-loading').innerHTML = 'Oops! An error occurred. Please try again later.';
    }
}

// DOWNLOAD
async function download(){
    const resp = await fetch('/S3/s3GetDownloadURLs', {
        method: 'GET',
        headers: {
            'ticket': `${ticket}`
        }
    });
    const respURLs = await resp.json();

    const downloadLink = document.createElement('a');
    //TODO: download link
    downloadLink.href = respURLs[0].url;
    downloadLink.click();
}