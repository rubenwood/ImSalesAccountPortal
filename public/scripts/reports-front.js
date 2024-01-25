//import { canAccess } from "./access-check.js";

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
    document.getElementById('get-google-report-btn').addEventListener('click', fetchGoogleReport);
    document.getElementById('get-apple-report-btn').addEventListener('click', fetchAppleReport);

    // let hasAccess = await canAccess();
    // if(!hasAccess){ 
    //     console.log("cannot access this page");
    //     return;
    // }
});

export function GoogleLoginClicked(){
    console.log("test");
    //redirect to google login endpoint
    window.location.href = '/google/google-login';
}

function fetchGoogleReport() {
    fetch('/google/get-google-report')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text();
    })
    .then(csvText => {
        // Convert the CSV text to an HTML table
        const html = csvToHtmlTable(csvText);
        document.getElementById('output-area').innerHTML = html;
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    });
}
function fetchAppleReport() {
    fetch('/apple/get-subscription-report')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        // Assuming the output is a string or text
        return response.text();
    })
    .then(text => {
        // Display the response in some part of your webpage
        document.getElementById('output-area').textContent = text;
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    });
}

function csvToHtmlTable(csvText) {
    const rows = csvText.split('\n');
    let html = '<table>';

    for (let row of rows) {
        html += '<tr>';
        const cells = row.split(',');

        for (let cell of cells) {
            html += `<td>${cell}</td>`;
        }
        html += '</tr>';
    }

    html += '</table>';
    return html;
}
