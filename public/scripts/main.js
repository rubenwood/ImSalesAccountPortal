// public button event, when clicked, updates confluence page
function callUpdateConfluencePage(email, pass, area, expiry){
    const pageId = '929333296'; // Replace with your page ID
    const url = `http://localhost:3001/update-confluence-page/${pageId}`;

    fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, pass, area, expiry }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        document.getElementById("resultOutput").innerHTML = "Account Created, Data added, confluence page updated:\nhttps://immersify.atlassian.net/wiki/spaces/DEVTeam/pages/929333296/Test+Accounts+Automated";
        document.getElementById("registerButton").value  = "Register";
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function generatePass() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const allCharacters = alphabet + digits;

    // Randomly choose a length between 8 and 12
    const length = Math.floor(Math.random() * 5) + 8; // Will generate a number between 8 and 12

    let password = '';

    // Ensure at least one digit is included
    password += digits[Math.floor(Math.random() * digits.length)];

    // Generate the rest of the password
    for (let i = 1; i < length; i++) {
        password += allCharacters[Math.floor(Math.random() * allCharacters.length)];
    }

    // Shuffle to randomize the position of the digit
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    document.getElementById("emailSignUpPassword").value = password;
    return password;
}

// POPULATE DROP DOWN (ACADEMIC AREA)
function populateDropdown(data) {
    const selectElement = document.getElementById('academicArea');
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.id;
        selectElement.appendChild(option);
    });
}

// Function to fetch and process JSON data
function fetchAndPopulate() {
    const url = 'http://localhost:3001/getAcademicAreas';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            populateDropdown(data.academicAreas);
        })
        .catch(error => console.error('Error fetching data:', error));
}
// Fetch and populate on page load
fetchAndPopulate();


// Function to fetch user data for a given email
function fetchUserAccInfo(email) {
    const url = `http://localhost:3001/get-user-acc-info/${email}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}
function fetchUserData(playFabID) {
    const url = `http://localhost:3001/get-user-data/${playFabID}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playFabID }) 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}


// Function to generate the report
function generateReport() {
    const emailListText = document.getElementById("emailList").value;
    const emailList = emailListText.split('\n').filter(Boolean); // Split by newline and filter out empty strings
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = ''; // Clear out the existing rows

    // Helper function to delay execution
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    let userAccInfo;
    let userData;

    // Create an array of promises for fetching user data
    const fetchPromises = emailList.map((email, index) => {
        return delay(index * 1000) // Delay
            .then(() => fetchUserAccInfo(email))
            .then(respData => { userAccInfo = respData; })
            .then(() => fetchUserData(userAccInfo.data.UserInfo.PlayFabId))
            .then(respData => {
                //console.log("USER ACC:");
                //console.log(userAccInfo);
                userData = respData;
                console.log("USER DATA:");
                console.log(userData);
                let createdDate = new Date(userAccInfo.data.UserInfo.TitleInfo.Created);
                let lastLoginDate =  new Date(userAccInfo.data.UserInfo.TitleInfo.LastLogin);
                let today = new Date();
                let diffTime = Math.abs(today - createdDate);
                let daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let accountExpiryDate = new Date(userData.data.Data.TestAccountExpiryDate.Value);
                let diffTime2 = Math.abs(today - accountExpiryDate);
                let daysToExpire = Math.ceil(diffTime2 / (1000 * 60 * 60 * 24));

                // Append data to the table
                const row = tableBody.insertRow();
                addCellToRow(row, userAccInfo.data.UserInfo.PlayFabId);
                addCellToRow(row, email);
                addCellToRow(row, createdDate.toDateString());
                addCellToRow(row, lastLoginDate.toDateString());
                addCellToRow(row, daysSinceCreation);
                addCellToRow(row, accountExpiryDate.toDateString());
                addCellToRow(row, daysToExpire);

                if(daysToExpire < 7)
                {
                    row.style.backgroundColor = '#ffa500'; // Orange color
                }

                if (daysSinceCreation >= 2 && createdDate.toDateString() === lastLoginDate.toDateString())
                {
                    row.style.backgroundColor = '#fa8c8cab'; // Highlight the cell in red
                }
            })
            .catch(error => {
                console.error('Error:', error);
                const row = tableBody.insertRow();
                row.insertCell().textContent = 'Error for email: ' + email;
                row.insertCell().textContent = error.message;
                row.insertCell().colSpan = 3; // empty columns
                row.style.color = 'white';
                row.style.fontWeight = 'bold';
                row.style.backgroundColor = '#700000';
            });
    });

    // Wait for all the fetch calls to settle
    Promise.allSettled(fetchPromises).then(results => {
        console.log('All fetch calls have been processed');
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    });
}

function addCellToRow(row, text, colSpan = 1) {
    const cell = row.insertCell();
    cell.textContent = text;
    cell.style.textAlign = 'center';
    cell.colSpan = colSpan;
}