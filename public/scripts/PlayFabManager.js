import { callUpdateConfluencePage } from "./main.js";
const titleId = "29001";
let accessLevel;

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
            accessLevel = await getUserData(["AccessLevel"]);
            let accessCheckResponse = await fetchUserAccess();
            if (accessCheckResponse.isAuthorized) {
                document.getElementById('loginModal').style.display = accessCheckResponse.modalMode;
            }
        }
    });
}
export async function fetchUserAccess() {
    if(accessLevel == undefined){ return; }
    let userAccess = accessLevel.AccessLevel;

    const url = `/check-access`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userAccess }) 
    });

    if (!response.ok) {
        throw new Error('Access check failed');
    }

    return await response.json();
}

export async function RegisterUserEmailAddress(){
    let accessCheckResponse = await fetchUserAccess();
    if(accessCheckResponse == undefined){ return; }
    if (!accessCheckResponse.isAuthorized) { return; }

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
        var CreatedFor = document.getElementById("createdFor").value;

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
            CreatedFor
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
        let area = document.getElementById("academicArea").value;
        let expiry = document.getElementById("expiry").value;
        var createdBy = document.getElementById("createdBy").value;
        var createdFor = document.getElementById("createdFor").value;

        callUpdateConfluencePage(email,pass,area,expiry,createdBy,createdFor);
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
// function GetPlayerProfile(playFabID){
//     PlayFab.settings.titleId = titleId;
//     var request = {
//         PlayFabId: playFabID
//     };
//     PlayFabClientSDK.GetPlayerProfile(request, GetPlayerProfileCallback);
// }
// var GetPlayerProfileCallback = function(result, error){
//     document.getElementById("resultOutput").innerHTML = "got player profile";

//     if (result !== null) {
//         console.log("player profile: " + result);
        
//     } else if (error !== null) {
//         console.error("Error: " + error);
        
//     }
// }