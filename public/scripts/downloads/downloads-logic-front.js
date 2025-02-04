document.addEventListener('DOMContentLoaded', async() => {    
    // download
    document.getElementById('windows-download-btn')?.addEventListener('click', () => download("windows"));
    document.getElementById('mac-download-btn')?.addEventListener('click', () => download("mac"));
});
// DOWNLOAD
async function download(platform){
    const resp = await fetch('/S3/s3GetDownloadURLs', {
        method: 'GET',
        headers: {
            'ticket': `${localStorage.getItem('ticket')}`
        }
    });
    const respURLs = await resp.json();

    const downloadLink = document.createElement('a');
    if(platform === 'mac'){
        downloadLink.href = respURLs.macURLs[0].url;
    }else{
        downloadLink.href = respURLs.windowsURLs[0].url;
    }    
    downloadLink.click();
}