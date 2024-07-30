const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

document.addEventListener('DOMContentLoaded', async() => {
    // login button on modal
    document.getElementById('loginButton').addEventListener('click', submitPass);
    
});
window.onload = function()
{
    document.getElementById('loginModal').style.display = 'block';
};

async function submitPass()
{
    let inPass = document.getElementById('password').value;
    
    console.log("submit pass clicked");
    try {
        let response = await fetch('/reporting/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pass: inPass })
        });

        let result = await response.json();

        if (result === true) {
            console.log("Access granted");
            // Here you can add your code to grant access, e.g., redirect to another page
            document.getElementById('loginModal').style.display = 'none';
            doConfetti(); // Show confetti on successful login
            getReports();
        } else {
            console.log("Access denied");
            // Here you can handle access denial, e.g., show an error message
            alert('Incorrect password. Please try again.');
        }
    } catch (err) {
        console.error("Error during authentication", err);
        alert('An error occurred. Please try again later.');
    }
}

async function getReports() {
    let response = await fetch('/reporting/reports/immersifyeducation.com', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    let result = await response.json();
    console.log(result);

    let responseHtml = '<ul>';
    result.forEach(file => {
        responseHtml += `<li><a href="${file.url}" download="${file.filename}">${file.filename}</a></li>`;
    });
    responseHtml += '</ul>';

    document.getElementById('reports-content').innerHTML += responseHtml;
}
