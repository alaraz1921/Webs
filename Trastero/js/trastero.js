const supabaseClient = window.websSupabase;
const page = document.body.dataset.page;
const entityType = document.body.dataset.entity;
const config = {
    zona: { table: 'trastero_zonas', plural: 'zonas', label: 'Zona', fields: ['nombre', 'notas'] },
    caja: { table: 'trastero_cajas', plural: 'cajas', label: 'Caja', fields: ['nombre', 'zona_id', 'ubicacion', 'notas'] },
    objeto: { table: 'trastero_objetos', plural: 'objetos', label: 'Objeto', fields: ['nombre', 'zona_id', 'caja_id', 'notas'] }
};

let currentUser = null;
let items = [];
let zonas = [];
let cajas = [];
let currentItem = null;
let toastTimer = null;

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function showToast(message, error = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast${error ? ' error' : ''}`;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function formatNotes(value) {
    return value ? escapeHtml(value) : '<span class="help-text">Sin notas</span>';
}

function relationName(collection, id) {
    return collection.find((item) => String(item.id) === String(id))?.nombre || '';
}

async function requireAccess() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
        window.location.replace(`../Privado/index.html?next=${encodeURIComponent(`../Trastero/${page === 'inicio' ? 'index' : page}.html`)}`);
        return false;
    }
    const { data: profile, error } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).single();
    if (error || !['admin', 'trastero'].includes(profile?.role)) {
        document.getElementById('app-loading').textContent = 'No tienes permiso para acceder a Trastero.';
        return false;
    }
    currentUser = session.user;
    document.getElementById('app-loading').hidden = true;
    document.getElementById('app-shell').hidden = false;
    document.getElementById('logout-button')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.replace('../Privado/index.html');
    });
    return true;
}

async function fetchRelations() {
    const [zonasResult, cajasResult] = await Promise.all([
        supabaseClient.from('trastero_zonas').select('id,nombre').order('nombre'),
        supabaseClient.from('trastero_cajas').select('id,nombre,zona_id').order('nombre')
    ]);
    if (zonasResult.error || cajasResult.error) throw zonasResult.error || cajasResult.error;
    zonas = zonasResult.data || [];
    cajas = cajasResult.data || [];
}

function fillSelect(id, collection, emptyLabel) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${emptyLabel}</option>${collection.map((item) => `<option value="${item.id}">${escapeHtml(item.nombre)}</option>`).join('')}`;
}

async function initHome() {
    const tables = ['trastero_zonas', 'trastero_cajas', 'trastero_objetos'];
    const results = await Promise.all(tables.map((table) => supabaseClient.from(table).select('*', { count: 'exact', head: true })));
    ['zonas', 'cajas', 'objetos'].forEach((name, index) => {
        document.getElementById(`count-${name}`).textContent = results[index].count ?? 0;
    });
    let searchTimer;
    document.getElementById('global-search').addEventListener('input', (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => globalSearch(event.target.value.trim()), 280);
    });
}

async function globalSearch(term) {
    const resultsBox = document.getElementById('search-results');
    const help = document.getElementById('search-help');
    if (term.length < 2) {
        resultsBox.innerHTML = '';
        help.textContent = 'Escribe al menos dos caracteres.';
        return;
    }
    help.textContent = 'Buscando...';
    const safeTerm = term.replace(/[%_,()]/g, ' ');
    const [zoneResult, boxResult, objectResult] = await Promise.all([
        supabaseClient.from('trastero_zonas').select('*').or(`nombre.ilike.%${safeTerm}%,notas.ilike.%${safeTerm}%`).limit(20),
        supabaseClient.from('trastero_cajas').select('*').or(`nombre.ilike.%${safeTerm}%,notas.ilike.%${safeTerm}%,ubicacion.ilike.%${safeTerm}%`).limit(20),
        supabaseClient.from('trastero_objetos').select('*').or(`nombre.ilike.%${safeTerm}%,notas.ilike.%${safeTerm}%`).limit(20)
    ]);
    const error = zoneResult.error || boxResult.error || objectResult.error;
    if (error) {
        help.textContent = 'No se pudo completar la búsqueda.';
        return;
    }
    const combined = [
        ...zoneResult.data.map((item) => ({ ...item, tipo: 'zona', url: 'zonas.html' })),
        ...boxResult.data.map((item) => ({ ...item, tipo: 'caja', url: 'cajas.html' })),
        ...objectResult.data.map((item) => ({ ...item, tipo: 'objeto', url: 'objetos.html' }))
    ];
    help.textContent = `${combined.length} resultado${combined.length === 1 ? '' : 's'}.`;
    resultsBox.innerHTML = combined.length ? combined.map((item) => `
        <article class="entity-card">
            <span class="entity-type">${item.tipo}</span>
            <h3>${escapeHtml(item.nombre)}</h3>
            ${item.ubicacion ? `<p class="meta-line">${escapeHtml(item.ubicacion)}</p>` : ''}
            <p>${formatNotes(item.notas)}</p>
            <div class="card-actions"><a class="button button-small" href="${item.url}?id=${item.id}">Ver ${item.tipo}</a></div>
        </article>`).join('') : '<p class="empty-state">No hay coincidencias.</p>';
}

