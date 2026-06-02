(function () {
    const config = window.eventPlatformConfig;
    const client = window.eventSupabase;
    const eventId = config.defaultEventId;
    let countdownTimer = null;

    function applyEvent(eventData, settings) {
        const fallback = config.fallbackEvent;
        const data = {
            title: eventData?.title || fallback.title,
            subtitle: settings?.subtitle || fallback.subtitle,
            eventDate: eventData?.event_date || fallback.eventDate,
            displayDate: settings?.display_date || fallback.displayDate,
            displayTime: settings?.display_time || fallback.displayTime,
            place: eventData?.location_name || fallback.place,
            mapsUrl: eventData?.maps_url || fallback.mapsUrl,
            presentationTitle: settings?.presentation_title || fallback.presentationTitle,
            presentationText: settings?.presentation_text || fallback.presentationText
        };

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

    async function loadEvent() {
        if (!client) {
            applyEvent(null, null);
            return;
        }

        const [{ data: eventData }, { data: settings }] = await Promise.all([
            client.from('eventin_events').select('title,event_date,location_name,maps_url').eq('id', eventId).maybeSingle(),
            client.from('eventin_event_settings').select('subtitle,display_date,display_time,presentation_title,presentation_text').eq('event_id', eventId).maybeSingle()
        ]);

        applyEvent(eventData, settings);
    }

    loadEvent().catch(() => applyEvent(null, null));
})();
