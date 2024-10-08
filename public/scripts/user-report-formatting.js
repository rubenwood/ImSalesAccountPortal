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
export function calcDaysSince(inputDate){
    let today = new Date();
    let diffTime = Math.abs(today - inputDate);
    let daysSince = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysSince;
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
export function populateUsageData(playerDataList, loginData, nclData, state, row){
    // if every playerDataList element is undefined, there is no playerdata
    if(playerDataList.every((element) => { return element === undefined})){ 
        addCellToRow(row, 'No Usage Data', false); 
        return state; 
    }

    let playerDataContent = '';
    playerDataContent += `<b>Last Login Android:</b> ${loginData.lastLoginAndr} <br/>
                        <b>Last Login iOS:</b> ${loginData.lastLoginIOS} <br/> 
                        <b>Last Login Web:</b> ${loginData.lastLoginWeb} <br/><br/>
                        <b>Total Logins:</b> ${loginData.totalLogins} <br/>
                        <b>Logins:</b><br/> ${formatLoginsPerMonth(loginData.loginsPerMonth)} <br/><br/>
                        <b>Session Data:</b><br/> ${loginData.sessionsString}`;
    
    playerDataList.forEach(playerData =>{
        if(playerData == undefined){ console.log(`no player data`); return; }
        
        state.totalActivitiesPlayed += playerData.activities.length;
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
            
            // TODO: handle questionData

            // add the unformatted data for the report
            let userActivityData = {
                activityID:activity.activityID,
                activityTitle: activity.activityTitle,
                activityType: activity.activityType,
                plays:activity.plays,
                playCount:activity.plays.length,
                totalSessionTime:totalSessionTime,
                bestScore:bestScore
            };
            state.activityDataForReport.push(userActivityData);
        });        
    });

    // NCL data
    playerDataContent += `${formatNCLDataHTML(formatNCLData(nclData))}`;

    playerDataContent += `<h1>Total Plays: ${state.totalPlays}</h1>`;
    playerDataContent += `<h1>Total Activities Played: ${state.totalActivitiesPlayed}</h1>`;
    playerDataContent += `<h1>Total Play Time: ${formatTime(state.totalPlayTime)}</h1>`;
    state.averageTimePerPlay = Math.round(state.totalPlayTime / state.totalPlays); 
    playerDataContent += `<h1>Avg. Time per activity: ${formatTime(state.averageTimePerPlay)}</h1>`;
    addCellToRow(row, 'Expand Usage Data', 1, true, playerDataContent);    

    return state;
}


export function populateLoginData(userData){
    
    const lastLoginAndr = userData.LastLoginDateAndroid?.Value;
    const lastLoginIOS = userData.LastLoginDateiOS?.Value;
    const lastLoginWeb = userData.LastLoginDateWeb?.Value;

    const sessionData = userData.SessionDebugData?.Value;
    const sessionDataJSON = sessionData ? JSON.parse(sessionData) : undefined;
    const sessions = sessionDataJSON ?  sessionDataJSON.sessions : undefined;
    const loginsPerDate = getLoginsPerDate(sessions);
    const sessionsString = sessions ? formatSessionsForModal(sessions, loginsPerDate) : "No Session Data";

    const totalLogins = getTotalLoginsPerUser(sessions);
    console.log("USER DATA TOTAL LOGINS: ", totalLogins);
    const loginsPerMonth = getLoginsPerMonth(loginsPerDate);
    console.log("USER DATA LOGINS PER MONTH: ", loginsPerMonth);

    return { 
        lastLoginAndr, 
        lastLoginIOS, 
        lastLoginWeb,
        loginsPerDate,
        totalLogins,
        loginsPerMonth,
        sessionsString
    };
}


// SESSION DATA
// format the sessions data
// might need to check for TitleDataMetaData
function formatSessionsForModal(sessions, loginsPerDate){
    let sessionDataString = "";

    sessions.forEach(session => {
        const platform = formatPlatform(session.platform);
        const loginsPerDateFormatted = formatLoginsPerDate(loginsPerDate)?.replaceAll('\n','<br/>');
        sessionDataString += `Device:<br/>ID: ${session.sessionId}<br/>Version: ${session.versionNumber}<br/>Platform: ${platform}<br/>Logins:<br/>${loginsPerDateFormatted ?? "No login history (yet)"}<br/><br/>`;
    });

    return sessionDataString;
}
export function formatSessionsForExport(sessionsString){
    if(sessionsString == undefined){ return; }
    let formattedSessionsString = sessionsString.replaceAll("<br/>", "\n");
    formattedSessionsString = formattedSessionsString.replaceAll("<b>", "");
    formattedSessionsString = formattedSessionsString.replaceAll("</b>", "");
    return formattedSessionsString;
}

