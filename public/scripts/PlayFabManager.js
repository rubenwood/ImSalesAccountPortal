const titleId = "29001";

function isValidEmail(email) {
    const atIndex = email.indexOf('@');
    return atIndex > -1 && email.length > atIndex + 1;
}
function isValidPassword(password) {
    return password.length >= 8 && /\d/.test(password);
}
function isValidExpiryDate(expiry){
    console.log(expiry);
    return expiry !== "";
}

function RegisterUserEmailAddress(){
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

    PlayFab.settings.titleId = titleId; // must set titleId this way

    var registerRequest = {
        TitleId: titleId,
        Email: document.getElementById("emailSignUpAddress").value,
        Password: document.getElementById("emailSignUpPassword").value,
        DisplayName: document.getElementById("displayName").value,
        RequireBothUsernameAndEmail: false
    };

    PlayFabClientSDK.RegisterPlayFabUser(registerRequest, RegisterCallback);
}

var RegisterCallback = function (result, error){
    if (result !== null) {
        document.getElementById("resultOutput").innerHTML = "Account created!";
        UpdateUserData();
    } else if (error !== null) {
        document.getElementById("resultOutput").innerHTML =
            "Something went wrong\n" +
            "Here's some debug information:\n" +
            PlayFab.GenerateErrorReport(error);
    }
}

function UpdateUserData(){
    PlayFab.settings.titleId = titleId;

    var SubOverride = true;
    var VerifyEmailOverride = true;
    var AcademicArea = document.getElementById("academicArea").value;
    var Avatar = '["Head:Blank_User","Clothes:empty","Addon:empty","Mouth:empty","Hair:empty","Eyewear:empty","Other:empty","Covering:empty"]';
    var CanEmail = true;
    var Enterprise = false;
    var Guest = false;
    var RefCode = "";
    var VIP = false;

    var updateUserDataRequest = {
        TitleId: titleId,
        Data: {
            SubOverride,
            VerifyEmailOverride,
            AcademicArea,
            Avatar,
            CanEmail,
            Enterprise,
            Guest,
            RefCode,
            VIP
        }
    };
    PlayFabClientSDK.UpdateUserData(updateUserDataRequest, UpdateUserDataCallback);
}

var UpdateUserDataCallback = function (result, error){
    if (result !== null) {
        document.getElementById("resultOutput").innerHTML = "Account created & user data updated... Updating confluence...";
        let email = document.getElementById("emailSignUpAddress").value;
        let pass = document.getElementById("emailSignUpPassword").value;
        let area = document.getElementById("academicArea").value;
        let expiry = document.getElementById("expiry").value;

        callUpdateConfluencePage(email, pass, area, expiry);

    } else if (error !== null) {
        document.getElementById("registerButton").value  = "Register";
        document.getElementById("resultOutput").innerHTML =
            "Something went wrong\n" +
            "Here's some debug information:\n" +
            PlayFab.GenerateErrorReport(error);
    }
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