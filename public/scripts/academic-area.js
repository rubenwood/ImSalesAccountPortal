import { canAccess } from './access-check.js';

export async function generateReportByArea()
{
    let hasAccess = await canAccess();
    if(!hasAccess){ return; }

    console.log("generate report by academic area clicked");

    let areas = document.getElementById("emailList").value.split('\n').filter(Boolean);
    if(areas.length < 1){ return; }

    resetButtonTexts();
    document.getElementById('generateReportByAreaButton').value = "Generating Report By Academic Area...";

    let output = await fetchPlayersByAreaList(areas.toString());
    console.log("total users in area: " + output.length);
    
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = '';
}

export async function fetchPlayersByAreaList(areaList){
    // once we know how many pages, we should make a loop 
    // and make this call with the right page index until there are no further pages
    const url = `/aca-area/gen-area-rep?areas=${areaList}`;

    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { 
                console.log(err);
                throw new Error(err.error || 'An error occurred');
            });
        }
        return response.json();
    });
}