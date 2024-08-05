import { canAccess } from "./access-check.js";
import { fetchUserAccInfoByEmail } from "./utils.js";

export async function UpdateUserAcademicAreaByEmail(emailListText, desiredAcademicArea)
{
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    // Split by newline and filter out empty strings
    const emailList = emailListText.split('\n').filter(Boolean); 

    let userAccInfoList = [];
    for (const email of emailList) {
        const userInfo = await fetchUserAccInfoByEmail(email);
        userAccInfoList.push(userInfo);
    }

    //console.log(userAccInfoList);
    userAccInfoList.forEach(async (userAccInfo) => {
        console.log(userAccInfo.data.UserInfo.PlayFabId);
        await UpdatePlayerAcademicArea(userAccInfo.data.UserInfo.PlayFabId, desiredAcademicArea);
    })
}

export async function UpdatePlayerAcademicArea(playerIDList, desiredAcademicArea)
{
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    let AcademicArea = desiredAcademicArea;
    let updateData = { AcademicArea };

    const url = '/update-user-data';
    for(const playerId of playerIDList){
        let playFabID = playerId.trim();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playFabID, updateData })
        });

        console.log("updated: " + playFabID);

        if (!response.ok) {
            console.log(response);
            throw new Error(`Failed to update player ${playFabID}: ${response}`);
        }
    }
}