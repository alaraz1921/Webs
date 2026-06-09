(function () {
    const eventAccessForm = document.getElementById('event-access-form');
    const eventAccessStatus = document.getElementById('event-access-status');

    function showStatus(message, isError) {
        eventAccessStatus.textContent = message;
        eventAccessStatus.classList.toggle('error', Boolean(isError));
    }

    eventAccessForm.addEventListener('submit', (event) => {
        event.preventDefault();
        showStatus('', false);

        const formData = new FormData(eventAccessForm);
        const eventCode = String(formData.get('event_code') || '').replace(/\D/g, '');

        if (!/^\d{6}$/.test(eventCode)) {
            showStatus('Introduce un ID de 6 digitos.', true);
            return;
        }

        window.location.href = `evento.html?evento=${encodeURIComponent(eventCode)}`;
    });
})();
