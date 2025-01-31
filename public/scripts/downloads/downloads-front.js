import { RegisterUserEmailAddressGeneric, LoginGeneric, UpdateUserDataGeneric, ResetPassword, UpdateContactEmail } from "../PlayFabManager.js";
import { getSuffixList, isUserOnSuffixList } from "../suffix-front.js";
import { getUserData, getPlayerProfile, isEmailVerified, SendVerificationEmail } from "../PlayFabManager.js";

let suffixFile;
document.addEventListener('DOMContentLoaded', async() => {    
    // get suffix list too
    suffixFile = await getSuffixList();
    console.log(suffixFile.suffixList);

    // pword field
    document.getElementById('loginButton').addEventListener('click', () => submitPass());
    // form
    document.getElementById('signup-btn').addEventListener('click', () => signUpBtnClicked());
    document.getElementById('login-btn').addEventListener('click', () => loginBtnClicked());
    // download
    document.getElementById('windows-download-btn').addEventListener('click', () => download("windows"));
    document.getElementById('mac-download-btn').addEventListener('click', () => download("mac"));
    document.getElementById('forgot-password').addEventListener('click', () => resetPasswordClicked());
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
    hideVerification();
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
function showDownload(){
    document.getElementById('download-container').style.display = 'block';
    hideVerification();
}
function showVerification(playFabId, emailAddr){    
    SendVerificationEmail(playFabId, emailAddr);
    document.getElementById('verification-btn').addEventListener('click', () => SendVerificationEmail(playFabId, emailAddr));
    document.getElementById('email-addr-h').innerHTML = emailAddr;
    document.getElementById('verification-container').style.display = 'block';    
}
function hideVerification(){
     document.getElementById('verification-container').style.display = 'none';
}

let ticket;
let suffixEntry;

// SIGN UP
async function signUpBtnClicked(){
    hideErrorMessages();
    
    const email = document.getElementById('signup-email').value;
    const displayName = document.getElementById('signup-display-name').value;
    const password = document.getElementById('signup-password').value;

    suffixEntry = isUserOnSuffixList(suffixFile.suffixList, email.split('@')[1])
    if(suffixEntry == false){
        console.log("not on list");
        document.getElementById('signup-err-msg').style.display = 'block';
        document.getElementById('signup-err-msg').innerHTML = 'Your institution hasn\'t been granted access';
        return;
    }else{
        console.log(suffixEntry);
    }

    await RegisterUserEmailAddressGeneric(email,password,displayName,registerCallback);
}
async function registerCallback(response, error){
    if(error){ 
        console.log(error); 
        document.getElementById('signup-err-msg').style.display = 'block';
        document.getElementById('signup-err-msg').innerHTML = error.errorMessage;
        return; 
    }
    ticket = response.data.SessionTicket;

    console.log(response.data);
    const updateContactEmailResp = await UpdateContactEmail(document.getElementById('signup-email').value);
    console.log(updateContactEmailResp);

    // TODO: EMAIL VERIFICATION
    const playerProf = await getPlayerProfile(response.data.PlayFabId);
    //console.log(playerProf);
    const isVerified = await isEmailVerified(playerProf.ContactEmailAddresses);
    //console.log(isVerified);
    if(!isVerified){
        // show verification screen (and send email)
        //console.log(playerProf.ContactEmailAddresses[0]);
        showVerification(response.data.PlayFabId, playerProf.ContactEmailAddresses[0].EmailAddress);
        return;
    }

    let AcademicArea = ""; 
    if(suffixEntry.suffixArea != ''){
        // set the users are to the area specified in the list
        AcademicArea = suffixEntry.suffixArea;
        //AcademicArea = "838134a6-1399-4ede-a54c-569c308ebd09";
    }

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

    console.log(email.split('@')[1]);
    suffixEntry = isUserOnSuffixList(suffixFile.suffixList, email.split('@')[1])
    console.log(suffixEntry);
    if(suffixEntry == false){
        console.log("not on list");
        document.getElementById('login-err-msg').style.display = 'block';
        document.getElementById('login-err-msg').innerHTML = 'Your institution hasn\'t been granted access';
        return;
    }else{
        //console.log(suffixEntry);
    }

    LoginGeneric(email, password, loginCallback);
}
async function loginCallback(response, error){
    if(error){ 
        console.log("ERROR"); console.log(error);
        document.getElementById('login-err-msg').style.display = 'block';
        document.getElementById('login-err-msg').innerHTML = error.errorMessage;
        return;
    }
    ticket = response.data.SessionTicket;
    //console.log(response.data);

    // TODO: EMAIL VERIFICATION
    const playerProf = await getPlayerProfile(response.data.PlayFabId);
    console.log(playerProf);
    const isVerified = await isEmailVerified(playerProf.ContactEmailAddresses);
    console.log(isVerified);
    if(!isVerified){
        // show verification screen (and send email)
        showVerification(response.data.PlayFabId, playerProf.ContactEmailAddresses[0].EmailAddress);
        return;
    }

    const userAcademicArea = await getUserData(["AcademicArea"]);
    console.log(userAcademicArea.AcademicArea);

    // set this to the users current academic area if they have one
    let AcademicArea = userAcademicArea.AcademicArea;
    if(suffixEntry.suffixArea != undefined && suffixEntry.suffixArea !== ''){
        AcademicArea = suffixEntry.suffixArea;
    }
    
    const data = {
        AcademicArea
    };
    UpdateUserDataGeneric(data,updatedUserDataCallback);
}

// RESET PASSWORD
async function resetPasswordClicked(){
    let email = document.getElementById('fp-email').value; // email address input field here
    ResetPassword(email, resetPasswordCallback);
}
function resetPasswordCallback(response, error){
    console.log("password reset email sent");

    if(error){ 
        console.log(error);
        document.getElementById('fp-error-txt').innerHTML = error.errorMessage;
        return;
    }
    // if no error display confirmation here
    //console.log(response);
    document.getElementById('fp-error-txt').innerHTML = 'Password reset email sent!';
}

// UPDATE USER DATA
function updatedUserDataCallback(){
    hideLoginSignup();
    //showPasswordForm();
    showDownload();
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

//Forgot password
const modal = document.getElementById("forgotpwd");

document.getElementById('close_btn').addEventListener('click', function(e) {
    modal.style.display = 'none';
  });
document.getElementById('f-p').addEventListener('click', function(e) {
    modal.style.display = 'block';
  });

  window.onclick = function(event) {
    if (event.target === modal) {
        modal.style.display = "none";
    }
}
// DOWNLOAD
async function download(platform){
    const resp = await fetch('/S3/s3GetDownloadURLs', {
        method: 'GET',
        headers: {
            'ticket': `${ticket}`
        }
    });
    const respURLs = await resp.json();

    const downloadLink = document.createElement('a');
    if(platform === 'mac'){
        downloadLink.href = respURLs.macURLs[0].url;
    }else{
        downloadLink.href = respURLs.windowsURLs[0].url;
    }    
    downloadLink.click();
}