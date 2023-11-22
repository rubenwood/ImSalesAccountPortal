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
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// HIDE / SHOW password
//const togglePassword = document.getElementById('togglePassword');
//const passwordField = document.getElementById('emailSignUpPassword');
// togglePassword.addEventListener('click', function (e) {
//     const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
//     passwordField.setAttribute('type', type);
//     this.value = this.value === 'Show Password' ? 'Hide Password' : 'Show Password';
// });


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