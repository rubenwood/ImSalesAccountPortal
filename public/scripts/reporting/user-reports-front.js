 //const doConfetti = () => { confetti({particleCount: 100, spread: 70, origin:{ y: 0.6 }}); }

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
            //doConfetti(); // Show confetti on successful login
            getReports();
        } else {
            console.log("Access denied");
            document.getElementById('error-txt').innerHTML = 'Incorrect password. Please try again.';
        }
    } catch (err) {
        console.error("Error during authentication", err);
        document.getElementById('error-loading').innerHTML = 'Oops! An error occurred. Please try again later.';
    }
}

async function getReports() {
    let inPass = document.getElementById('password').value;
    let response = await fetch('/reporting/reports/highpoint.edu', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-secret-key': inPass
        }
    });

    let result = await response.json();
    console.log(result);
    let sectionHtml = {
        login: '<ul>',
        insights: '<ul>',
        progress: '<ul>',
        usage: '<ul>',
        combined: '<ul>'
    };
    
    result.forEach(file => {
        let listItem = `<li><a href="${file.url}" download="${file.filename}">${file.filename}<i class="fa fa-download" aria-hidden="true"></i></a></li>`;
        console.log(file.filename);
        if (file.filename.includes('-Login-')) {
            sectionHtml.login += listItem;
        } else if (file.filename.includes('-Insights-')) {
            sectionHtml.insights += listItem;
        } else if (file.filename.includes('-Progress-')) {
            sectionHtml.progress += listItem;
        } else if (file.filename.includes('-Usage-')) {
            sectionHtml.usage += listItem;
        } else if (file.filename.includes('-Combined-')) {
            sectionHtml.combined += listItem;
        }
    });

    for (let key in sectionHtml) {
        sectionHtml[key] += '</ul>';
    }
    document.getElementById('login').innerHTML = sectionHtml.login;
    document.getElementById('insights').innerHTML = sectionHtml.insights;
    document.getElementById('progress').innerHTML = sectionHtml.progress;
    document.getElementById('usage').innerHTML = sectionHtml.usage;
    document.getElementById('combined').innerHTML = sectionHtml.combined;

    //document.getElementById('login').innerHTML += responseHtml;
}
