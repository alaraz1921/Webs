(function () {
    const config = window.eventPlatformConfig;
    const client = window.eventSupabase;
    let eventPromise = null;

    function getRequestedEventKey() {
        const params = new URLSearchParams(window.location.search);
        return String(params.get('evento') || '').trim();
    }

    function hasRequestedEvent() {
        return Boolean(getRequestedEventKey());
    }

    function buildEventUrl(pageName, eventKey) {
        const activeEventKey = eventKey || getRequestedEventKey();
        const query = activeEventKey ? `?evento=${encodeURIComponent(activeEventKey)}` : '';
        return `${pageName}${query}`;
    }

    function getFallbackEvent() {
        return {
            event: {
                id: config.defaultEventId,
                title: config.fallbackEvent.title,
                event_date: config.fallbackEvent.eventDate,
                location_name: config.fallbackEvent.place,
                maps_url: config.fallbackEvent.mapsUrl,
                public_slug: config.defaultEventSlug,
                event_code: config.defaultEventCode
            },
            settings: {
                main_title: config.fallbackEvent.title,
                subtitle: config.fallbackEvent.subtitle,
                display_date: config.fallbackEvent.displayDate,
                display_time: config.fallbackEvent.displayTime,
                presentation_title: config.fallbackEvent.presentationTitle,
                presentation_text: config.fallbackEvent.presentationText,
                hero_image_url: '',
                detail_image_url: '',
                palette_key: config.fallbackEvent.paletteKey || 'earth'
            }
        };
    }

    async function loadEvent() {
        const requestedKey = getRequestedEventKey();

        if (!requestedKey) {
            throw new Error('Evento no especificado');
        }

        if (!client) {
            return getFallbackEvent();
        }

        const isCodeLookup = /^\d{6}$/.test(requestedKey);
        const eventColumns = isCodeLookup
            ? 'id,title,event_date,location_name,maps_url,public_slug,event_code'
            : 'id,title,event_date,location_name,maps_url,public_slug';
        let eventQuery = client
            .from('eventin_events')
            .select(eventColumns)
            .eq('is_active', true);

        if (isCodeLookup) {
            eventQuery = eventQuery.eq('event_code', requestedKey);
        } else {
            eventQuery = eventQuery.eq('public_slug', requestedKey);
        }

        const { data: eventData, error: eventError } = await eventQuery.maybeSingle();

        if (eventError || !eventData) {
            throw new Error('Evento no encontrado');
        }

        const { data: settings } = await client
            .from('eventin_event_settings')
            .select('main_title,subtitle,display_date,display_time,presentation_title,presentation_text,hero_image_url,detail_image_url,palette_key')
            .eq('event_id', eventData.id)
            .maybeSingle();

        return {
            event: eventData,
            settings: settings || {}
        };
    }

    function getEvent() {
        if (!eventPromise) {
            eventPromise = loadEvent();
        }

        return eventPromise;
    }

    window.eventContext = {
        getEvent,
        getRequestedEventKey,
        hasRequestedEvent,
        buildEventUrl
    };
})();
