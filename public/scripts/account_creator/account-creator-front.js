import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, RegisterUserEmailAddress, UpdateUserDataServer } from '../PlayFabManager.js';
import { generatePass, fetchS3JSONFile } from '../utils.js';
import { waitForJWT, imAPIGet } from '../immersifyapi/immersify-api.js';

//const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');

    document.getElementById('loginButton').addEventListener('click', Login);
    // Sign Up / Modify Form
    document.getElementById('signUpFormRadio').addEventListener('change', toggleForms);
    document.getElementById('modifyFormRadio').addEventListener('change', toggleForms);
    toggleForms(); // set initial state
    document.getElementById('registerButton').addEventListener('click', RegisterUserEmailAddress);
    document.getElementById('updateButton').addEventListener('click', UpdateUserDataServer);
    document.getElementById('generatePassword').addEventListener('click', generatePass);

    await waitForJWT();
    initAcademicAreaDD(document.getElementById('academicArea'));
    initAcademicAreaDD(document.getElementById('academicAreaUpdate'));
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

// Function to toggle between sign up and modify existing forms
function toggleForms() {
    const isSignUpSelected = document.getElementById('signUpFormRadio').checked;
    const signUpForm = document.getElementById('signup-container');
    const modifyForm = document.getElementById('modify-existing-container');

    if (isSignUpSelected) {
        signUpForm.style.display = 'flex';
        modifyForm.style.display = 'none';
    } else {
        signUpForm.style.display = 'none';
        modifyForm.style.display = 'flex';
    }
}

// POPULATE DROP DOWN (ACADEMIC AREA)
async function initAcademicAreaDD(selectElement) {
    try {
        const academicAreaCMS = await imAPIGet("areas");
        console.log(academicAreaCMS);

        //
        if (academicAreaCMS) {            
            academicAreaCMS.forEach(item => {
                if(item.slug == "nursing"){ return; } // TODO: change this (eventually)
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.slug;
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}
// POPULATE DROP DOWN (LANGUAGE OF STUDY)
async function initLangStudyDD(selectElement) {
    try {
        const languageResp = await fetchS3JSONFile("TestFiles/OtherData/LanguageStudyData.json");
        const languages = languageResp.languages;
        if (languages) {            
            languages.forEach(item => {
                const option = document.createElement('option');
                option.value = item.languageId;
                option.textContent = item.languageId;
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}
initLangStudyDD(document.getElementById('language'));
initLangStudyDD(document.getElementById('languageUpdate'));