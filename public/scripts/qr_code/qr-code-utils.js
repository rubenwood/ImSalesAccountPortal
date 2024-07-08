export async function decodeQRCode(input) {
    const formData = new FormData();
    if (input instanceof File) {
        formData.append('file', input);
    } else if (typeof input === 'string') {
        formData.append('url', input);
    } else {
        console.error('Invalid input');
        return;
    }

    try {
        const response = await fetch('/qr/decode-qr', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (response.ok) {
            console.log(result.text);
            return result.text;
        } else {
            console.error('Error decoding QR code: ' + result.error);
        }
    } catch (error) {
        console.error('Error decoding QR code:', error);
    }
}

export async function generateQRCode(url) {
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