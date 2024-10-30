export async function fetchNewReturningUsers(startDate, endDate) {
    const response = await fetch('/userdata/get-new-returning-users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startDate, endDate })
    });

    if (!response.ok) {
        throw new Error('Failed to fetch new and returning users');
    }

    return await response.json();
}