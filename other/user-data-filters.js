// filter out test accounts?

// suffix filter (includes matching, excludes non-matching)
function filterBySuffixes(users, suffixes){
    let matchedUsersMap = new Map();
    let encounteredEmails = new Set();

    for(const user of users){
        suffixes.forEach(suffix => {
            let checkContact = true;
    
            if (Array.isArray(user.AccountDataJSON.LinkedAccounts) && user.AccountDataJSON.LinkedAccounts.length > 0) {
                user.AccountDataJSON.LinkedAccounts.forEach(account => {
                    // if the user has PlayFab or OpenIdConnect account, then don't check contact address
                    if(account.Platform == "PlayFab" || account.Platform == "OpenIdConnect"){ checkContact = false; }
    
                    if (account.Platform == "PlayFab" && account.Email && isValidSuffix(account.Email, suffix)) {
                        encounteredEmails.add(account.Email);
                        matchedUsersMap.set(user.PlayFabId, user);
                        checkContact = false;
                    } else if (account.Platform == "OpenIdConnect" && isValidPlatformUserId(account.PlatformUserId, suffixMappings[suffix])) {
                        matchedUsersMap.set(user.PlayFabId, user);
                        checkContact = false;
                    }
                });
            }
    
            if (checkContact && Array.isArray(user.AccountDataJSON.ContactEmailAddresses) && !matchedUsersMap.has(user.PlayFabId)) {
                user.AccountDataJSON.ContactEmailAddresses.forEach(contact => {
                    if (contact.EmailAddress && isValidSuffix(contact.EmailAddress, suffix) && 
                    !encounteredEmails.has(contact.EmailAddress)) {
                        encounteredEmails.add(contact.EmailAddress);
                        matchedUsersMap.set(user.PlayerId, user);
                    }
                });
            }
        });
    }

    return Array.from(matchedUsersMap.values());
}
function isValidSuffix(email, suffix) {
    const parts = email.split('@');
    if (parts.length !== 2) return false;

    const domain = parts[1].toLowerCase();
    const normalizedSuffix = suffix.toLowerCase();

    // Construct a regex pattern to check if the suffix is a valid segment in the domain
    // This regex allows for dots before and after the suffix, ensuring the suffix is a distinct segment
    const pattern = new RegExp(`(^|\\.)${normalizedSuffix}(\\.|$)`);
    
    return pattern.test(domain);
}
function isValidPlatformUserId(platformUserId, suffix) {    
    if(platformUserId.includes(suffix)){
        return true;
    }
    return false;
}

// language (requires UsageData)

// country / timezone?

// new users

// returning users