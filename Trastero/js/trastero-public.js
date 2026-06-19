const supabaseClient = window.websSupabase;
const folderIcon = 'assets/folder-box.png';
const itemIcon = 'assets/item-box.png';
const storageBucket = 'trastero-fotos';
let signedPublicUrls = new Map();
let publicGalleryPhotos = [];
let publicGalleryIndex = 0;

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function formatQuantity(item) {
    const quantity = item.cantidad ?? 1;
    const unit = item.unidad === 'unit' ? 'unidad' : (item.unidad || 'unidad');
    return `${Number(quantity).toLocaleString('es-ES')} ${unit}`;
}

function showMessage(message) {
    document.getElementById('app-loading').hidden = true;
    const shell = document.getElementById('app-shell');
    shell.hidden = false;
    shell.innerHTML = `<section class="screen public-screen"><div class="public-card"><p>${escapeHtml(message)}</p></div></section>`;
}

function photoPath(photo, preferThumb = false) {
    return preferThumb ? (photo.thumbnail_path || photo.storage_path) : (photo.storage_path || photo.thumbnail_path);
}

function publicPhotoUrl(photo, preferThumb = false) {
    const primary = photoPath(photo, preferThumb);
    const fallback = photoPath(photo, !preferThumb);
    return signedPublicUrls.get(primary) || signedPublicUrls.get(fallback) || '';
}

function firstPublicPhotoUrl(photos = [], preferThumb = false) {
    return photos.map((photo) => publicPhotoUrl(photo, preferThumb)).find(Boolean) || '';
}

function collectPhotoPaths(record) {
    const paths = new Set();
    const addPhotos = (photos = []) => {
        photos.forEach((photo) => {
            [photo.storage_path, photo.thumbnail_path].filter(Boolean).forEach((path) => paths.add(path));
        });
    };
    addPhotos(record.photos || []);
    (record.children?.folders || []).forEach((folder) => addPhotos(folder.photos || []));
    (record.children?.items || []).forEach((item) => addPhotos(item.photos || []));
    return [...paths];
}

async function loadSignedPublicUrls(record) {
    signedPublicUrls = new Map();
    const paths = collectPhotoPaths(record);
    if (!paths.length) return;
    const signedEntries = await Promise.all(paths.map(async (path) => {
        const { data, error } = await supabaseClient.storage.from(storageBucket).createSignedUrl(path, 3600);
        return error || !data?.signedUrl ? null : [path, data.signedUrl];
    }));
    signedPublicUrls = new Map(signedEntries.filter(Boolean));
}

function renderPhotoGallery(photos = []) {
    if (!photos.length) return '';
    publicGalleryPhotos = photos.map((photo) => ({
        url: publicPhotoUrl(photo, false),
        thumbUrl: publicPhotoUrl(photo, true)
    })).filter((photo) => photo.url || photo.thumbUrl);
    const visible = publicGalleryPhotos.slice(0, 6);
    if (!visible.length) return '<p class="public-photo-warning">No se pudieron cargar las fotografias publicas.</p>';
    return `
        <section class="public-gallery">
            ${visible.map((photo, index) => `
                <button class="public-gallery-thumb" type="button" data-action="open-public-photo-viewer" data-index="${index}" aria-label="Ver foto">
                    <img src="${escapeHtml(photo.thumbUrl || photo.url)}" alt="">
                </button>`).join('')}
        </section>`;
}

function openPublicPhotoViewer(index = 0) {
    if (!publicGalleryPhotos.length) return;
    publicGalleryIndex = Math.max(0, Math.min(Number(index) || 0, publicGalleryPhotos.length - 1));
    renderPublicPhotoViewer();
}

