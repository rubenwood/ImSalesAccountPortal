// GET PLAYERS BY SUFFIX
export async function fetchPlayersBySuffixList(suffixList, page){
    const url = `/reporting/gen-suffix-rep?suffixes=${suffixList}`;

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