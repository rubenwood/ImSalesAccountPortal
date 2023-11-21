const titleId = "29001";

function RegisterUserEmailAddress(){
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
        document.getElementById("resultOutput").innerHTML = "Account created & user data updated!";
    } else if (error !== null) {
        document.getElementById("resultOutput").innerHTML =
            "Something went wrong\n" +
            "Here's some debug information:\n" +
            PlayFab.GenerateErrorReport(error);
    }
}