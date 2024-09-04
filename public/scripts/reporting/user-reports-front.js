const userSuffix = localStorage.getItem("suffix");

document.addEventListener('DOMContentLoaded', async() => {
    console.log(userSuffix);
    // login button on modal
    document.getElementById('loginButton').addEventListener('click', submitPass);
    
});
window.onload = function() {
    document.getElementById('loginModal').style.display = 'block';
};

async function submitPass() {
    let inPass = document.getElementById('password').value;
    
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

        const startDateInput = document.getElementById('startDateInput');
        const endDateInput = document.getElementById('endDateInput');
        startDateInput.addEventListener('change', function () {
            filterReports(startDateInput.value, endDateInput.value);
        });
        endDateInput.addEventListener('change', function () {
            filterReports(startDateInput.value, endDateInput.value);
        });
    
    } catch (err) {
        console.error("Error during authentication", err);
        document.getElementById('error-loading').innerHTML = 'Oops! An error occurred. Please try again later.';
    }
}

// Get Reports
let reportResponse = undefined;
async function getReports() {
    if(userSuffix == null || userSuffix == undefined){ 
        console.error("user has no suffix!"); 
        setNoReportHTML();
        return;
    }

    const inPass = document.getElementById('password').value;
    const response = await fetch(`/reporting/reports/${userSuffix}`, {
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
function formatHTMLOutput(reports) {
    let sectionHtml = {
        login: '<ul>',
        insights: '<ul>',
        progress: '<ul>',
        usage: '<ul>',
        combined: '<ul>'
    };
    
    reports.forEach(file => {
        const listItem = `<li><a href="${file.url}" download="${file.filename}">${file.filename}<i class="fa fa-download" aria-hidden="true"></i></a></li>`;
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
function filterReports(startDate, endDate) {
    // Convert the input dates to Date objects for comparison
    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;

    let reportsMatchingDate = reportResponse.filter(report => {
        let filename = report.filename;
        let dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/); // Regex to match the date part

        if (dateMatch) {
            let reportDate = new Date(dateMatch[0]);

            if ((start === null || reportDate >= start) && (end === null || reportDate <= end)) {
                return true;
            }
        }
        return false;
    });

    console.log("Reports matching date range: ", reportsMatchingDate);

    

    if (reportsMatchingDate.length <= 0) {
        setNoReportHTML();
    } else {
        formatHTMLOutput(reportsMatchingDate);
    }
}

function setNoReportHTML(){
    // Set "No Reports HTML here" if no reports match
    const noReportHTML = "<h1>No Reports</h1>";
    document.getElementById('login').innerHTML = noReportHTML;
    document.getElementById('insights').innerHTML = noReportHTML;
    document.getElementById('progress').innerHTML = noReportHTML;
    document.getElementById('usage').innerHTML = noReportHTML;
    document.getElementById('combined').innerHTML = noReportHTML;
}