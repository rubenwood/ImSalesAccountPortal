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
        
        if (result != true) {
            console.log("Access denied");
            document.getElementById('error-txt').innerHTML = 'Incorrect password. Please try again.';
            return;
        }
        
        document.getElementById('loginModal').style.display = 'none';
        getReports();

        const dateInput = document.getElementById('dateInput');
        dateInput.addEventListener('change', function () {
            filterReports(dateInput.value);
        });
    
    } catch (err) {
        console.error("Error during authentication", err);
        document.getElementById('error-loading').innerHTML = 'Oops! An error occurred. Please try again later.';
    }
}

// Get Reports
let reportResponse = undefined;
async function getReports() {
    const inPass = document.getElementById('password').value;
    const response = await fetch('/reporting/reports/highpoint.edu', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-secret-key': inPass
        }
    });

    const result = await response.json();
    reportResponse = result;
    console.log(result);
    formatHTMLOutput(reportResponse);
}

// format HTML
function formatHTMLOutput(reports){
    let sectionHtml = {
        login: '<ul>',
        insights: '<ul>',
        progress: '<ul>',
        usage: '<ul>',
        combined: '<ul>'
    };
    
    reports.forEach(file => {
        const listItem = `<li><a href="${file.url}" download="${file.filename}">${file.filename}<i class="fa fa-download" aria-hidden="true"></i></a></li>`;
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

    for (const key in sectionHtml) {
        sectionHtml[key] += '</ul>';
    }
    document.getElementById('login').innerHTML = sectionHtml.login;
    document.getElementById('insights').innerHTML = sectionHtml.insights;
    document.getElementById('progress').innerHTML = sectionHtml.progress;
    document.getElementById('usage').innerHTML = sectionHtml.usage;
    document.getElementById('combined').innerHTML = sectionHtml.combined;
}

// Filter Reports
function filterReports(inDate) {
    console.log("DATE SET TO: " + inDate);
    console.log("Report Response ", reportResponse);

    if(inDate == undefined || inDate == ""){
        formatHTMLOutput(reportResponse);
        return;
    }

    let reportsMatchingDate = reportResponse.filter(report => {
        let filename = report.filename;
        let dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/); // Regex to match the date part
        
        if (dateMatch) {
            let reportDate = dateMatch[0];
            return reportDate === inDate;
        }        
        return false; 
    });

    console.log("Reports matching date: ", reportsMatchingDate);
    if(reportsMatchingDate.length <= 0 ){ 
        document.getElementById('login').innerHTML = "<h1>No Reports</h1>";
        document.getElementById('insights').innerHTML = "<h1>No Reports</h1>";
        document.getElementById('progress').innerHTML = "<h1>No Reports</h1>";
        document.getElementById('usage').innerHTML = "<h1>No Reports</h1>";
        document.getElementById('combined').innerHTML = "<h1>No Reports</h1>";
    }
    else
    {
        formatHTMLOutput(reportsMatchingDate);
    }
}
//4yKxvmN87PVZRJB