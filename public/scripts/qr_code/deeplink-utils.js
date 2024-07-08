// LINK SHORTEN
export async function shortenUrl(urlToShorten) {
    try {
        const requestBody = JSON.stringify({ url: urlToShorten });

        const response = await fetch('/bitly/shorten-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody
        });

        if (!response.ok) {
        throw new Error('Failed to shorten URL. Status: ' + response.status);
        }

        const result = await response.json();
        //console.log('Shortened URL:', result.shortenedUrl);
        shortURLOutput.value = result.shortenedUrl;
        return result.shortenedUrl;
    } catch (error) {
        console.error('Error shortening URL:', error);
        return null;
    }
}