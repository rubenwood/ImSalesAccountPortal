document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
    document.getElementById('get-google-report-btn').addEventListener('click', fetchGoogleReport);
    document.getElementById('get-apple-report-btn').addEventListener('click', fetchAppleReport);
});
window.onload = function() {
    //document.getElementById('loginModal').style.display = 'block';
};

export function GoogleLoginClicked(){
    //redirect to google login endpoint
    window.location.href = '/google/google-login';
}

function fetchGoogleReport() {
    /*fetch('/google/get-google-report')
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
    });*/

    fetch('/google/get-kpi-report')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(respJson => {
        //const html = csvToHtmlTable(csvText);
        setupReportTable(respJson);
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        document.getElementById('output-area').textContent = 'Error fetching data: ' + error.message;
    });
}

function setupReportTable(jsonInput){
    let table = document.getElementById('reportTable');
    
    // if (jsonInput.activeUsersPerMonth) {
    //     let newUsersCell = table.querySelector("#activeUsersPerMonth");
    //     if (newUsersCell) newUsersCell.innerText = jsonInput.activeUsersPerMonth;
    // }

    if (jsonInput.newUsersPerWeek) { // done (New Users Per Week)
        let newUsersCell = table.querySelector("#newUsersPerWeek");
        if (newUsersCell) newUsersCell.innerText = jsonInput.newUsersPerWeek;
    }

    if (jsonInput.activeUsersPerMonth) { // done (New Users Per Week)
        let newUsersCell = table.querySelector("#MAU");
        // last months MAU
        if (newUsersCell) newUsersCell.innerText = JSON.stringify(jsonInput.activeUsersPerMonth[jsonInput.activeUsersPerMonth.length-2]);
    }

    if (jsonInput.sessionsPerUserPerWeek) { // done (Total Sessions Per Active User)
        let newUsersCell = table.querySelector("#sessionsPerUserPerWeek");
        if (newUsersCell) newUsersCell.innerText = jsonInput.sessionsPerUserPerWeek;
    }

    if (jsonInput.activitiesLaunchedPerWeek) { // done (Total Experiences Played)
        let newUsersCell = table.querySelector("#activitiesLaunchedPerWeek");
        if (newUsersCell) newUsersCell.innerText = jsonInput.activitiesLaunchedPerWeek;
    }


    document.getElementById('output-area').innerHTML = JSON.stringify(jsonInput);

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
