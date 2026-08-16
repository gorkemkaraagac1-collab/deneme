
document.addEventListener('DOMContentLoaded', () => {
    // Active Link Logic
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll('.nav-links a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === 'index.html' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // Mobile Menu Toggle
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (toggle) {
        toggle.addEventListener('click', () => {
            links.classList.toggle('open');
            document.body.classList.toggle('menu-open');
        });
    }
});
