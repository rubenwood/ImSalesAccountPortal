export function initializeDarkMode(toggleSwitchId) {
    const darkModeSwitch = document.getElementById(toggleSwitchId);
    const currentTheme = localStorage.getItem('theme');
    // TODO: api call to get all themes?
    const darkThemes = ['dark', 'Dark Mode'];

    if (darkThemes.includes(currentTheme)) {
        document.body.classList.add('dark-mode');
        darkModeSwitch.checked = true;
    }

    darkModeSwitch.addEventListener('change', function() {
        if (darkModeSwitch.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    });
}