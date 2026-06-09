(function () {
    const client = window.eventSupabase;
    const eventContext = window.eventContext;
    const publicLink = document.getElementById('public-gallery-link');
    const collaborativeLink = document.getElementById('collaborative-gallery-link');

    if (!eventContext?.hasRequestedEvent()) {
        return;
    }

    (async function init() {
        try {
            const { event: eventData } = await eventContext.getEvent();
            const eventKey = eventData.public_slug || eventData.event_code;
            publicLink.href = `galeria.html?evento=${encodeURIComponent(eventKey)}`;

            if (!client) {
                return;
            }

            const { data } = await client.rpc('eventin_get_collaborative_gallery_link', {
                p_event_id: eventData.id
            });

            if (data?.enabled && data?.token) {
                collaborativeLink.href = `galeria-colaborativa.html?token=${encodeURIComponent(data.token)}`;
                collaborativeLink.hidden = false;
            }
        } catch (_error) {
            collaborativeLink.hidden = true;
        }
    })();
})();
