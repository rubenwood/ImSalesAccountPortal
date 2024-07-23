const darkThemes = ['dark', 'Dark Mode'];

export function initializeDarkMode(toggleSwitchId) {
    // set to current theme
    handleThemeChange();
    // then set a listener to handle switching themes
    const darkModeSwitch = document.getElementById(toggleSwitchId);
    darkModeSwitch.addEventListener('change', function() {
        if (darkModeSwitch.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
        handleThemeChange();
    });
}

export function handleThemeChange() {
    const currentTheme = localStorage.getItem('theme');
    if (darkThemes.includes(currentTheme)) {
        document.body.classList.add('dark-mode');
        darkModeSwitch.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        darkModeSwitch.checked = false;
    }
}