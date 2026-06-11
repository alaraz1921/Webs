(function () {
    const client = window.eventSupabase;
    const config = window.eventPlatformConfig;
    const eventContext = window.eventContext;
    const publicLink = document.getElementById('public-gallery-link');
    const collaborativeLink = document.getElementById('collaborative-gallery-link');
    const preview = document.getElementById('memories-preview');
    const empty = document.getElementById('memories-empty');
    const count = document.getElementById('memories-count');

    async function galleryApi(body) {
        const { data: sessionData } = client
            ? await client.auth.getSession()
            : { data: { session: null } };
        const accessToken = sessionData.session?.access_token || config.supabaseAnonKey;
        const response = await fetch(`${config.supabaseUrl}/functions/v1/gallery-api`, {
            method: 'POST',
            headers: {
                apikey: config.supabaseAnonKey,
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'No se pudo cargar la galeria.');
        }
        return result;
    }

    function createExtraOverlay(className, amount) {
        const overlay = document.createElement('span');
        overlay.className = `memories-preview-extra ${className}`;
        overlay.textContent = `+${amount}`;
        return overlay;
    }

    function renderPreview(result) {
        const images = result.images || [];
        const total = Number(result.total) || 0;
        preview.innerHTML = '';
        preview.hidden = images.length === 0;
        empty.hidden = images.length > 0;
        count.hidden = total === 0;
        count.querySelector('span').textContent = `${total} ${total === 1 ? 'recuerdo compartido' : 'recuerdos compartidos'}`;

        images.forEach((url, index) => {
            const item = document.createElement('a');
            item.className = 'memories-preview-item';
            item.href = publicLink.href;
            item.setAttribute('aria-label', 'Ver galeria');
            const image = document.createElement('img');
            image.src = url;
            image.alt = 'Recuerdo del evento';
            image.loading = 'lazy';
            item.append(image);

            if (index === 2 && total > 3) {
                item.append(createExtraOverlay('mobile-extra', total - 3));
            }
            if (index === 5 && total > 6) {
                item.append(createExtraOverlay('desktop-extra', total - 6));
            }
            preview.append(item);
        });
    }

    if (!eventContext?.hasRequestedEvent()) {
        return;
    }

    (async function init() {
        try {
            const { event: eventData } = await eventContext.getEvent();
            const eventKey = eventData.public_slug || eventData.event_code;
            publicLink.href = `galeria.html?evento=${encodeURIComponent(eventKey)}`;

            const previewPromise = galleryApi({ action: 'preview_public', event_key: eventKey })
                .then(renderPreview)
                .catch(() => {
                    preview.hidden = true;
                    empty.hidden = true;
                    count.hidden = true;
                });

            if (client) {
                const { data } = await client.rpc('eventin_get_collaborative_gallery_link', {
                    p_event_id: eventData.id
                });

                if (data?.enabled && data?.token) {
                    collaborativeLink.href = `galeria-colaborativa.html?token=${encodeURIComponent(data.token)}`;
                    collaborativeLink.hidden = false;
                }
            }
            await previewPromise;
        } catch (_error) {
            collaborativeLink.hidden = true;
        }
    })();
})();
