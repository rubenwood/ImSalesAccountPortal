const jsonForm = document.getElementById('json-form');
const qrForm = document.getElementById('qr-form');
const shortenURLForm = document.getElementById('shorten-url-form');
const jsonInput = document.getElementById('json-input');
const urlInput = document.getElementById('url-input');
const urlOutput = document.getElementById('url-output');
const shortURLOutput = document.getElementById('short-url');
const genshortURLQRCode = document.getElementById('gen-short-qr-btn');
const shortenURLBtn = document.getElementById('shorten-btn');
const qrCode = document.getElementById('qr-code');

jsonForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const jsonData = JSON.parse(jsonInput.value);
    const linkType = document.querySelector('input[name="linkType"]:checked').value;
    let link;

    switch (linkType) {
    case 'practical':
        link = constructPracticalLink(jsonData);
        break;
    case 'topic':
        link = constructTopicLink(jsonData);
        break;
    case 'lesson':
        link = constructLessonLink(jsonData);
        break;
    }
    urlOutput.textContent = link;
    urlInput.value = link;
});

qrForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = urlInput.value;
    await generateQRCode(url);
});

shortenURLBtn.addEventListener('click', () => shortenUrl(urlInput.value));
genshortURLQRCode.addEventListener('click', () => generateQRCode(shortURLOutput.value));

function constructPracticalLink(jsonData) {
    const { sceneName, sceneParams, id } = jsonData;
    const params = sceneParams.join(',');
    const baseLink = `immersifyeducation://immersifydental?loadScene=${sceneName}&sceneParams=[${params}]&activityID=${id}`;
    const encodedBaseLink = encodeURIComponent(baseLink);
    const fullLink = `https://immersifyeducation.com/deeplink?dl=%5B${encodedBaseLink}%5D`;
    return fullLink;
}

function constructTopicLink(jsonData) {
    const { id } = jsonData;
    const baseLink = `immersifyeducation://immersifydental?topic=${id}`;
    const encodedBaseLink = encodeURIComponent(baseLink);
    const fullLink = `https://immersifyeducation.com/deeplink?dl=%5B${encodedBaseLink}%5D`;
    return fullLink;
}

function constructLessonLink(jsonData) {
    const { sceneName, sceneParams, id } = jsonData;
    const params = sceneParams.join(',');
    const baseLink = `immersifyeducation://immersifydental?loadScene=${sceneName}&sceneParams=[${params}]&activityID=${id}`;
    const encodedBaseLink = encodeURIComponent(baseLink);
    const fullLink = `https://immersifyeducation.com/deeplink?dl=%5B${encodedBaseLink}%5D`;
    return fullLink;
}

async function shortenUrl(urlToShorten) {
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

async function generateQRCode(url) {
    const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/';
    const qrSize = '1000x1000';
    const encodedUrl = encodeURIComponent(url);

    const response = await fetch(`${apiUrl}?size=${qrSize}&data=${encodedUrl}`);

    if (response.ok) {
    const qrCodeUrl = response.url;
    qrCode.src = qrCodeUrl;
    qrCode.style.display = 'block';
    } else {
    alert('Error generating QR code');
    }
}