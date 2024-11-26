import {callUpdateConfluencePage} from "./confluence.js";
import {fetchUserAccInfoById, fetchUserAccInfoByEmail, fetchUserProfileById, formatDate} from "./utils.js"
import {setAccessLevel, canAccess} from "./access-check.js"
import {auth} from "./immersifyapi/immersify-api.js";
import {waitUntil} from "./asyncTools.js";
import { handleThemeChange } from './themes/dark-mode.js';

const titleId = "29001";

function isValidEmail(email) {
    const atIndex = email.indexOf('@');
    return atIndex > -1 && email.length > atIndex + 1;
}
function isValidPassword(password) {
    return password.length >= 8 && /\d/.test(password);
}
function isValidExpiryDate(expiry){
    return expiry !== "";
}

// LOGIN
export async function LoginGeneric(email, password, callback){
    PlayFab.settings.titleId = titleId;
    var loginRequest = {
        Email: email,
        Password: password,
        TitleId: PlayFab.settings.titleId
    };
    PlayFabClientSDK.LoginWithEmailAddress(loginRequest, callback);
}  
export async function Login(){  
    PlayFab.settings.titleId = titleId;

    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    var loginRequest = {
        Email: email,
        Password: password,
        TitleId: PlayFab.settings.titleId
    };

    PlayFabClientSDK.LoginWithEmailAddress(loginRequest, async function (response, error) {
        if (error) {
            console.error("Error logging in:", error);
        } else {
            localStorage.setItem("PlayFabId", response.data.PlayFabId);
            localStorage.setItem("PlayFabSessionTicket", response.data.SessionTicket);
            const [accessLevel, userPrefs] = await Promise.all([getUserData(["AccessLevel"]), getUserData(["UserPreferenceData"])]);
            const userPrefsJson = JSON.parse(userPrefs.UserPreferenceData);
            localStorage.setItem("theme", userPrefsJson.theme);
            handleThemeChange();           

            setAccessLevel(accessLevel); 
            if (canAccess()) {                
                document.getElementById('loginModal').style.display = 'none';
            }

            await auth(response.data.PlayFabId, response.data.SessionTicket);
        }
    });
}
// REGISTER USER
export async function RegisterUserEmailAddressGeneric(email, password, displayName, callback){
    PlayFab.settings.titleId = titleId;

    var registerRequest = {
        TitleId: titleId,
        Email: email,
        Password: password,
        DisplayName: displayName,
        RequireBothUsernameAndEmail: false
    };

    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, callback);
}

