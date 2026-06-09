(function () {
    const client = window.eventSupabase;
    const config = window.eventPlatformConfig;
    const mode = document.body.dataset.galleryMode;
    const params = new URLSearchParams(window.location.search);
    const eventKey = String(params.get('evento') || '').trim();
    const galleryToken = String(params.get('token') || '').trim();
    const eventTitle = document.getElementById('gallery-event-title');
    const eventLink = document.getElementById('gallery-event-link');
    const grid = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    const status = document.getElementById('gallery-status');
    const fileInput = document.getElementById('gallery-file');
    const uploadPanel = document.getElementById('gallery-upload-panel');
    const content = document.getElementById('gallery-content');
    const accessPanel = document.getElementById('gallery-access-panel');
    const accessForm = document.getElementById('gallery-access-form');
    const accessStatus = document.getElementById('gallery-access-status');
    const slideshowButton = document.getElementById('gallery-slideshow-button');
    const lightbox = document.getElementById('gallery-lightbox');
    const lightboxImage = document.getElementById('gallery-lightbox-image');
    const deleteModal = document.getElementById('gallery-delete-modal');
    const deleteCancel = document.getElementById('gallery-delete-cancel');
    const deleteConfirm = document.getElementById('gallery-delete-confirm');
    const maxImageBytes = 500 * 1024;
    let images = [];
    let canDelete = false;
    let accessKey = '';
    let activeImageIndex = 0;
    let pendingDeleteId = '';
    let slideshowTimer = null;

    function setStatus(element, message, isError = false) {
        if (!element) {
            return;
        }
        element.textContent = message;
        element.classList.toggle('error', Boolean(isError));
    }

    async function api(body) {
        const { data: sessionData } = await client.auth.getSession();
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
            throw new Error(result.error || 'No se pudo completar la operacion.');
        }
        return result;
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo leer la imagen.'));
            };
            image.src = url;
        });
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo optimizar la imagen.')), type, quality);
        });
    }

    async function optimizeImage(file) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Selecciona un archivo de imagen.');
        }
        if (file.size > 12 * 1024 * 1024) {
            throw new Error('La imagen original supera 12 MB.');
        }

        const image = await loadImage(file);
        const maxDimensions = [1800, 1500, 1200, 1000, 800, 650];
        const qualities = [0.82, 0.72, 0.62, 0.52, 0.44];
        const outputTypes = ['image/webp', 'image/jpeg'];

        for (const maxDimension of maxDimensions) {
            const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
            const width = Math.max(1, Math.round(image.naturalWidth * scale));
            const height = Math.max(1, Math.round(image.naturalHeight * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(image, 0, 0, width, height);

            for (const type of outputTypes) {
                for (const quality of qualities) {
                    const blob = await canvasToBlob(canvas, type, quality);
                    if (blob.size <= maxImageBytes) {
                        return blob;
                    }
                }
            }
        }

        throw new Error('No se pudo reducir la imagen por debajo de 500 KB.');
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = () => reject(new Error('No se pudo preparar la imagen.'));
            reader.readAsDataURL(blob);
        });
    }

    function updateEventInfo(eventData) {
        eventTitle.textContent = eventData?.title || (mode === 'public' ? 'Recuerdos' : 'Compartir recuerdos');
        const key = eventData?.public_slug || eventData?.event_code;
        eventLink.href = key ? `evento.html?evento=${encodeURIComponent(key)}` : 'index.html';
    }

    function renderImages() {
        grid.innerHTML = '';
        empty.hidden = images.length > 0;

        images.forEach((image, index) => {
            const figure = document.createElement('figure');
            figure.className = 'gallery-item';
            const openButton = document.createElement('button');
            openButton.type = 'button';
            openButton.className = 'gallery-image-button';
            openButton.dataset.index = String(index);
            openButton.setAttribute('aria-label', 'Ampliar fotografia');
            const img = document.createElement('img');
            img.src = image.url;
            img.alt = 'Recuerdo del evento';
            img.loading = 'lazy';
            openButton.append(img);
            figure.append(openButton);

            if (canDelete) {
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'icon-button danger-button gallery-delete-button';
                deleteButton.dataset.deleteId = image.id;
                deleteButton.setAttribute('aria-label', 'Borrar imagen');
                deleteButton.title = 'Borrar imagen';
                deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
                figure.append(deleteButton);
            }
            grid.append(figure);
        });
    }

    async function loadGallery() {
        setStatus(status, 'Cargando recuerdos...');
        const result = mode === 'public'
            ? await api({ action: 'list_public', event_key: eventKey })
            : await api({ action: 'list_collaborative', token: galleryToken, access_key: accessKey });

        images = result.images || [];
        canDelete = mode === 'public' ? Boolean(result.can_manage) : Boolean(result.can_delete);
        updateEventInfo(result.event);
        if (uploadPanel) {
            uploadPanel.hidden = !result.can_manage;
        }
        if (content) {
            content.hidden = false;
        }
        if (accessPanel) {
            accessPanel.hidden = true;
        }
        renderImages();
        setStatus(status, '');
    }

    async function uploadSelectedImage(file) {
        setStatus(status, 'Optimizando imagen...');
        const blob = await optimizeImage(file);
        setStatus(status, 'Subiendo imagen...');
        const imageBase64 = await blobToBase64(blob);
        const payload = {
            action: mode === 'public' ? 'upload_public' : 'upload_collaborative',
            image_base64: imageBase64,
            content_type: blob.type
        };
        if (mode === 'public') {
            payload.event_key = eventKey;
        } else {
            payload.token = galleryToken;
            payload.access_key = accessKey;
        }
        await api(payload);
        await loadGallery();
        setStatus(status, 'Imagen añadida correctamente.');
    }

    function openLightbox(index) {
        if (!images.length) {
            return;
        }
        activeImageIndex = (index + images.length) % images.length;
        lightboxImage.src = images[activeImageIndex].url;
        lightbox.hidden = false;
    }

    function stopSlideshow() {
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }
    }

    function closeLightbox() {
        stopSlideshow();
        lightbox.hidden = true;
        lightboxImage.removeAttribute('src');
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }

    function startSlideshow() {
        if (!images.length) {
            setStatus(status, 'No hay imagenes para iniciar la presentacion.', true);
            return;
        }
        openLightbox(0);
        lightbox.requestFullscreen?.().catch(() => {});
        slideshowTimer = setInterval(() => openLightbox(activeImageIndex + 1), 5000);
    }

    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) {
            return;
        }
        try {
            await uploadSelectedImage(file);
        } catch (error) {
            setStatus(status, error.message || 'No se pudo subir la imagen.', true);
        }
    });

    grid?.addEventListener('click', (event) => {
        const openButton = event.target.closest('[data-index]');
        if (openButton) {
            openLightbox(Number(openButton.dataset.index));
            return;
        }
        const deleteButton = event.target.closest('[data-delete-id]');
        if (deleteButton) {
            pendingDeleteId = deleteButton.dataset.deleteId;
            deleteModal.hidden = false;
        }
    });

    deleteCancel?.addEventListener('click', () => {
        pendingDeleteId = '';
        deleteModal.hidden = true;
    });

    deleteConfirm?.addEventListener('click', async () => {
        if (!pendingDeleteId) {
            return;
        }
        try {
            await api({
                action: mode === 'public' ? 'delete_public' : 'delete_collaborative',
                image_id: pendingDeleteId
            });
            pendingDeleteId = '';
            deleteModal.hidden = true;
            await loadGallery();
        } catch (error) {
            setStatus(status, error.message || 'No se pudo borrar la imagen.', true);
        }
    });

    lightbox?.addEventListener('click', (event) => {
        const action = event.target.closest('[data-lightbox-action]')?.dataset.lightboxAction;
        if (action === 'close') {
            closeLightbox();
        } else if (action === 'previous') {
            openLightbox(activeImageIndex - 1);
        } else if (action === 'next') {
            openLightbox(activeImageIndex + 1);
        }
    });

    slideshowButton?.addEventListener('click', startSlideshow);

    accessForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        accessKey = String(new FormData(accessForm).get('access_key') || '').trim();
        setStatus(accessStatus, 'Comprobando acceso...');
        try {
            await loadGallery();
            sessionStorage.setItem(`eventin-gallery-${galleryToken}`, accessKey);
            setStatus(accessStatus, '');
        } catch (error) {
            const message = error?.message === 'Invalid gallery access'
                ? 'Clave incorrecta o galeria no disponible.'
                : 'No se pudo comprobar el acceso a la galeria. Intentalo de nuevo.';
            setStatus(accessStatus, message, true);
        }
    });

    (async function init() {
        if (!client) {
            setStatus(status || accessStatus, 'No se pudo conectar con el servicio.', true);
            return;
        }
        try {
            if (mode === 'public') {
                if (!eventKey) {
                    throw new Error('Evento no especificado.');
                }
                await loadGallery();
            } else {
                if (!galleryToken) {
                    throw new Error('Enlace de galeria no valido.');
                }
                accessKey = sessionStorage.getItem(`eventin-gallery-${galleryToken}`) || '';
                if (accessKey) {
                    try {
                        await loadGallery();
                    } catch (_error) {
                        sessionStorage.removeItem(`eventin-gallery-${galleryToken}`);
                        accessKey = '';
                        accessPanel.hidden = false;
                    }
                }
            }
        } catch (error) {
            setStatus(status || accessStatus, error.message || 'No se pudo cargar la galeria.', true);
        }
    })();
})();
