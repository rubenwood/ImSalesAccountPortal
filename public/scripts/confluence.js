// public button event, when clicked, updates confluence page
export function callUpdateConfluencePage(email, pass, area, expiry, createdBy, reason){
    const pageId = '929333296';
    const url = `/confluence/update-confluence-page/${pageId}`;

    fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, pass, area, expiry, createdBy, reason }) 
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        //console.log('Success:', data);
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        document.getElementById("resultOutput").innerHTML = "Account Created, Data added, confluence page updated:\nhttps://immersify.atlassian.net/wiki/spaces/DEVTeam/pages/929333296/Test+Accounts+Automated";
        document.getElementById("registerButton").value  = "Register";
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}