import { decodeQRCode } from './qr-code-utils.js';

let shortURLOutput;
let qrCode;

document.addEventListener('DOMContentLoaded', () => {
    let JSONtoURLBtn = document.getElementById('convert-json-url-btn');
    let qrBtn = document.getElementById('generate-qr-btn');
    //let shortenURLForm = document.getElementById('shorten-url-form');
    let jsonInput = document.getElementById('json-input');
    let urlInput = document.getElementById('url-input');    
    let genshortURLQRCode = document.getElementById('gen-short-qr-btn');
    let shortenURLBtn = document.getElementById('shorten-btn');
    shortURLOutput = document.getElementById('short-url');
    qrCode = document.getElementById('qr-code');

    JSONtoURLBtn.addEventListener('click', (event) => {
        event.preventDefault();
        const jsonData = JSON.parse(jsonInput.value);
        const linkType = document.querySelector('input[name="linkType"]:checked').value;
        let link;
    
        switch (linkType) {
            case 'practical':
                link = constructPracticalOrLessonLink(jsonData);
                break;
            case 'topic':
                link = constructTopicLink(jsonData);
                break;
            case 'lesson':
                link = constructPracticalOrLessonLink(jsonData);
                break;
        }
        urlInput.value = link;
        console.log("called");
    });
    
    qrBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        const url = urlInput.value;
        await generateQRCode(url);
    });

    shortenURLBtn.addEventListener('click', () => shortenUrl(urlInput.value));
    genshortURLQRCode.addEventListener('click', () => generateQRCode(shortURLOutput.value));

    // DECODE QR CODE
    document.getElementById('file-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            decodeQRCode(file);
        }
    });
});

function constructPracticalOrLessonLink(jsonData) {
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