function renderPublicPhotoViewer() {
    document.querySelector('.photo-viewer-backdrop')?.remove();
    const photo = publicGalleryPhotos[publicGalleryIndex];
    const backdrop = document.createElement('div');
    backdrop.className = 'photo-viewer-backdrop';
    backdrop.innerHTML = `
        <section class="photo-viewer">
            <button class="photo-viewer-close" type="button" data-action="close-public-photo-viewer" aria-label="Cerrar">&times;</button>
            <button class="photo-viewer-nav photo-viewer-prev" type="button" data-action="public-photo-viewer-prev" aria-label="Anterior" ${publicGalleryPhotos.length < 2 ? 'disabled' : ''}>&lsaquo;</button>
            <img src="${escapeHtml(photo.url || photo.thumbUrl)}" alt="">
            <button class="photo-viewer-nav photo-viewer-next" type="button" data-action="public-photo-viewer-next" aria-label="Siguiente" ${publicGalleryPhotos.length < 2 ? 'disabled' : ''}>&rsaquo;</button>
            <div class="photo-viewer-controls">
                <div class="photo-viewer-count">${publicGalleryIndex + 1} / ${publicGalleryPhotos.length}</div>
            </div>
        </section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) closePublicPhotoViewer();
    });
}

function closePublicPhotoViewer() {
    document.querySelector('.photo-viewer-backdrop')?.remove();
}

function stepPublicPhotoViewer(direction) {
    if (!publicGalleryPhotos.length) return;
    publicGalleryIndex = (publicGalleryIndex + direction + publicGalleryPhotos.length) % publicGalleryPhotos.length;
    renderPublicPhotoViewer();
}

function renderPublicChildren(record) {
    if (record.type !== 'carpeta') return '';
    const folders = record.children?.folders || [];
    const items = record.children?.items || [];
    if (!folders.length && !items.length) return '';
    const folderRows = folders.map((folder) => {
        const cover = firstPublicPhotoUrl(folder.photos || [], true);
        return `
            <article class="content-row public-content-row">
                ${cover ? `<img class="thumb" src="${escapeHtml(cover)}" alt="">` : `<img class="thumb thumb-placeholder" src="${folderIcon}" alt="">`}
                <div class="row-copy">
                    ${folder.codigo ? `<span class="code">id: ${escapeHtml(folder.codigo)}</span>` : ''}
                    <strong class="row-title">${escapeHtml(folder.nombre)}</strong>
                    <span class="row-meta">${folder.folder_count || 0} carpetas | ${folder.item_count || 0} items</span>
                </div>
            </article>`;
    }).join('');
    const itemRows = items.map((item) => {
        const cover = firstPublicPhotoUrl(item.photos || [], true);
        return `
            <article class="content-row public-content-row">
                ${cover ? `<img class="thumb item-thumb" src="${escapeHtml(cover)}" alt="">` : `<img class="thumb item-thumb thumb-placeholder" src="${itemIcon}" alt="">`}
                <div class="row-copy">
                    ${item.codigo ? `<span class="code">id: ${escapeHtml(item.codigo)}</span>` : ''}
                    <strong class="row-title">${escapeHtml(item.nombre)}</strong>
                    <span class="row-meta">${escapeHtml(formatQuantity(item))}</span>
                </div>
            </article>`;
    }).join('');
    return `<section class="content-list public-content-list">${folderRows}${itemRows}</section>`;
}

async function maybeRedirectToPrivate(record) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user || String(session.user.id) !== String(record.owner_id)) return false;
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') return false;
    const target = record.type === 'carpeta'
        ? `app.html?folder=${encodeURIComponent(record.id)}`
        : `app.html?item=${encodeURIComponent(record.id)}`;
    window.location.replace(target);
    return true;
}

function renderPublic(record) {
    document.getElementById('app-loading').hidden = true;
    const shell = document.getElementById('app-shell');
    shell.hidden = false;
    const icon = record.type === 'carpeta' ? folderIcon : itemIcon;
    const cover = firstPublicPhotoUrl(record.photos || [], false) || icon;
    const coverClass = cover === icon ? 'public-icon' : 'public-icon public-cover';
    const typeLabel = record.type === 'carpeta' ? 'Carpeta' : 'Item';
    const detail = record.type === 'carpeta'
        ? `<div class="detail-row"><span>Folders</span><strong>${record.folder_count || 0}</strong></div>
           <div class="detail-row"><span>Items</span><strong>${record.item_count || 0}</strong></div>`
        : `<div class="detail-row"><span>Cantidad</span><strong>${escapeHtml(formatQuantity(record))}</strong></div>`;
    shell.innerHTML = `
        <section class="screen public-screen">
            <header class="topbar public-topbar">
                <img class="${coverClass}" src="${escapeHtml(cover)}" alt="">
                <div class="title-block">
                    <h1>${escapeHtml(record.nombre)}</h1>
                    <div class="breadcrumb">${escapeHtml(record.path || 'Root Level Items')}</div>
                    ${record.codigo ? `<div class="entity-code">id: ${escapeHtml(record.codigo)}</div>` : ''}
                </div>
            </header>
            ${renderPhotoGallery(record.photos || [])}
            <section class="detail-grid">
                <div class="detail-row"><span>Tipo</span><strong>${typeLabel}</strong></div>
                ${detail}
                <div class="detail-row"><span>Notas</span><strong>${escapeHtml(record.notas || 'Sin notas')}</strong></div>
            </section>
            ${renderPublicChildren(record)}
            <p class="public-readonly">Vista publica de solo lectura.</p>
        </section>`;
}

async function init() {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) {
        showMessage('Falta el token publico de Trastero.');
        return;
    }
    const { data, error } = await supabaseClient.rpc('trastero_public_lookup', { token });
    if (error) {
        showMessage('No se pudo cargar la ficha publica.');
        return;
    }
    if (!data?.available) {
        showMessage('Este elemento no esta disponible publicamente.');
        return;
    }
    if (await maybeRedirectToPrivate(data)) return;
    await loadSignedPublicUrls(data);
    renderPublic(data);
}

document.addEventListener('click', (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (action === 'open-public-photo-viewer') openPublicPhotoViewer(actionElement.dataset.index);
    if (action === 'close-public-photo-viewer') closePublicPhotoViewer();
    if (action === 'public-photo-viewer-prev') stepPublicPhotoViewer(-1);
    if (action === 'public-photo-viewer-next') stepPublicPhotoViewer(1);
});

init();