// LOGIN DATA
// gets logins per each day on specific dates
// returns { date: (date of login), logins: (number of logins) }
function getLoginsPerDate(sessions) {
    if (!sessions || sessions.length === 0) {
        return [];
    }

    let loginHistoryDates = [];

    // Iterate over each session and process its loginHistory
    sessions.forEach(session => {
        const loginHistory = session.loginHistory;

        // Check if the session has a valid loginHistory, skip if undefined or empty
        if (!loginHistory || loginHistory.length === 0) {
            return; // Skip this session if no loginHistory
        }

        // Iterate through each login entry in the loginHistory
        loginHistory.forEach(entry => {
            const [datePart, timePart] = entry.split(" ");
            const [day, month, year] = datePart.split("/").map(Number);
            const loginDate = new Date(year, month - 1, day); // Create a Date object

            // Push the login date to the list of dates
            loginHistoryDates.push(loginDate);
        });
    });

    // Count logins by date
    let loginCountByDate = {};

    loginHistoryDates.forEach(date => {
        // Format the date as DD/MM/YYYY
        let formattedDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY format

        // Increment the count for this date
        if (loginCountByDate[formattedDate]) {
            loginCountByDate[formattedDate]++;
        } else {
            loginCountByDate[formattedDate] = 1;
        }
    });

    // Format the output
    let loginsByDate = Object.keys(loginCountByDate).map(date => {
        return {
            date: date,
            logins: loginCountByDate[date]
        };
    });

    return loginsByDate;
}
function formatLoginsPerDate(loginsPerDate){
    if(loginsPerDate == undefined){ return; }

    const formattedLogins = loginsPerDate.map(entry => {
        return `${entry.date} ${entry.logins}`;
    });

    const loginsPerDateString = formattedLogins.join("\n");

    return loginsPerDateString;
}
// GET TOTAL LOGINS
function getTotalLoginsPerUser(sessions){
    if(sessions == undefined){ return 0; }
    let totalLogins = 0;
    sessions.forEach(session =>{
        totalLogins += session.loginHistory != undefined ? session.loginHistory.length : 0;
    });
    return totalLogins;
}
// GET LOGINS PER PERIOD
function getLoginsPerPeriod(periodInDays, sessions){
    if(sessions == undefined){ return 0; }

    const currentDate = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(currentDate.getDate() - periodInDays);
    let loginsPerDay = {};

    sessions.forEach(session => {
        if(session.loginHistory == undefined){ return; }
        const loginHistory = session.loginHistory;

        loginHistory.forEach(loginEntry => {
            // Split the login entry and create a Date object
            const [datePart, timePart] = loginEntry.split(" ");
            const [day, month, year] = datePart.split("/").map(Number);
            const loginDate = new Date(year, month - 1, day);

            if (loginDate >= cutoffDate && loginDate <= currentDate) {
                const formattedDate = loginDate.toLocaleDateString('en-GB');

                if (loginsPerDay[formattedDate]) {
                    loginsPerDay[formattedDate]++;
                } else {
                    loginsPerDay[formattedDate] = 1;
                }
            }
        });
    });

    // Convert the loginsPerDay object into an array of { date: "DD/MM/YYYY", logins: numLogins } format
    let loginsPerPeriodArray = Object.keys(loginsPerDay).map(date => {
        return {
            date: date,
            numLogins: loginsPerDay[date]
        };
    });

    let totalLoginsPerPeriod = 0;
    loginsPerPeriodArray.forEach(entry =>{
        totalLoginsPerPeriod += entry.numLogins; 
    });

    return totalLoginsPerPeriod;
}
// GET LOGINS PER MONTH
function getLoginsPerMonth(loginsPerDate) {
    // Determine the range of years in the data
    const years = loginsPerDate.map(login => Number(login.date.split("/")[2]));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    // Create a baseline of months for each year in the range
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const output = [];

    for (let year = minYear; year <= maxYear; year++) {
        months.forEach((month, index) => {
            output.push({
                year: year,
                month: month,
                logins: 0
            });
        });
    }

    loginsPerDate.forEach(login => {
        const [day, month, year] = login.date.split("/").map(Number);
        const monthName = months[month - 1];
        // Find the corresponding month-year entry in the output and update its logins
        const entry = output.find(element => element.year === year && element.month === monthName);
        if (entry) {
            entry.logins += login.logins;
        }
    });

    return output;
}
function formatLoginsPerMonth(loginsPerMonth){
    let output = "";

    loginsPerMonth.forEach(entry =>{
        output += `<b>${entry.month} ${entry.year}</b> ${entry.logins}<br/>`
    });

    return output;
}

// PLATFORM
function formatPlatform(platform){
    switch(platform) {
        case "IPhonePlayer":
            return "iOS";
        case "Android":
            return "Android";
        case "WindowsPlayer":
            return "Windows";
        case "WindowsEditor":
            return "Windows";
    }
    return "unknown";
}

// FORMAT NCL DAT
function formatNCLData(nclData){
    if(nclData == undefined){ return; }
    let output = [];
    for(let field of nclData.additionalDataFields){
        let tempField = field;
        tempField.value = tempField.value.replaceAll("~",", ");
        output.push(tempField);
    }
    return output;
}
function formatNCLDataHTML(nclDataJSON){
    if(nclDataJSON == undefined){ return; }
    let output = '';
    nclDataJSON.forEach(element => {
        output += `<b>${element.fieldId}</b> ${element.value}\n`;
    });
    
    return output;
}