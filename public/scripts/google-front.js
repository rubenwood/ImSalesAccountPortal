document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('google-login-btn').addEventListener('click', GoogleLoginClicked);
});
export function GoogleLoginClicked(){
    console.log("test");
}