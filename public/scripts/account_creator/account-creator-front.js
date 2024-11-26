import { initializeDarkMode } from '../themes/dark-mode.js';
import { Login, RegisterUserEmailAddress, RegisterUserEmailAddressGeneric, UpdateUserDataServer, getDefaultGoldUserData } from '../PlayFabManager.js';
import { generatePass, fetchS3JSONFile } from '../utils.js';
import { waitForJWT, imAPIGet } from '../immersifyapi/immersify-api.js';
import { delay } from '../asyncTools.js';

const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin: { y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async () => {
    // setup dark mode toggle
    initializeDarkMode('darkModeSwitch');

    document.getElementById('loginButton').addEventListener('click', Login);
    // Sign Up / Modify Form
    document.getElementById('signUpFormRadio').addEventListener('change', toggleForms);
    document.getElementById('signUpBulkFormRadio').addEventListener('change', toggleForms);
    document.getElementById('modifyFormRadio').addEventListener('change', toggleForms);
    toggleForms(); // set initial state
    document.getElementById('registerButton').addEventListener('click', RegisterUserEmailAddress);
    document.getElementById('registerButtonBulk').addEventListener('click', RegisterBulk);
    document.getElementById('addAccRow').addEventListener('click', addAccountRow);
    document.getElementById('updateButton').addEventListener('click', UpdateSingle);
    document.getElementById('generatePassword').addEventListener('click', ()=> generatePass(document.getElementById("emailSignUpPassword")));
    document.getElementById('generatePasswordBulk').addEventListener('click', ()=> generatePass(document.getElementById("emailSignUpPasswordBulk")));

    await waitForJWT();
    initAcademicAreaDD(document.getElementById('academicArea'));
    initAcademicAreaDD(document.getElementById('academicAreaBulk'));
    initAcademicAreaDD(document.getElementById('academicAreaUpdate'));
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

// Function to toggle between sign up and modify existing forms
function toggleForms() {
    const isSignUpSelected = document.getElementById('signUpFormRadio').checked;
    const isSignUpBulkSelected = document.getElementById('signUpBulkFormRadio').checked;
    const modifyExistingSelected = document.getElementById('modifyFormRadio').checked;
    const signUpForm = document.getElementById('signup-container');
    const signUpBulkForm = document.getElementById('signup-bulk-container');
    const modifyForm = document.getElementById('modify-existing-container');

    if(isSignUpSelected){
        signUpForm.style.display = 'flex';
        signUpBulkForm.style.display = 'none';
        modifyForm.style.display = 'none';
    }else if(isSignUpBulkSelected){
        signUpForm.style.display = 'none';
        signUpBulkForm.style.display = 'flex';
        modifyForm.style.display = 'none';
    }else if(modifyExistingSelected){
        signUpForm.style.display = 'none';
        signUpBulkForm.style.display = 'none';
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
                //if(item.slug != "dentistry"){ return; } // TODO: change this (eventually)
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
initLangStudyDD(document.getElementById('languageBulk'));
initLangStudyDD(document.getElementById('languageUpdate'));

// Update
function UpdateSingle(){
    const email = document.getElementById("emailAddressUpdate").value
    const AcademicArea = document.getElementById("academicAreaUpdate").value;
    const LanguageOfStudyInput = document.getElementById("languageUpdate").value;
    const TestAccountExpiryDate = document.getElementById("expiryUpdate").value;
    const UpdatedBy = document.getElementById("updatedBy").value;
    const CreatedUpdatedReason = document.getElementById("updatedReason").value;
    UpdateUserDataServer(email, '[user defined]', AcademicArea, LanguageOfStudyInput, TestAccountExpiryDate, UpdatedBy, CreatedUpdatedReason)
}

function addAccountRow() {
    let accountTable = document.getElementById('accTable');
    let newRow = accountTable.insertRow();

    let emailCell = newRow.insertCell();
    emailCell.innerHTML = `<input type="text" class="emailAddrBulk" value="example@test.com">`;

    let displayNameCell = newRow.insertCell();
    displayNameCell.innerHTML = `<input type="text" class="displayNameBulk" value="">`;

    let removeRowCell = newRow.insertCell();
    let removeButton = document.createElement('input');
    removeButton.type = 'button';
    removeButton.value = '-';
    removeButton.addEventListener('click', function () {
        accountTable.deleteRow(newRow.rowIndex);
    });

    removeRowCell.appendChild(removeButton);
}

async function RegisterBulk() {
    let accountTable = document.getElementById('accTable');
    let rows = accountTable.rows;
    const pass = document.getElementById('emailSignUpPasswordBulk').value;

    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];

        const email = row.querySelector('.emailAddrBulk')?.value;
        const displayName = row.querySelector('.displayNameBulk')?.value;
        const AcademicArea = document.getElementById("academicAreaBulk").value;
        const LanguageOfStudyInput = document.getElementById("languageBulk").value;
        const TestAccountExpiryDate = document.getElementById("expiryBulk").value;
        const CreatedBy = document.getElementById("createdByBulk").value;
        const CreatedUpdatedReason = document.getElementById("createdReasonBulk").value;

        if (email && displayName) {
            try {
                await RegisterUserEmailAddressGeneric(email, pass, displayName, regCallback);
                console.log(`Registered: ${email}, ${displayName}`);
                // update this user account (sets gold, verify override, etc... updates confluence page)
                await delay(1000);
                await UpdateUserDataServer(email, pass, AcademicArea, LanguageOfStudyInput, TestAccountExpiryDate, CreatedBy, CreatedUpdatedReason);
            } catch (error) {
                console.error(`Failed to register: ${email}, ${displayName}`, error);
            }
        }
    }

    doConfetti();
}
async function regCallback(response, error) {
    if (error !== null){
        document.getElementById("registerButtonBulk").value  = "Register";
        let errorOutput = `Something went wrong:\n${PlayFab.GenerateErrorReport(error)}`;
        alert(errorOutput);
        document.getElementById("resultOutputBulk").innerHTML = errorOutput;
        return;
    }

    console.log(response);

    document.getElementById("resultOutputBulk").innerHTML = "Account created!";
}