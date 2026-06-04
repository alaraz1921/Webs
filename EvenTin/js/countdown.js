(function () {
    const config = window.eventPlatformConfig;
    const eventContext = window.eventContext;
    let countdownTimer = null;

    const validPalettes = new Set(['earth', 'pastel', 'marine']);

    function normalizePalette(value) {
        return validPalettes.has(value) ? value : 'earth';
    }

    function valueOrFallback(value, fallback) {
        return value === null || value === undefined ? fallback : value;
    }

    function applyEvent(eventData, settings) {
        const fallback = config.fallbackEvent;
        const data = {
            title: valueOrFallback(settings?.main_title, valueOrFallback(eventData?.title, fallback.title)),
            subtitle: valueOrFallback(settings?.subtitle, fallback.subtitle),
            eventDate: valueOrFallback(eventData?.event_date, fallback.eventDate),
            displayDate: valueOrFallback(settings?.display_date, fallback.displayDate),
            displayTime: valueOrFallback(settings?.display_time, fallback.displayTime),
            place: valueOrFallback(eventData?.location_name, fallback.place),
            mapsUrl: valueOrFallback(eventData?.maps_url, fallback.mapsUrl),
            presentationTitle: valueOrFallback(settings?.presentation_title, fallback.presentationTitle),
            presentationText: valueOrFallback(settings?.presentation_text, fallback.presentationText),
            heroImageUrl: valueOrFallback(settings?.hero_image_url, ''),
            detailImageUrl: valueOrFallback(settings?.detail_image_url, ''),
            paletteKey: normalizePalette(valueOrFallback(settings?.palette_key, fallback.paletteKey || 'earth'))
        };

        document.body.dataset.palette = data.paletteKey;
        setText('[data-event-title]', data.title);
        setText('[data-event-subtitle]', data.subtitle);
        setText('[data-presentation-title]', data.presentationTitle);
        setText('[data-presentation-text]', data.presentationText);
        setText('[data-event-date]', data.displayDate);
        setText('[data-event-time]', data.displayTime);
        setText('[data-event-place]', data.place);

        const mapLink = document.querySelector('[data-event-map]');
        if (mapLink) {
            mapLink.href = data.mapsUrl;
        }

        setPanelImage('.hero', data.heroImageUrl);
        setPanelImage('.image-panel', data.detailImageUrl);
        startCountdown(data.eventDate);
    }

    function setText(selector, value) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    }

    function startCountdown(dateValue) {
        const target = new Date(dateValue).getTime();

        function render() {
            const distance = Math.max(0, target - Date.now());
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((distance / (1000 * 60)) % 60);
            const seconds = Math.floor((distance / 1000) % 60);

            setText('#count-days', pad(days));
            setText('#count-hours', pad(hours));
            setText('#count-minutes', pad(minutes));
            setText('#count-seconds', pad(seconds));
        }

        clearInterval(countdownTimer);
        render();
        countdownTimer = setInterval(render, 1000);
    }

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function setPanelImage(selector, imageUrl) {
        const element = document.querySelector(selector);

        if (element && imageUrl) {
            element.style.setProperty('--event-image-url', `url("${imageUrl}")`);
        }
    }

    async function loadEvent() {
        if (!eventContext || !eventContext.hasRequestedEvent()) {
            applyEvent({
                title: config.fallbackEvent.title,
                event_date: config.fallbackEvent.eventDate,
                location_name: config.fallbackEvent.place,
                maps_url: config.fallbackEvent.mapsUrl
            }, {
                main_title: config.fallbackEvent.title,
                subtitle: config.fallbackEvent.subtitle,
                display_date: config.fallbackEvent.displayDate,
                display_time: config.fallbackEvent.displayTime,
                presentation_title: config.fallbackEvent.presentationTitle,
                presentation_text: config.fallbackEvent.presentationText,
                palette_key: config.fallbackEvent.paletteKey || 'earth'
            });
            return;
        }

        const { event: eventData, settings } = await eventContext.getEvent();
        applyEvent(eventData, settings);
    }

    loadEvent().catch(() => {
        setText('[data-event-title]', 'Evento no encontrado');
        setText('[data-event-subtitle]', 'Revisa el enlace o el ID del evento.');
    });
})();
