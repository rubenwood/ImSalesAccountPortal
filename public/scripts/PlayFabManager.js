import { callUpdateConfluencePage } from "./confluence.js";
import {fetchUserAccInfoById, fetchUserAccInfoByEmail, fetchUserProfileById} from "./utils.js"
import {setAccessLevel, canAccess} from "./access-check.js"

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

export async function Login()
{  
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
            //accessLevel = await getUserData(["AccessLevel"]); 
            setAccessLevel(await getUserData(["AccessLevel"])); 
            //let accessCheckResponse = await fetchUserAccess();
            if (canAccess()) {                
                document.getElementById('loginModal').style.display = 'none';
            }
        }
    });
}

export async function RegisterUserEmailAddress(){
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    let email = document.getElementById("emailSignUpAddress").value;
    let pass = document.getElementById("emailSignUpPassword").value;
    let expiry = document.getElementById("expiry").value;
    if (!isValidEmail(email)) {
        document.getElementById("resultOutput").innerHTML = "Invalid email address.";
        return;
    }
    if (!isValidPassword(pass)) {
        document.getElementById("resultOutput").innerHTML = "Password must be at least 8 characters and include at least 1 number.";
        return;
    }
    if(!isValidExpiryDate(expiry)){
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
    if (result !== null) {
        document.getElementById("resultOutput").innerHTML = "Account created!";

        // once the account is created, update the user data
        var SubOverride = true;
        var VerifyEmailOverride = true;
        var AcademicArea = document.getElementById("academicArea").value;
        var Avatar = '["Head:Blank_User","Clothes:empty","Addon:empty","Mouth:empty","Hair:empty","Eyewear:empty","Other:empty","Covering:empty"]';
        var CanEmail = true;
        var Enterprise = false;
        var Guest = false;
        var TestAccountExpiryDate = document.getElementById("expiry").value;
        var CreatedBy = document.getElementById("createdBy").value;
        var CreatedUpdatedReason = document.getElementById("createdReason").value;

        var data = {
            SubOverride,
            VerifyEmailOverride,
            AcademicArea,
            Avatar,
            CanEmail,
            Enterprise,
            Guest,
            TestAccountExpiryDate,
            CreatedBy,
            CreatedUpdatedReason
        };
        UpdateUserData(data);
        // wait for UpdateUserData to complete
        await waitUntil(()=> updatingUserData == true);
        // set the LastWriteDevice
        var LastWriteDevice = "";
        UpdateUserData({ LastWriteDevice });
        // update confluence page
        let email = document.getElementById("emailSignUpAddress").value;
        let pass = document.getElementById("emailSignUpPassword").value;

        callUpdateConfluencePage(email,pass,AcademicArea,TestAccountExpiryDate,CreatedBy,CreatedUpdatedReason);
    } else if (error !== null) {
        document.getElementById("resultOutput").innerHTML =
            "Something went wrong\n" +
            "Here's some debug information:\n" +
            PlayFab.GenerateErrorReport(error);
    }
}

var updatingUserData = false;
function UpdateUserData(updateData){
    updatingUserData = true;
    // updateData must be a json object
    PlayFab.settings.titleId = titleId;

    var updateUserDataRequest = {
        TitleId: titleId,
        Data: updateData
    };
    PlayFabClientSDK.UpdateUserData(updateUserDataRequest, UpdateUserDataCallback);
}

// UPDATE USER DATA
var UpdateUserDataCallback = function (result, error){
    if (result !== null) {
        document.getElementById("resultOutput").innerHTML = "Account created & user data updated... Updating confluence...";
    } else if (error !== null) {
        document.getElementById("registerButton").value  = "Register";
        document.getElementById("resultOutput").innerHTML =
            "Something went wrong\n" +
            "Here's some debug information:\n" +
            PlayFab.GenerateErrorReport(error);
    }

    updatingUserData = false;
}

// UPDATE USER DATA (SERVER SIDE)
export async function UpdateUserDataServer(){
    let resultOutput = document.getElementById("updateResultOutput").value;
    resultOutput = '';
    let email =  document.getElementById("emailAddressUpdate").value;
    let userAccInfoResp = await fetchUserAccInfoByEmail(email); // input email address, get playfabID
    if (userAccInfoResp.error) {
        resultOutput = `Error occurred: ${userAccInfoResp.message}`;
        return;
    }

    const url = `/update-user-data`;
    let playFabID = userAccInfoResp.data.UserInfo.PlayFabId;

    let SubOverride = true;
    let VerifyEmailOverride = true;
    let AcademicArea = document.getElementById("academicAreaUpdate").value;
    let TestAccountExpiryDate = document.getElementById("expiryUpdate").value;
    let UpdatedBy = document.getElementById("updatedBy").value;
    let CreatedUpdatedReason = document.getElementById("updatedReason").value;
    let data = {
        SubOverride,
        VerifyEmailOverride,
        AcademicArea,
        TestAccountExpiryDate,
        UpdatedBy,
        CreatedUpdatedReason
    };

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
    await callUpdateConfluencePage(email,'[user defined]',AcademicArea,TestAccountExpiryDate,UpdatedBy,CreatedUpdatedReason);

    return await response.json();
}

// GET USER DATA
function getUserData(keys) {
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

// GET PLAYER EMAIL ADDR
export async function getPlayerEmailAddr(playFabId) {
    try{
        let playerData = await fetchUserAccInfoById(playFabId);
        let userEmail;
        let loginEmail = playerData.data.UserInfo.PrivateInfo.Email;
        if(loginEmail !== undefined){ 
            userEmail = loginEmail 
        }else{
            console.log("login email undefined, getting contact instead");
            userEmail = await getPlayerContactEmailAddr(playFabId);
        }
        return userEmail;
    } catch (error) {
        console.error(`Error fetching email for PlayFab ID ${playFabId}:`, error);
        return null;
    }    
}

async function getPlayerContactEmailAddr(playFabId){
    let playerProfileResp = await fetchUserProfileById(playFabId);
    let playerProfile = playerProfileResp.data.PlayerProfile;
    let contactEmailAddr = "";
    // if(playerProfile == undefined) { return contactEmailAddr;  } 
    // if(playerProfile.ContactEmailAddresses == undefined) { return contactEmailAddr;  } 
    // if(playerProfile.ContactEmailAddresses.length < 1) { return contactEmailAddr;  } 

    contactEmailAddr = playerProfile.ContactEmailAddresses[0].EmailAddress;
    return contactEmailAddr;

}