const revealElements = document.querySelectorAll('[data-reveal]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function mostrarElemento(element) {
    element.classList.add('is-revealed');
}

if (reduceMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach(mostrarElemento);
} else {
    document.body.classList.add('reveal-enabled');

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const delay = Number(entry.target.dataset.revealDelay || 0);
            entry.target.style.setProperty('--reveal-delay', `${delay}ms`);
            mostrarElemento(entry.target);
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
    });

    revealElements.forEach((element) => revealObserver.observe(element));
}
