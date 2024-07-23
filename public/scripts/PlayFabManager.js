import {callUpdateConfluencePage} from "./confluence.js";
import {fetchUserAccInfoById, fetchUserAccInfoByEmail, fetchUserProfileById, formatDate} from "./utils.js"
import {setAccessLevel, canAccess} from "./access-check.js"
import {auth} from "./immersifyapi/immersify-api.js";
import {waitUntil} from "./asyncTools.js";

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
            //console.log(response);
            localStorage.setItem("PlayFabId", response.data.PlayFabId);
            localStorage.setItem("PlayFabSessionTicket", response.data.SessionTicket);
            
            setAccessLevel(await getUserData(["AccessLevel"])); 
            if (canAccess()) {                
                document.getElementById('loginModal').style.display = 'none';
            }

            await auth(response.data.PlayFabId, response.data.SessionTicket);
        }
    });
}
// REGISTER USER
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
    // once the account is created, update the user data
    if (error !== null){
        document.getElementById("registerButton").value  = "Register";
        document.getElementById("resultOutput").innerHTML =
            `Something went wrong\nHere's some debug information:\n${PlayFab.GenerateErrorReport(error)}`;
        return;
    }

    document.getElementById("resultOutput").innerHTML = "Account created!";

    const SubOverride = true;
    const VerifyEmailOverride = true;
    const AcademicArea = document.getElementById("academicArea").value;
    const CanEmail = true;
    const TestAccountExpiryDate = document.getElementById("expiry").value;
    const TestAccountExpiryDateFormatted = formatDate(new Date(TestAccountExpiryDate));
    const today = formatDate(new Date());
    const CreatedBy = document.getElementById("createdBy").value;
    const CreatedUpdatedReason = document.getElementById("createdReason").value;

    // TODO: This field will be unused, for now...
    // SubOverride used instead
    const OtherSubDataJSON = {
        Platform:"Other",
        Product:"immersify.gold_yearly",
        PurchaseDate:today.toString(),
        SubStatus:"",
        SubExpire:TestAccountExpiryDateFormatted.toString(),
        SubscriptionTier:"gold",
        SubscriptionPeriod:"yearly"
    }
    console.log(OtherSubDataJSON);
    const otherSubDataStr = JSON.stringify(OtherSubDataJSON);
    const LastWriteDevice = "";

    const data = {
        SubOverride,
        VerifyEmailOverride,
        AcademicArea,
        CanEmail,
        TestAccountExpiryDate:TestAccountExpiryDateFormatted.toString(),
        CreatedBy,
        CreatedUpdatedReason,
        //OtherSubData:otherSubDataStr,
        LastWriteDevice
    };
    UpdateUserData(data);
    // wait for UpdateUserData to complete
    await waitUntil(()=> doneUpdatingUserData == true);
    // update confluence page
    const email = document.getElementById("emailSignUpAddress").value;
    const pass = document.getElementById("emailSignUpPassword").value;

    callUpdateConfluencePage(email,pass,AcademicArea,TestAccountExpiryDate,CreatedBy,CreatedUpdatedReason);   
}
// UPDATE USER DATA
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
        document.getElementById("resultOutput").innerHTML =
            "Something went wrong\n" +
            "Here's some debug information:\n" +
            PlayFab.GenerateErrorReport(error);
    }

    doneUpdatingUserData = true;
}

// UPDATE USER DATA (SERVER SIDE)
export async function UpdateUserDataServer(){
    const resultOutput = document.getElementById("updateResultOutput").value;
    resultOutput = '';
    const email =  document.getElementById("emailAddressUpdate").value;
    const userAccInfoResp = await fetchUserAccInfoByEmail(email); // input email address, get playfabID
    if (userAccInfoResp.error) {
        resultOutput = `Error occurred: ${userAccInfoResp.message}`;
        return;
    }

    const SubOverride = true;
    const VerifyEmailOverride = true;
    const AcademicArea = document.getElementById("academicAreaUpdate").value;
    const TestAccountExpiryDate = document.getElementById("expiry").value;
    const TestAccountExpiryDateFormatted = formatDate(new Date(TestAccountExpiryDate));
    const today = formatDate(new Date());
    const UpdatedBy = document.getElementById("updatedBy").value;
    const CreatedUpdatedReason = document.getElementById("updatedReason").value;
    // TODO: new data field
    const OtherSubDataJSON = {
        Platform:"Other",
        Product:"immersify.gold_yearly",
        PurchaseDate:today.toString(),
        SubStatus:"",
        SubExpire:TestAccountExpiryDateFormatted.toString(),
        SubscriptionTier:"gold",
        SubscriptionPeriod:"yearly"
    }
    console.log(OtherSubDataJSON);
    const otherSubDataStr = JSON.stringify(OtherSubDataJSON);

    const data = {
        //SubOverride,
        VerifyEmailOverride,
        AcademicArea,
        TestAccountExpiryDate:TestAccountExpiryDateFormatted.toString(),
        UpdatedBy,
        CreatedUpdatedReason,
        OtherSubData:otherSubDataStr
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
    await callUpdateConfluencePage(email,'[user defined]',AcademicArea,TestAccountExpiryDate,UpdatedBy,CreatedUpdatedReason);

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