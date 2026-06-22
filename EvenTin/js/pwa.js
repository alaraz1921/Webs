let eventinInstallPrompt = null;

function eventinIsStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

function eventinIsIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
        || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function eventinShowInstallHelp() {
    const modal = document.createElement('div');
    modal.className = 'eventin-pwa-modal';
    modal.innerHTML = `
        <div class="eventin-pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="eventin-pwa-title">
            <h2 id="eventin-pwa-title">Instalar EvenTin</h2>
            <p>En iPhone o iPad puedes instalar esta web desde Safari:</p>
            <ol>
                <li>Pulsa el botón Compartir.</li>
                <li>Selecciona "Añadir a pantalla de inicio".</li>
                <li>Confirma la instalación.</li>
            </ol>
            <button type="button" class="eventin-pwa-close">Entendido</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.eventin-pwa-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
    });
}

function eventinCreateInstallButton() {
    if (eventinIsStandalone() || document.querySelector('.eventin-pwa-install')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'eventin-pwa-install';
    button.textContent = 'Instalar aplicación';
    button.hidden = !eventinInstallPrompt && !eventinIsIos();
    document.body.appendChild(button);

    button.addEventListener('click', async () => {
        if (eventinIsIos() && !eventinInstallPrompt) {
            eventinShowInstallHelp();
            return;
        }

        if (!eventinInstallPrompt) return;

        eventinInstallPrompt.prompt();
        const choice = await eventinInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            button.hidden = true;
        }
        eventinInstallPrompt = null;
    });
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    eventinInstallPrompt = event;
    const button = document.querySelector('.eventin-pwa-install');
    if (button && !eventinIsStandalone()) button.hidden = false;
});

window.addEventListener('appinstalled', () => {
    eventinInstallPrompt = null;
    const button = document.querySelector('.eventin-pwa-install');
    if (button) button.hidden = true;
});

document.addEventListener('DOMContentLoaded', () => {
    eventinCreateInstallButton();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/EvenTin/sw.js', { scope: '/EvenTin/' }).catch((error) => {
                console.warn('No se pudo registrar la PWA de EvenTin.', error);
            });
        });
    }
});
