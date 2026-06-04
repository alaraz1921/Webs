const menuBtn = document.getElementById('mobile-menu-btn');
const menuList = document.getElementById('nav-menu-list');
const navbar = document.getElementById('main-navbar');
const contactEmail = 'alaraz1921@gmail.com';

function cerrarMenuMovil() {
    menuBtn.classList.remove('open');
    menuList.classList.remove('mobile-open');
}

menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('open');
    menuList.classList.toggle('mobile-open');
});

menuList.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', cerrarMenuMovil);
});

function enviarContacto(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const nombre = String(formData.get('name')).trim();
    const email = String(formData.get('email')).trim();
    const asunto = String(formData.get('subject')).trim();
    const mensaje = String(formData.get('message')).trim();
    const body = [
        `Nombre: ${nombre}`,
        `Email: ${email}`,
        '',
        mensaje
    ].join('\n');

    const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    form.reset();
}

window.addEventListener('scroll', () => {
    if (window.innerWidth > 768) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
});
