export async function fetchUsersByID(playerIDList, page){
    try {
        const response = await fetch('/db/get-users-by-id', {
            method: 'POST', // Using POST since we're sending a payload
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playFabIds: playerIDList }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    }catch(error){
        console.error('Error:', error);
    }
}