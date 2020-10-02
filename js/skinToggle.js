$(function() {
    $('#change-skin').on('click', function () {
        let current = document.documentElement.getAttribute('data-theme');
        if (current === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });
});