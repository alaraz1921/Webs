const challengeText = document.querySelector("#challenge-text");
const challengeButtons = document.querySelectorAll("[data-challenge]");
const copy = {
    pistas: "Busca senales, flechas, sobres y objetos raros para desbloquear la siguiente prueba.",
    codigos: "Descifra numeros, simbolos y palabras clave antes de que el reloj llegue a cero.",
    movimiento: "Salta, corre, apunta, encuentra y coopera: la aventura tambien se gana con energia.",
    final: "Reune todas las piezas, abre el ultimo mensaje y celebra la victoria del equipo."
};

challengeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        challengeButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        challengeText.textContent = copy[button.dataset.challenge];
    });
});

const revealItems = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.18 });

revealItems.forEach((item) => observer.observe(item));