export async function RegisterUserEmailAddress(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    let email = document.getElementById("emailSignUpAddress").value;
    let pass = document.getElementById("emailSignUpPassword").value;
    let expiry = document.getElementById("expiry").value;
    if (!isValidEmail(email)) {
        alert("Invalid email address!");
        document.getElementById("resultOutput").innerHTML = "Invalid email address.";
        return;
    }
    if (!isValidPassword(pass)) {
        alert("Password must be at least 8 characters and include at least 1 number!");
        document.getElementById("resultOutput").innerHTML = "Password must be at least 8 characters and include at least 1 number.";
        return;
    }
    if(!isValidExpiryDate(expiry)){
        alert("Select an expiry date!");
        document.getElementById("resultOutput").innerHTML = "Select an expiry date!";
        return;
    }

    document.getElementById("registerButton").value  = "Registering...";

    PlayFab.settings.titleId = titleId;

    var registerRequest = {
        TitleId: titleId,
        Email: document.getElementById("emailSignUpAddress").value,
        Password: document.getElementById("emailSignUpPassword").value,
        DisplayName: document.getElementById("displayName").value,
        RequireBothUsernameAndEmail: false
    };

    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, RegisterCallback);
}
var RegisterCallback = async function (result, error){
    // once the account is created, update the user data
    if (error !== null){
        document.getElementById("registerButton").value  = "Register";
        let errorOutput = `Something went wrong:\n${PlayFab.GenerateErrorReport(error)}`;
        alert(errorOutput);
        document.getElementById("resultOutput").innerHTML = errorOutput;
        return;
    }

    document.getElementById("resultOutput").innerHTML = "Account created!";
    
    const AcademicArea = document.getElementById("academicArea").value;
    const LanguageOfStudyInput = document.getElementById("language").value;    
    const TestAccountExpiryDate = document.getElementById("expiry").value;
    const CreatedBy = document.getElementById("createdBy").value;
    const CreatedUpdatedReason = document.getElementById("createdReason").value;

    let data = getDefaultGoldUserData(AcademicArea, LanguageOfStudyInput, TestAccountExpiryDate, CreatedBy, CreatedUpdatedReason);
    UpdateUserData(data);
    // wait for UpdateUserData to complete
    await waitUntil(()=> doneUpdatingUserData == true);
    // update confluence page
    const email = document.getElementById("emailSignUpAddress").value;
    const pass = document.getElementById("emailSignUpPassword").value;

    callUpdateConfluencePage(email,pass,AcademicArea,TestAccountExpiryDate,CreatedBy,CreatedUpdatedReason);   
}
// DEFAULT DATA
export function getDefaultGoldUserData(AcademicArea, LanguageOfStudyInput, TestAccountExpiryDate, CreatedBy, CreatedUpdatedReason){
    const VerifyEmailOverride = true;
    const CanEmail = true;
    const today = formatDate(new Date());
    const TestAccountExpiryDateFormatted = formatDate(new Date(TestAccountExpiryDate));

    const OtherSubDataJSON = {
        Platform:"Other",
        Product:"immersify.gold_yearly",
        PurchaseDate:today.toString(),
        SubStatus:"",
        SubExpire:TestAccountExpiryDateFormatted.toString(),
        SubscriptionTier:"gold",
        SubscriptionPeriod:"yearly"
    }
    //console.log(OtherSubDataJSON);
    const otherSubDataStr = JSON.stringify(OtherSubDataJSON);

    const UserProfileDataJSON = {
        selectedAvatarId: "",
        selectedSkinToneId: "",
        selectedHairColourId: "",
        languageOfStudy: LanguageOfStudyInput,
        selectedYearId: 0,
        selectedAbilityId: "",
        activityTypePreference: []
    }
    const userProfileDataStr = JSON.stringify(UserProfileDataJSON);

    const LastWriteDevice = "";

    const data = {
        VerifyEmailOverride,
        AcademicArea,
        CanEmail,
        TestAccountExpiryDate:TestAccountExpiryDateFormatted.toString(),
        CreatedBy,
        CreatedUpdatedReason,
        OtherSubData:otherSubDataStr,
        LastWriteDevice,
        UserProfileData:userProfileDataStr // localisation
    };
    console.log(data);
    return data;
}
// UPDATE USER DATA
export function UpdateUserDataGeneric(updateData, callback){
    PlayFab.settings.titleId = titleId;

    var updateUserDataRequest = {
        TitleId: titleId,
        Data: updateData
    };
    PlayFabClientSDK.UpdateUserData(updateUserDataRequest, callback);
}
let doneUpdatingUserData = false;
function UpdateUserData(updateData){
    doneUpdatingUserData = false;
    PlayFab.settings.titleId = titleId;

    var updateUserDataRequest = {
        TitleId: titleId,
        Data: updateData
    };
    PlayFabClientSDK.UpdateUserData(updateUserDataRequest, UpdateUserDataCallback);
}
var UpdateUserDataCallback = function (result, error){
    if (result !== null) {
        document.getElementById("resultOutput").innerHTML = "Account created & user data updated...\nUpdating confluence...";
    } else if (error !== null) {
        document.getElementById("registerButton").value  = "Register";
        let errorOutput = "Something went wrong:\n"+PlayFab.GenerateErrorReport(error);
        alert(errorOutput);
        document.getElementById("resultOutput").innerHTML = errorOutput;
    }

    doneUpdatingUserData = true;
}

