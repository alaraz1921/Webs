(function () {
    const minimumCompletionTime = 5000;
    const longLetterSequence = /\p{L}{19,}/u;
    const pageOpenedAt = window.performance?.timeOrigin || Date.now();

    function clean(value) {
        return String(value ?? '').trim();
    }

    function createGuard(form) {
        // Time protection: automated submissions usually arrive immediately after page load.
        return {
            validate(fields) {
                // Honeypot protection: real users never see or complete this field.
                if (clean(form.elements.website?.value)) {
                    return { blocked: true, silent: true };
                }

                if (Date.now() - pageOpenedAt < minimumCompletionTime) {
                    return {
                        blocked: true,
                        message: 'No se pudo enviar el mensaje. Espera unos segundos e inténtalo de nuevo.'
                    };
                }

                const name = clean(fields.name);
                const subject = fields.subject === undefined ? undefined : clean(fields.subject);
                const message = clean(fields.message);

                // Additional anti-spam validation runs before any request is sent.
                if (name.length < 2) {
                    return { blocked: true, message: 'El nombre debe tener al menos 2 caracteres.' };
                }
                if (subject !== undefined && subject.length < 4) {
                    return { blocked: true, message: 'El asunto debe tener al menos 4 caracteres.' };
                }
                if (message.length < 20) {
                    return { blocked: true, message: 'El mensaje debe tener al menos 20 caracteres.' };
                }
                if (!message.includes(' ')) {
                    return { blocked: true, message: 'El mensaje debe contener varias palabras.' };
                }
                if ([name, subject, message].filter(Boolean).some((value) => longLetterSequence.test(value))) {
                    return { blocked: true, message: 'Revisa el texto: contiene una secuencia demasiado larga sin espacios.' };
                }

                return { blocked: false };
            }
        };
    }

    window.eventAntiSpam = { createGuard };
})();
