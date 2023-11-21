document.getElementById('updateButton').addEventListener('click', function() {
    const pageId = '929333296'; // Replace with your page ID
    const url = `http://localhost:3001/update-confluence-page/${pageId}`;

    fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            // Add any other headers like authentication tokens here
        },
        body: JSON.stringify({
            // Your payload here if needed
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        // Handle success
    })
    .catch((error) => {
        console.error('Error:', error);
        // Handle errors
    });
});