async function initEntityPage() {
    await fetchRelations();
    fillSelect('zona_id', zonas, 'Sin zona');
    fillSelect('caja_id', cajas, 'Sin caja');
    document.getElementById('caja_id')?.addEventListener('change', (event) => {
        const selectedBox = cajas.find((box) => String(box.id) === event.target.value);
        if (selectedBox?.zona_id) document.getElementById('zona_id').value = selectedBox.zona_id;
    });
    document.querySelector('[data-action="new"]').addEventListener('click', () => openForm());
    document.querySelectorAll('[data-action="close-form"]').forEach((button) => button.addEventListener('click', closeForm));
    document.getElementById('entity-form').addEventListener('submit', saveItem);
    document.getElementById('list-filter').addEventListener('input', renderList);
    document.getElementById('entity-list').addEventListener('click', handleListAction);
    document.getElementById('detail-panel').addEventListener('click', handleDetailAction);
    await loadItems();
    const requestedId = queryParam('id');
    if (requestedId) await showDetail(requestedId);
    if (queryParam('new') === '1') openForm(null, { zona_id: queryParam('zona_id'), caja_id: queryParam('caja_id') });
}

async function loadItems() {
    const { data, error } = await supabaseClient.from(config[entityType].table).select('*').order('nombre');
    if (error) {
        showToast('No se pudieron cargar los datos.', true);
        return;
    }
    items = data || [];
    renderList();
}

function itemMeta(item) {
    const parts = [];
    if (item.zona_id) parts.push(`Zona: ${relationName(zonas, item.zona_id)}`);
    if (item.caja_id) parts.push(`Caja: ${relationName(cajas, item.caja_id)}`);
    if (item.ubicacion) parts.push(item.ubicacion);
    return parts.join(' · ');
}

function renderList() {
    const term = document.getElementById('list-filter').value.trim().toLowerCase();
    const filtered = items.filter((item) => [item.nombre, item.notas, item.ubicacion, itemMeta(item)].some((value) => String(value || '').toLowerCase().includes(term)));
    document.getElementById('entity-list').innerHTML = filtered.length ? filtered.map((item) => `
        <article class="entity-card">
            <span class="entity-type">${config[entityType].label}</span>
            <h3>${escapeHtml(item.nombre)}</h3>
            ${itemMeta(item) ? `<p class="meta-line">${escapeHtml(itemMeta(item))}</p>` : ''}
            <p>${formatNotes(item.notas)}</p>
            <div class="card-actions">
                <button class="button button-small" type="button" data-action="view" data-id="${item.id}">Ver ficha</button>
                <button class="button button-small button-muted" type="button" data-action="edit" data-id="${item.id}">Editar</button>
            </div>
        </article>`).join('') : '<p class="empty-state">No hay elementos que mostrar.</p>';
}

function handleListAction(event) {
    const button = event.target.closest('[data-action][data-id]');
    if (!button) return;
    const item = items.find((candidate) => String(candidate.id) === button.dataset.id);
    if (button.dataset.action === 'view') showDetail(item.id);
    if (button.dataset.action === 'edit') openForm(item);
}

