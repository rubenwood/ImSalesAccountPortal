export async function fetchUsersByID(playerIDList, page){
    try {
        const response = await fetch('/db/get-users-by-id', {
            method: 'POST',
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

export async function fetchUsersByEmail(playerEmailList, page){
    try {
        const response = await fetch('/db/get-users-by-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playerEmails: playerEmailList }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return response.json();
    }catch(error){
        console.error('Error:', error);
    }
}