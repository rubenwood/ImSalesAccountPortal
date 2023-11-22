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


const togglePassword = document.getElementById('togglePassword');
const passwordField = document.getElementById('emailSignUpPassword');

togglePassword.addEventListener('click', function (e) {
    // toggle the type attribute
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
    // toggle the eye / eye slash icon
    this.value = this.value === 'Show Password' ? 'Hide Password' : 'Show Password';
});