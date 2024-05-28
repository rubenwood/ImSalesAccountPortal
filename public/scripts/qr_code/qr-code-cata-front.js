document.addEventListener('DOMContentLoaded', () => {
    setupPage();
});

async function setupPage(){
    let dbData = await fetchQRDLData();
    generateReport(dbData);
}

function generateReport(data) {
    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = ''; // Clear existing rows

    data.forEach(item => {
        // Add Deeplink, QR Code, Decode row
        const mainHeaderRow = document.createElement('tr');
        mainHeaderRow.innerHTML = `
            <td><b>Deeplink</b></td>
            <td><b>QR Code</b></td>
            <td><b>Decode</b></td>
        `;
        tableBody.appendChild(mainHeaderRow);

        // Add main row
        const mainRow = document.createElement('tr');
        mainRow.innerHTML = `
            <td><a href="${item.deeplink}" target="_blank">${item.deeplink}</a></td>
            <td><img src="${item.qr_code_url}" alt="QR Code"></td>
            <td><button onclick="decodeQRCodeFromTable('${item.qr_code_url}')">Decode</button></td>
        `;
        tableBody.appendChild(mainRow);

        // Add Area row
        const areaRow = document.createElement('tr');
        areaRow.innerHTML = `
            <td><b>Area</b></td>
            <td colspan="2">${item.area}</td>
        `;
        tableBody.appendChild(areaRow);

        // Add Module row
        const moduleRow = document.createElement('tr');
        moduleRow.innerHTML = `
            <td><b>Module</b></td>
            <td colspan="2">${item.module}</td>
        `;
        tableBody.appendChild(moduleRow);

        // Add Topic row
        const topicRow = document.createElement('tr');
        topicRow.innerHTML = `
            <td><b>Topic</b></td>
            <td colspan="2">${item.topic}</td>
        `;
        tableBody.appendChild(topicRow);

        // Add Activity row
        const activityRow = document.createElement('tr');
        activityRow.innerHTML = `
            <td><b>Activity</b></td>
            <td colspan="2">${item.activity}</td>
        `;
        tableBody.appendChild(activityRow);

        // Add empty row for spacing
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="3">&nbsp;</td>`;
        tableBody.appendChild(emptyRow);
    });
}

async function fetchQRDLData() {
    try {
        const response = await fetch('/qrdb/get-all-dl-qr');
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

async function decodeQRCode(input) {
    const formData = new FormData();
    if (input instanceof File) {
        formData.append('file', input);
    } else if (typeof input === 'string') {
        formData.append('url', input);
    } else {
        console.error('Invalid input');
        return;
    }

    try {
        const response = await fetch('/qr/decode-qr', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (response.ok) {
            console.log(result.text);
        } else {
            console.error('Error decoding QR code: ' + result.error);
        }
    } catch (error) {
        console.error('Error decoding QR code:', error);
    }
}

function decodeQRCodeFromTable(imageSrc) {
    decodeQRCode(imageSrc);
}