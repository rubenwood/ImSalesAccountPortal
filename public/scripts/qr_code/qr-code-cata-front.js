
async function decodeQRCode(input) {
    const formData = new FormData();
    if (input instanceof File) {
        formData.append('file', input);
    } else if (typeof input === 'string') {
        formData.append('url', input);
    } else {
        alert('Invalid input');
        return;
    }

    try {
        const response = await fetch('/qr/decode-qr', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (response.ok) {
            alert('Decoded text: ' + result.text);
        } else {
            alert('Error decoding QR code: ' + result.error);
        }
    } catch (error) {
        console.error('Error decoding QR code:', error);
        alert('Error decoding QR code');
    }
}

function decodeQRCodeFromTable(imageSrc) {
    decodeQRCode(imageSrc);
}