function openForm(item = null, defaults = {}) {
    currentItem = item;
    const form = document.getElementById('entity-form');
    form.reset();
    fillSelect('zona_id', zonas, 'Sin zona');
    fillSelect('caja_id', cajas, 'Sin caja');
    document.getElementById('entity-id').value = item?.id || '';
    config[entityType].fields.forEach((field) => {
        const input = document.getElementById(field);
        if (input) input.value = item?.[field] ?? defaults[field] ?? '';
    });
    if (entityType === 'objeto' && defaults.caja_id && !defaults.zona_id) {
        const selectedBox = cajas.find((box) => String(box.id) === String(defaults.caja_id));
        if (selectedBox?.zona_id) document.getElementById('zona_id').value = selectedBox.zona_id;
    }
    document.getElementById('form-title').textContent = `${item ? 'Editar' : 'Nuevo'} ${config[entityType].label.toLowerCase()}`;
    document.getElementById('form-panel').hidden = false;
    document.getElementById('form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
    document.getElementById('form-panel').hidden = true;
    currentItem = null;
}

async function saveItem(event) {
    event.preventDefault();
    const submit = event.target.querySelector('[type="submit"]');
    submit.disabled = true;
    const id = document.getElementById('entity-id').value;
    const payload = { user_id: currentUser.id };
    config[entityType].fields.forEach((field) => {
        const value = document.getElementById(field)?.value.trim();
        payload[field] = value || null;
    });
    let result;
    if (id) result = await supabaseClient.from(config[entityType].table).update(payload).eq('id', id).select().single();
    else result = await supabaseClient.from(config[entityType].table).insert(payload).select().single();
    submit.disabled = false;
    if (result.error) {
        showToast(`No se pudo guardar: ${result.error.message}`, true);
        return;
    }
    showToast(`${config[entityType].label} guardada.`);
    closeForm();
    await fetchRelations();
    await loadItems();
    await showDetail(result.data.id);
}

async function showDetail(id) {
    const item = items.find((candidate) => String(candidate.id) === String(id));
    if (!item) return;
    currentItem = item;
    const photos = await loadPhotos(item.id);
    const extraActions = entityType === 'zona'
        ? `<a class="button button-small button-success" href="cajas.html?new=1&zona_id=${item.id}">Crear caja en esta zona</a><a class="button button-small button-success" href="objetos.html?new=1&zona_id=${item.id}">Crear objeto en esta zona</a>`
        : entityType === 'caja'
            ? `<a class="button button-small button-success" href="objetos.html?new=1&caja_id=${item.id}${item.zona_id ? `&zona_id=${item.zona_id}` : ''}">Crear objeto en esta caja</a>`
            : '';
    const panel = document.getElementById('detail-panel');
    panel.innerHTML = `
        <div class="section-heading"><div><span class="entity-type">${config[entityType].label}</span><h2>${escapeHtml(item.nombre)}</h2></div><button class="icon-button" type="button" data-action="close-detail" aria-label="Cerrar">×</button></div>
        ${itemMeta(item) ? `<p class="meta-line">${escapeHtml(itemMeta(item))}</p>` : ''}
        <p class="detail-notes">${formatNotes(item.notas)}</p>
        <div class="card-actions">
            <button class="button button-small button-muted" type="button" data-action="edit-detail">Editar</button>
            ${extraActions}
            <button class="button button-small button-danger" type="button" data-action="delete">Eliminar</button>
        </div>
        <div class="photo-upload">
            <h3>Fotos</h3>
            <p class="help-text">Las imágenes se comprimen antes de subirlas.</p>
            <label for="photo-input">Añadir foto</label>
            <input id="photo-input" type="file" accept="image/*" capture="environment">
            <div class="photos-grid">${renderPhotos(photos)}</div>
        </div>`;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleDetailAction(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close-detail') document.getElementById('detail-panel').hidden = true;
    if (action === 'edit-detail') openForm(currentItem);
    if (action === 'delete') deleteItem();
    if (action === 'delete-photo') deletePhoto(event.target.closest('[data-photo-id]'));
}

async function deleteItem() {
    if (!currentItem || !window.confirm(`¿Eliminar "${currentItem.nombre}"? Las fotos asociadas también se eliminarán.`)) return;
    const photos = await loadPhotos(currentItem.id);
    if (photos.length) await supabaseClient.storage.from('trastero-fotos').remove(photos.map((photo) => photo.storage_path));
    if (photos.length) await supabaseClient.from('trastero_fotos').delete().eq('tipo', entityType).eq('relacion_id', currentItem.id);
    const { error } = await supabaseClient.from(config[entityType].table).delete().eq('id', currentItem.id);
    if (error) {
        showToast(`No se pudo eliminar: ${error.message}`, true);
        return;
    }
    showToast(`${config[entityType].label} eliminada.`);
    document.getElementById('detail-panel').hidden = true;
    await fetchRelations();
    await loadItems();
}

async function loadPhotos(relationId) {
    const { data, error } = await supabaseClient.from('trastero_fotos').select('*').eq('tipo', entityType).eq('relacion_id', relationId).order('created_at', { ascending: false });
    if (error) {
        showToast('No se pudieron cargar las fotos.', true);
        return [];
    }
    const photos = data || [];
    if (!photos.length) return photos;
    const signed = await supabaseClient.storage.from('trastero-fotos').createSignedUrls(photos.map((photo) => photo.storage_path), 3600);
    if (signed.error) {
        showToast('No se pudieron preparar las miniaturas.', true);
        return photos;
    }
    return photos.map((photo, index) => ({ ...photo, signed_url: signed.data[index]?.signedUrl || '' }));
}

function renderPhotos(photos) {
    if (!photos.length) return '<p class="empty-state">Todavía no hay fotos.</p>';
    return photos.map((photo) => `<figure class="photo-card"><img src="${escapeHtml(photo.signed_url)}" alt="Foto de ${escapeHtml(currentItem.nombre)}" loading="lazy"><div class="photo-actions"><button class="button button-small button-danger" type="button" data-action="delete-photo" data-photo-id="${photo.id}" data-path="${escapeHtml(photo.storage_path)}">Eliminar</button></div></figure>`).join('');
}

async function optimizeImage(file, maxBytes = 300 * 1024) {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob;
    let quality = .84;
    for (let attempt = 0; attempt < 14; attempt += 1) {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob.size <= maxBytes) break;
        if (quality > .34) {
            quality -= .08;
        } else {
            const resized = document.createElement('canvas');
            resized.width = Math.max(1, Math.round(canvas.width * .82));
            resized.height = Math.max(1, Math.round(canvas.height * .82));
            resized.getContext('2d').drawImage(canvas, 0, 0, resized.width, resized.height);
            canvas.width = resized.width;
            canvas.height = resized.height;
            context.drawImage(resized, 0, 0);
        }
    }
    bitmap.close();
    return blob;
}

document.addEventListener('change', async (event) => {
    if (event.target.id !== 'photo-input' || !event.target.files[0] || !currentItem) return;
    const input = event.target;
    input.disabled = true;
    try {
        const optimized = await optimizeImage(input.files[0]);
        const folder = `${entityType}s`;
        const path = `${currentUser.id}/${folder}/${currentItem.id}/${crypto.randomUUID()}.jpg`;
        const upload = await supabaseClient.storage.from('trastero-fotos').upload(path, optimized, { contentType: 'image/jpeg', upsert: false });
        if (upload.error) throw upload.error;
        const record = await supabaseClient.from('trastero_fotos').insert({ user_id: currentUser.id, tipo: entityType, relacion_id: currentItem.id, storage_path: path });
        if (record.error) {
            await supabaseClient.storage.from('trastero-fotos').remove([path]);
            throw record.error;
        }
        showToast('Foto añadida.');
        await showDetail(currentItem.id);
    } catch (error) {
        showToast(`No se pudo subir la foto: ${error.message}`, true);
    } finally {
        input.disabled = false;
    }
});

async function deletePhoto(button) {
    if (!button || !window.confirm('¿Eliminar esta foto?')) return;
    const storageResult = await supabaseClient.storage.from('trastero-fotos').remove([button.dataset.path]);
    if (storageResult.error) {
        showToast(`No se pudo eliminar la foto: ${storageResult.error.message}`, true);
        return;
    }
    const { error } = await supabaseClient.from('trastero_fotos').delete().eq('id', button.dataset.photoId);
    if (error) {
        showToast(`No se pudo eliminar el registro: ${error.message}`, true);
        return;
    }
    showToast('Foto eliminada.');
    await showDetail(currentItem.id);
}

async function init() {
    if (!await requireAccess()) return;
    try {
        if (page === 'inicio') await initHome();
        else await initEntityPage();
    } catch (error) {
        showToast(`No se pudo iniciar Trastero: ${error.message}`, true);
    }
}

init();