// UPDATE USER DATA (SERVER SIDE)
export async function UpdateUserDataServer(inEmail, inPass, inAcaArea, inLanguage, inExpiry, inUpdatedBy, inReason){
    let resultOutput = document.getElementById("updateResultOutput").value;
    resultOutput = '';

    const userAccInfoResp = await fetchUserAccInfoByEmail(inEmail); // input email address, get playfabID
    if (userAccInfoResp.error) {
        resultOutput = `Error occurred: ${userAccInfoResp.message}`;
        return;
    }

    const VerifyEmailOverride = true;
    const AcademicArea = inAcaArea;//document.getElementById("academicAreaUpdate").value;
    const LanguageOfStudyInput = inLanguage;//document.getElementById("languageUpdate").value;
    const TestAccountExpiryDate = inExpiry;//document.getElementById("expiryUpdate").value;
    const TestAccountExpiryDateFormatted = formatDate(new Date(TestAccountExpiryDate));
    const today = formatDate(new Date());
    const UpdatedBy = inUpdatedBy;//document.getElementById("updatedBy").value;
    const CreatedUpdatedReason = inReason;//document.getElementById("updatedReason").value;

    const OtherSubDataJSON = {
        Platform:"Other",
        Product:"immersify.gold_yearly",
        PurchaseDate:today.toString(),
        SubStatus:"",
        SubExpire:TestAccountExpiryDateFormatted.toString(),
        SubscriptionTier:"gold",
        SubscriptionPeriod:"yearly"
    }
    //console.log(OtherSubDataJSON);
    const otherSubDataStr = JSON.stringify(OtherSubDataJSON);

    const UserProfileDataJSON = {
        selectedAvatarId: "",
        selectedSkinToneId: "",
        selectedHairColourId: "",
        languageOfStudy: LanguageOfStudyInput,
        selectedYearId: 0,
        selectedAbilityId: "",
        activityTypePreference: []
    }
    const userProfileDataStr = JSON.stringify(UserProfileDataJSON);
    
    const data = {
        //SubOverride,
        VerifyEmailOverride,
        AcademicArea,
        TestAccountExpiryDate:TestAccountExpiryDateFormatted.toString(),
        UpdatedBy,
        CreatedUpdatedReason,
        OtherSubData:otherSubDataStr,
        UserProfileData:userProfileDataStr // localisation
    };

    const url = `/update-user-data`;
    const playFabID = userAccInfoResp.data.UserInfo.PlayFabId;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playFabID, updateData: data })
    });

    if (!response.ok) {
        console.log(response);
        throw new Error('Access check failed');
    }

    // Update the confluence page
    await callUpdateConfluencePage(inEmail,inPass,AcademicArea,TestAccountExpiryDate,UpdatedBy,CreatedUpdatedReason);

    return await response.json();
}

// GET USER DATA
function getUserData(keys){
    return new Promise((resolve, reject) => {
        var requestData = {
            Keys: keys
        };

        PlayFabClientSDK.GetUserData(requestData, function(response, error) {
            if (error) {
                console.error("Error getting user data:", error);
                reject(error);
            } else {
                var resultData = {};
                keys.forEach(key => {
                    resultData[key] = response.data.Data[key] ? response.data.Data[key].Value : null;
                });
                resolve(resultData);
            }
        });
    });
}

// RESET PASSWORD
export function ResetPassword(email, callback){
    PlayFab.settings.titleId = titleId;

    var resetPasswordRequest = {
        Email: email,
        TitleId: PlayFab.settings.titleId
    };

    PlayFabClientSDK.SendAccountRecoveryEmail(resetPasswordRequest, callback);    
}


// GET PLAYER EMAIL ADDR
export async function getPlayerEmailAddr(playFabId){
    try{
        let playerData = await fetchUserAccInfoById(playFabId);
        let userEmail;
        let loginEmail = playerData.data.UserInfo.PrivateInfo.Email;
        if(loginEmail !== undefined){ 
            userEmail = loginEmail 
        }else{
            //console.log("login email undefined, getting contact instead");
            userEmail = await getPlayerContactEmailAddr(playFabId);
        }
        return userEmail;
    }catch(error){
        console.error(`Error fetching email for PlayFab ID ${playFabId}:`, error);
        return null;
    }    
}
async function getPlayerContactEmailAddr(playFabId){
    let playerProfileResp = await fetchUserProfileById(playFabId);
    let playerProfile = playerProfileResp.data.PlayerProfile;
    let contactEmailAddr = "";

    contactEmailAddr = playerProfile.ContactEmailAddresses[0]?.EmailAddress;
    return contactEmailAddr;

}

// AUTH TICKET
export async function authenticateSessionTicket(inSessionTicket){
    const authResp = await fetch('/playfab/auth-ticket', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionTicket: inSessionTicket }),
    });
    
    const output = await authResp.json();
    if (!authResp.ok) {
        throw new Error('Failed to auth ticket');
    }
    return output;
}