(function () {
    const config = window.eventPlatformConfig;
    const client = window.eventSupabase;
    let eventPromise = null;

    function getRequestedSlug() {
        const params = new URLSearchParams(window.location.search);
        return String(params.get('evento') || '').trim();
    }

    function buildEventUrl(pageName, slug) {
        const eventSlug = slug || getRequestedSlug();
        const query = eventSlug ? `?evento=${encodeURIComponent(eventSlug)}` : '';
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
                public_slug: config.defaultEventSlug
            },
            settings: {
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
        if (!client) {
            return getFallbackEvent();
        }

        const requestedSlug = getRequestedSlug();
        let eventQuery = client
            .from('eventin_events')
            .select('id,title,event_date,location_name,maps_url,public_slug')
            .eq('is_active', true);

        if (requestedSlug) {
            eventQuery = eventQuery.eq('public_slug', requestedSlug);
        } else {
            eventQuery = eventQuery.eq('id', config.defaultEventId);
        }

        const { data: eventData, error: eventError } = await eventQuery.maybeSingle();

        if (eventError || !eventData) {
            if (requestedSlug) {
                throw new Error('Evento no encontrado');
            }

            return getFallbackEvent();
        }

        const { data: settings } = await client
            .from('eventin_event_settings')
            .select('subtitle,display_date,display_time,presentation_title,presentation_text,hero_image_url,detail_image_url,palette_key')
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
        getRequestedSlug,
        buildEventUrl
    };
})();
