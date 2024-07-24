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

export async function genQRCode(url) {
    const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/';
    const qrSize = '1000x1000';
    //const decodedUrl = decodeURI(url); // decode it, then re-encode it to be sure
    const encodedUrl = encodeURIComponent(url);

    const response = await fetch(`${apiUrl}?size=${qrSize}&data=${encodedUrl}`);
    
    return response.url;
}

export async function generateQRCodesAndUpload(URLList) {
    console.log(URLList);
    let qrCodeUrls = [];

    try {
        const uploadPromises = URLList.map((url) => async () => {
            let qrCodeUrl = await genQRCode(url.link);
            const response = await fetch(qrCodeUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('image', blob, `${url.imgName}.jpg`);
            formData.append('acl', 'public-read'); // make the QR Code images public

            const uploadResponse = await fetch('/s3upload', {
                method: 'POST',
                body: formData
            });

            if (uploadResponse.ok) {
                const result = await uploadResponse.json();
                console.log('Image uploaded successfully', result);
                let qrCodeS3Url = result.data.Location;
                return { imgName: url.imgName, qrCodeS3Url };
            } else {
                console.error('Error uploading image:', uploadResponse.statusText);
                throw new Error(`Error uploading image: ${uploadResponse.statusText}`);
            }
        });

        qrCodeUrls = await limitedConcurrentPromises(uploadPromises, 100);
    } catch (error) {
        console.error('Error:', error);
    }

    return qrCodeUrls;
}

async function limitedConcurrentPromises(tasks, limit) {
    const results = [];
    const executing = new Set();

    for (const task of tasks) {
        const p = Promise.resolve().then(() => task());
        results.push(p);

        const e = p.then(() => executing.delete(e));
        executing.add(e);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}