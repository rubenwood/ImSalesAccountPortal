import { formatTime } from './utils.js';

export function populateAccDataRow(row, email, createdDate, lastLoginDate, daysSinceLastLogin, 
    daysSinceCreation, expiryDateString, daysToExpire, createdBy, createdFor, linkedAccounts){
        
    addCellToRow(row, email, false);
    addCellToRow(row, createdDate.toDateString(), false);
    addCellToRow(row, lastLoginDate.toDateString(), false);
    addCellToRow(row, daysSinceLastLogin, false);
    addCellToRow(row, daysSinceCreation, false);
    addCellToRow(row, expiryDateString, false);
    addCellToRow(row, daysToExpire, false);
    addCellToRow(row, createdBy, false);
    addCellToRow(row, createdFor, false);
    addCellToRow(row, linkedAccounts, false);
}

export function addCellToRow(row, text, colSpan = 1, isCollapsible = false, collapsibleContent = '') {
    const cell = row.insertCell();
    if(!isCollapsible){     
        cell.textContent = text;
        cell.style.textAlign = 'center';
        cell.colSpan = colSpan;
    }else{
        const collapseButton = document.createElement('button');
        collapseButton.textContent = text;
        collapseButton.onclick = function() {
            showPlayerDataModal(collapsibleContent);
        };
        collapseButton.className = 'collapsible-button';

        const collapsibleDiv = document.createElement('div');
        collapsibleDiv.style.display = 'none';
        collapsibleDiv.innerHTML = collapsibleContent;

        cell.appendChild(collapseButton);
        cell.appendChild(collapsibleDiv);
        collapsibleDiv.className = 'collapsible-content';

        cell.appendChild(collapseButton);
    }    
}
// PLAYER DATA MODAL
function showPlayerDataModal(content) {
    document.getElementById('playerDataModalBody').innerHTML = content;
    document.getElementById('playerDataModal').style.display = 'block';
}
export function closePlayerDataModal() {
    document.getElementById('playerDataModal').style.display = 'none';
}
export function calcDaysSinceLastLogin(lastLoginDate){
    let today = new Date();
    let diffTimeLastLogin = Math.abs(today - lastLoginDate);
    let daysSinceLastLogin = Math.ceil(diffTimeLastLogin / (1000 * 60 * 60 * 24));
    return daysSinceLastLogin;
}
export function calcDaysSinceCreation(createdDate){
    let today = new Date();
    let diffTime = Math.abs(today - createdDate);
    let daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysSinceCreation;
}
export function calcDaysToExpiry(accountExpiryDate){
    let today = new Date();
    let daysToExpire;
    if (accountExpiryDate instanceof Date && !isNaN(accountExpiryDate)) {
        let diffTime2 = Math.abs(today - accountExpiryDate);
        daysToExpire = Math.ceil(diffTime2 / (1000 * 60 * 60 * 24));
    } else {
        daysToExpire = "N/A";
        accountExpiryDate = "N/A";
    }
    return daysToExpire;
}


export function getUserEmailFromAccData(element){
    let email = "no email";
    //console.log(element);
    if(element.LinkedAccounts !== undefined && element.LinkedAccounts.length > 0){
        let gotAcc = false;
        element.LinkedAccounts.forEach(linkedAcc =>{
            if(linkedAcc.Platform == "PlayFab"){
                email = linkedAcc.Email;
                gotAcc = true;
            }else{
                if(!gotAcc){
                    let contactEmail = checkForContactEmailAddr(element);
                    email = contactEmail == undefined ? "no email" : contactEmail;
                }
            }
        })
    }else{ // if there are no linked accounts, just get the contact email   
        let contactEmail = checkForContactEmailAddr(element);
        email = contactEmail == undefined ? "no email" : contactEmail;
    }
    //console.log(email);
    return email;
}
export function checkForContactEmailAddr(input){
    let emailAddr;
    if(input.ContactEmailAddresses !== undefined && input.ContactEmailAddresses.length > 0){
        emailAddr = input.ContactEmailAddresses[0].EmailAddress; // assume the first contact email
    }
    return emailAddr;
}

