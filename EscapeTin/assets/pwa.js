(() => {
    const scriptUrl = new URL(document.currentScript.src);
    const swUrl = new URL("../sw.js", scriptUrl);
    let installPrompt = null;

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register(swUrl).catch((error) => console.warn("No se pudo registrar la PWA de EscapeTin.", error));
        });
    }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) return;

    const button = document.createElement("button");
    button.className = "install-app-button";
    button.type = "button";
    button.textContent = "Instalar";
    button.hidden = true;
    document.body.appendChild(button);

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        installPrompt = event;
        button.hidden = false;
    });

    button.addEventListener("click", async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        button.hidden = true;
    });
})();