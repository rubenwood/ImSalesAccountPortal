export async function decodeQRCode(input){
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

export async function generateQRCode(url){
    const response = await genQRCode(url);

    if (response.ok) {
        const qrCodeUrl = response.url;
        qrCode.src = qrCodeUrl;
        qrCode.style.display = 'block';
    } else {
        alert('Error generating QR code');
    }
}

async function genQRCode(url) {
    const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/';
    const qrSize = '1000x1000';
    const encodedUrl = encodeURIComponent(url);

    const response = await fetch(`${apiUrl}?size=${qrSize}&data=${encodedUrl}`);
    console.log(response);
    const qrCodeUrl = response.url;
    return qrCodeUrl;
}

export async function generateQRCodesAndUpload(URLList) {
    console.log(URLList);
    try {
        //let qrCodeUrls = [];
        let i = 0; // temp, change this eventually
        for(let url of URLList){
            console.log(url);
            let qrCodeUrl = await genQRCode(url);
            //qrCodeUrls.push(qrCodeUrl);

            const response = await fetch(qrCodeUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('image', blob, `image_${i}.jpg`);

            const uploadResponse = await fetch('/s3upload', {
                method: 'POST',
                body: formData
            });

            if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                console.log('Image uploaded successfully', result);
            } else {
                console.error('Error uploading image:', uploadResponse.statusText);
            }
            
            i++;
        }

        
    } catch (error) {
        console.error('Error:', error);
    }
}