export function getUserEmailFromAccDataSuffix(element, suffixes){
    let email = "no email";
    if(element.LinkedAccounts !== undefined && element.LinkedAccounts.length > 0){
        let gotAcc = false;
        element.LinkedAccounts.forEach(linkedAcc =>{
            if(linkedAcc.Platform == "PlayFab"){
                suffixes.forEach(suffix => {
                    if(linkedAcc.Email.includes(suffix)){
                        email = linkedAcc.Email;
                        gotAcc = true;
                    }
                });
            }else{
                if(!gotAcc){
                    let contactEmail = checkForContactEmailAddrSuffix(element, suffixes);
                    email = contactEmail == undefined ? "no email" : contactEmail;
                }
            }
        })
    }else{ // if there are no linked accounts, just get the contact email   
        let contactEmail = checkForContactEmailAddrSuffix(element, suffixes);
        email = contactEmail == undefined ? "no email" : contactEmail;
    }
    return email;
}
// GET CONTACT EMAIL (from ContactEmailAddresses (playfab field))
export function checkForContactEmailAddrSuffix(input, suffixes){
    let emailAddr;
    if(input.ContactEmailAddresses !== undefined && input.ContactEmailAddresses.length > 0){
        input.ContactEmailAddresses.forEach(contactEmail =>{
            suffixes.forEach(suffix => {
                if(contactEmail.EmailAddress.includes(suffix)){
                    emailAddr = contactEmail.EmailAddress;
                }
            });
        })
    }
    return emailAddr;
}

// populates the expanded usage data modal
export function populateUsageData(playerData, loginData, state, row){
    if(playerData == undefined){ addCellToRow(row, 'No Usage Data', false); return state; }

    let playerDataContent = '';
    playerDataContent += `<b>Last Login Android:</b> ${loginData.lastLoginAndr} <br/>
                        <b>Last Login iOS:</b> ${loginData.lastLoginIOS} <br/> 
                        <b>Last Login Web:</b> ${loginData.lastLoginWeb} <br/>`;
    
    playerData.activities.forEach(activity => {
        let activityContent =`<table><tr><td><b>Activity ID</b></td><td>${activity.activityID}</td></tr>`;
        activityContent +=`<tr><td><b>Activity Name</b></td><td>${activity.activityTitle}</td></tr>`;
        activityContent += `<tr><td><b>Plays</b></td><td>${activity.plays.length}</td></tr>`;
        let totalSessionTime = 0;
        let bestScore = 0;
        state.totalPlays += activity.plays.length;
        
        activity.plays.forEach(play => {
            totalSessionTime += Math.round(Math.abs(play.sessionTime));
            if(play.normalisedScore > bestScore){
                bestScore = Math.round(play.normalisedScore * 100);
            }
        });
        state.totalPlayTime += totalSessionTime;

        activityContent += `<tr><td><b>Total Session Length</b></td><td>${formatTime(totalSessionTime)}</td></tr><br />`;
        activityContent += `<tr><td><b>Best Score</b></td><td>${bestScore} %</td></tr><br />`;
        activityContent += "</table>";
        playerDataContent += activityContent;

        // add the unformatted data for the report
        let userActivityData = {
            activityID:activity.activityID,
            activityTitle: activity.activityTitle,
            plays:activity.plays,
            playCount:activity.plays.length,
            totalSessionTime:totalSessionTime,
            bestScore:bestScore
        };
        state.activityDataForReport.push(userActivityData);
    });

    playerDataContent += `<h1>Total Plays: ${state.totalPlays}</h1>`;
    playerDataContent += `<h1>Total Activities Played: ${playerData.activities.length}</h1>`;
    playerDataContent += `<h1>Total Play Time: ${formatTime(state.totalPlayTime)}</h1>`;
    state.averageTimePerPlay = Math.round(state.totalPlayTime / state.totalPlays); 
    playerDataContent += `<h1>Avg. Time per activity: ${formatTime(state.averageTimePerPlay)}</h1>`;
    addCellToRow(row, 'Expand Usage Data', 1, true, playerDataContent);    

    return state;
}

export function populateLoginData(userData){
    let lastLoginAndr = userData.LastLoginDateAndroid !== undefined ? userData.LastLoginDateAndroid.Value : undefined;
    let lastLoginIOS = userData.LastLoginDateiOS !== undefined ? userData.LastLoginDateiOS.Value : undefined;
    let lastLoginWeb = userData.LastLoginDateWeb !== undefined ? userData.LastLoginDateWeb.Value : undefined;
    return {lastLoginAndr,lastLoginIOS,lastLoginWeb};    
}