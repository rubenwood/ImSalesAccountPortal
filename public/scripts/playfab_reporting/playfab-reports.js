// Utility function to parse CSV and map it to JSON objects with camelCase property names
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const keys = parseCSVLine(lines[0]);

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        return keys.reduce((object, key, index) => {
            object[key.trim().replace(/\s+/g, '_')] = values[index].trim();
            return object;
        }, {});
    });
}

function parseCSVLine(line) {
    const values = [];
    let inQuotes = false;
    let valueStart = 0;

    for (let i = 0; i <= line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if ((line[i] === ',' && !inQuotes) || i === line.length) {
            let value = line.substring(valueStart, i).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            values.push(value);
            valueStart = i + 1;
        }
    }

    return values;
}
  
function getCohortDate() {
    const today = new Date();  
    today.setHours(0, 0, 0, 0);
  
    const cohortDate = new Date(today.setDate(today.getDate() - 31));
  
    const year = cohortDate.getFullYear();
    const month = String(cohortDate.getMonth() + 1).padStart(2, '0');
    const day = String(cohortDate.getDate()).padStart(2, '0');
    let output = `${year}-${month}-${day}T00:00:00.0000000`;
    return output;
}

export async function getPlayFab30DayReport() {
    console.log("Getting 30 day report from Playfab");

    const reportName = "Thirty Day Retention Report";

    // Calculate the date 30 days ago from today
    const today = new Date();
    const yesterday = new Date(today.setDate(today.getDate() - 1));
    const day = yesterday.getDate();
    const month = yesterday.getMonth() + 1; // JavaScript months are 0-indexed
    const year = yesterday.getFullYear();

    const playFabResponse = await fetch('/get-playfab-report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ReportName: reportName,
            day, month, year
        })
    });

    if (!playFabResponse.ok) {
        throw new Error(`PlayFab Response was not ok: ${playFabResponse.statusText}`);
    }

    const csvText = await playFabResponse.text();
    const data = parseCSV(csvText);

    const cohortDate = getCohortDate();
    const filteredAndSortedData = data
        .filter(row => row.Cohort.startsWith(cohortDate))
        .sort((a, b) => parseInt(a['Days_Later']) - parseInt(b['Days_Later']));

    // CHANGE THIS (move to report-front)
    let table = document.getElementById('reportTable');
    let dataCell = table.querySelector("#userRetentionPlayfab");
    if (dataCell) {
        dataCell.innerText = `Day 1: ${filteredAndSortedData[1]?.Percent_Retained ?? 'N/A'}%
        Day 2: ${filteredAndSortedData[2]?.Percent_Retained ?? 'N/A'}%
        Day 30: ${filteredAndSortedData[30]?.Percent_Retained ?? 'N/A'}%`;
    }
}

// Gets the monthly total report
export async function getPlayFabMonthlyTotalsReport(month, year) {
    console.log("Getting Monthly report from Playfab");

    const reportName = "Monthly Totals Report";
    const day = 1; // always first of month for monthly reports

    const playFabResponse = await fetch('/get-playfab-report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ReportName: reportName,
            day, month, year
        })
    });

    if (!playFabResponse.ok) {
        throw new Error(`PlayFab Response was not ok: ${playFabResponse.statusText}`);
    }

    const respText = await playFabResponse.text();
    const data = parseCSV(respText);

    // Assuming the first row of the data contains the metrics you need
    // Adjust the property names according to your actual CSV format
    let MAU = data.find(row => row.Unique_Logins !== undefined)?.Unique_Logins ?? 'N/A';
    //console.log("PF MAU: ", MAU);
    return MAU;
}