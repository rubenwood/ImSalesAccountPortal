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
            // Assuming 'data' is the JSON object with your academic areas
            populateDropdown(data.academicAreas);
        })
        .catch(error => console.error('Error fetching data:', error));
}
// Fetch and populate on page load
fetchAndPopulate();


// Function to fetch user data for a given email
function fetchUserData(email) {
    const url = `http://localhost:3001/get-user-data/${email}`;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok for email ' + email);
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

    // Create an array of promises for fetching user data
    const fetchPromises = emailList.map((email, index) => {
        return delay(index * 1000) // Delay increases with each email to stagger the requests
            .then(() => fetchUserData(email))
            .then(respData => {
                let createdDate = new Date(respData.data.UserInfo.TitleInfo.Created);
                let lastLoginDate =  new Date(respData.data.UserInfo.TitleInfo.LastLogin);
                let today = new Date();
                let diffTime = Math.abs(today - createdDate);
                let daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                // Append data to the table
                const row = tableBody.insertRow();
                row.insertCell().textContent = respData.data.UserInfo.PlayFabId;
                row.insertCell().textContent = email;
                row.insertCell().textContent = createdDate.toDateString();
                row.insertCell().textContent = lastLoginDate.toDateString();
                row.insertCell().textContent = daysSinceCreation;
            })
            .catch(error => {
                // Log the error or display it on the UI
                console.error('Error:', error);
                const row = tableBody.insertRow();
                row.insertCell().textContent = 'Error for email: ' + email;
                row.insertCell().colSpan = 3;
                row.insertCell().textContent = error.message;
            });
    });

    // Wait for all the fetch calls to settle
    Promise.allSettled(fetchPromises).then(results => {
        console.log('All fetch calls have been processed');
        // Actions after all fetches are done, like hiding a loading indicator
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    });
}