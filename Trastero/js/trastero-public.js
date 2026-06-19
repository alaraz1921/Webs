const supabaseClient = window.websSupabase;
const folderIcon = 'assets/folder-box.png';
const itemIcon = 'assets/item-box.png';
const storageBucket = 'trastero-fotos';
let signedPublicUrls = new Map();

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
    const visible = photos.map((photo) => publicPhotoUrl(photo, true)).filter(Boolean).slice(0, 6);
    if (!visible.length) return '<p class="public-photo-warning">No se pudieron cargar las fotografias publicas.</p>';
    return `
        <section class="public-gallery">
            ${visible.map((url) => `<img src="${escapeHtml(url)}" alt="">`).join('')}
        </section>`;
}

function renderPublicChildren(record) {
    if (record.type !== 'carpeta') return '';
    const folders = record.children?.folders || [];
    const items = record.children?.items || [];
    if (!folders.length && !items.length) return '';
    const folderRows = folders.map((folder) => {
        const cover = publicPhotoUrl((folder.photos || [])[0] || {}, true);
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
        const cover = publicPhotoUrl((item.photos || [])[0] || {}, true);
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
        ? `index.html?folder=${encodeURIComponent(record.id)}`
        : `index.html?item=${encodeURIComponent(record.id)}`;
    window.location.replace(target);
    return true;
}

function renderPublic(record) {
    document.getElementById('app-loading').hidden = true;
    const shell = document.getElementById('app-shell');
    shell.hidden = false;
    const icon = record.type === 'carpeta' ? folderIcon : itemIcon;
    const typeLabel = record.type === 'carpeta' ? 'Carpeta' : 'Item';
    const detail = record.type === 'carpeta'
        ? `<div class="detail-row"><span>Folders</span><strong>${record.folder_count || 0}</strong></div>
           <div class="detail-row"><span>Items</span><strong>${record.item_count || 0}</strong></div>`
        : `<div class="detail-row"><span>Cantidad</span><strong>${escapeHtml(formatQuantity(record))}</strong></div>`;
    shell.innerHTML = `
        <section class="screen public-screen">
            <header class="topbar public-topbar">
                <img class="public-icon" src="${icon}" alt="">
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

init();
