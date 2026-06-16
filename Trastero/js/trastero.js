const supabaseClient = window.websSupabase;
const page = document.body.dataset.page;
const entityType = document.body.dataset.entity;
const config = {
    zona: { table: 'trastero_zonas', plural: 'zonas', label: 'Zona', fields: ['nombre', 'notas'], page: 'zonas.html', type: 'zona' },
    caja: { table: 'trastero_cajas', plural: 'cajas', label: 'Caja', fields: ['nombre', 'zona_id', 'ubicacion', 'notas'], page: 'cajas.html', type: 'caja' },
    objeto: { table: 'trastero_objetos', plural: 'objetos', label: 'Objeto', fields: ['nombre', 'zona_id', 'caja_id', 'notas'], page: 'objetos.html', type: 'objeto' }
};
const storageBucket = 'trastero-fotos';
const spaceKey = 'trastero_selected_space_id';

let currentUser = null;
let currentSpace = null;
let spaces = [];
let items = [];
let zonas = [];
let cajas = [];
let currentItem = null;
let currentCreateContext = {};
let toastTimer = null;

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function getSelectedSpaceId() {
    return localStorage.getItem(spaceKey);
}

function setSelectedSpaceId(id) {
    if (id) localStorage.setItem(spaceKey, String(id));
    else localStorage.removeItem(spaceKey);
}

function showToast(message, error = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast${error ? ' error' : ''}`;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function entityInitial(type = entityType) {
    return { zona: 'Z', caja: 'C', objeto: 'O', espacio: 'E' }[type] || 'T';
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function relationName(collection, id) {
    return collection.find((item) => String(item.id) === String(id))?.nombre || '';
}

function formatNotes(value) {
    return value ? escapeHtml(value) : '<span class="help-text">Sin notas</span>';
}

function itemMeta(item) {
    const parts = [];
    if (item.zona_id) parts.push(`Zona: ${relationName(zonas, item.zona_id)}`);
    if (item.caja_id) parts.push(`Caja: ${relationName(cajas, item.caja_id)}`);
    if (item.ubicacion) parts.push(item.ubicacion);
    return parts.join(' · ');
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
    return true;
}

async function loadSpaces() {
    const { data, error } = await supabaseClient.from('trastero_espacios').select('*').order('nombre');
    if (error) throw error;
    spaces = await attachSpaceThumbnails(data || []);
    currentSpace = spaces.find((space) => String(space.id) === String(getSelectedSpaceId())) || spaces[0] || null;
    if (currentSpace) setSelectedSpaceId(currentSpace.id);
}

async function attachSpaceThumbnails(collection) {
    const paths = collection.map((space) => space.thumbnail_path || space.foto_path).filter(Boolean);
    if (!paths.length) return collection;
    const signed = await supabaseClient.storage.from(storageBucket).createSignedUrls(paths, 3600);
    if (signed.error) return collection;
    let index = 0;
    return collection.map((space) => {
        if (!space.thumbnail_path && !space.foto_path) return space;
        return { ...space, thumbnail_url: signed.data[index++]?.signedUrl || '' };
    });
}

async function ensureSpaceForEntityPage() {
    await loadSpaces();
    if (!currentSpace) {
        window.location.replace('index.html');
        return false;
    }
    return true;
}

async function fetchRelations() {
    const [zonasResult, cajasResult] = await Promise.all([
        supabaseClient.from('trastero_zonas').select('id,nombre,espacio_id').eq('espacio_id', currentSpace.id).order('nombre'),
        supabaseClient.from('trastero_cajas').select('id,nombre,zona_id,espacio_id').eq('espacio_id', currentSpace.id).order('nombre')
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

async function attachThumbnails(collection, type = entityType) {
    if (!collection.length) return collection;
    const ids = collection.map((item) => item.id);
    const { data, error } = await supabaseClient
        .from('trastero_fotos')
        .select('relacion_id,storage_path,thumbnail_path,created_at')
        .eq('tipo', type)
        .in('relacion_id', ids)
        .order('created_at', { ascending: true });
    if (error || !data?.length) return collection;
    const firstPhotoByItem = new Map();
    data.forEach((photo) => {
        if (!firstPhotoByItem.has(String(photo.relacion_id))) firstPhotoByItem.set(String(photo.relacion_id), photo);
    });
    const paths = [...firstPhotoByItem.values()].map((photo) => photo.thumbnail_path || photo.storage_path);
    const signed = await supabaseClient.storage.from(storageBucket).createSignedUrls(paths, 3600);
    if (signed.error) return collection;
    const urlByItem = new Map();
    [...firstPhotoByItem.keys()].forEach((id, index) => urlByItem.set(id, signed.data[index]?.signedUrl || ''));
    return collection.map((item) => ({ ...item, thumbnail_url: urlByItem.get(String(item.id)) || '' }));
}

async function initHome() {
    await loadSpaces();
    if (!currentSpace) {
        renderSpaceChooser();
        return;
    }
    await renderDashboard();
}

function renderHomeFrame(content) {
    const shell = document.getElementById('app-shell');
    shell.className = 'app-shell trastero-home-shell';
    shell.innerHTML = `
        <header class="home-topbar">
            <button class="home-icon-button" type="button" data-action="open-space-menu" aria-label="Menú">☰</button>
            <div class="home-brand"><span class="home-logo">T</span><h1>Trastero</h1><p>${currentSpace ? escapeHtml(currentSpace.nombre) : 'Gestiona tus cosas, encuentra todo'}</p></div>
            <button class="home-icon-button" type="button" data-action="open-user-menu" aria-label="Usuario">◎</button>
        </header>
        <div id="space-drawer" class="drawer" hidden>
            <button class="drawer-close" type="button" data-action="close-menus">×</button>
            <h2>Espacios</h2>
            <div class="drawer-list">${spaces.map((space) => `<button type="button" data-action="select-space" data-id="${space.id}">${renderSpaceThumb(space)}<span>${escapeHtml(space.nombre)}</span></button>`).join('')}</div>
            <button class="button" type="button" data-action="new-space">Crear espacio</button>
        </div>
        <div id="user-menu" class="drawer drawer-right" hidden>
            <button class="drawer-close" type="button" data-action="close-menus">×</button>
            <h2>Cuenta</h2>
            <button type="button" data-action="private-home">Zona privada</button>
            <button type="button" data-action="logout">Cerrar sesión</button>
        </div>
        <main class="home-content">${content}</main>
        <section id="space-form-panel" class="detail-card space-form-panel" hidden>
            <div class="detail-card-heading"><h3>Nuevo espacio</h3><button class="icon-button" type="button" data-action="close-space-form">×</button></div>
            <form id="space-form">
                <label for="space-name">Nombre</label>
                <input id="space-name" required maxlength="150" placeholder="Casa, piso de la playa...">
                <label for="space-photo">Foto</label>
                <input id="space-photo" type="file" accept="image/*">
                <button class="button" type="submit">Guardar espacio</button>
            </form>
        </section>`;
    bindHomeActions();
}

function renderSpaceThumb(space) {
    return space.thumbnail_url ? `<img src="${escapeHtml(space.thumbnail_url)}" alt="">` : `<span>${entityInitial('espacio')}</span>`;
}

function renderSpaceChooser() {
    renderHomeFrame(`
        <section class="space-empty">
            <h2>Elige tu espacio</h2>
            <p>Crea un espacio para empezar a organizar zonas, cajas y objetos.</p>
            <button class="button" type="button" data-action="new-space">Crear espacio</button>
        </section>`);
}

async function renderDashboard() {
    const [zones, boxes, objects] = await Promise.all([
        countTable('trastero_zonas'),
        countTable('trastero_cajas'),
        countTable('trastero_objetos')
    ]);
    renderHomeFrame(`
        <section class="home-search">
            <input id="global-search" type="search" placeholder="Buscar en zonas, cajas u objetos..." autocomplete="off">
            <p>Busca por nombres, notas, ubicación... en todo tu trastero</p>
            <div id="search-results" class="search-results"></div>
        </section>
        <h2 class="home-section-title">Gestionar</h2>
        <section class="manage-grid">
            ${homeManageCard('zonas.html', 'Zonas', 'Gestiona las zonas de tu casa', `${zones} zonas`, 'blue')}
            ${homeManageCard('cajas.html', 'Cajas', 'Gestiona tus cajas guardadas', `${boxes} cajas`, 'green')}
            ${homeManageCard('objetos.html', 'Objetos', 'Gestiona los objetos que tienes', `${objects} objetos`, 'purple')}
        </section>
        <h2 class="home-section-title">Crear nuevo</h2>
        <section class="create-grid">
            <a class="create-card orange" href="cajas.html?new=1"><strong>Nueva caja</strong><span>Añade una nueva caja a tu trastero</span></a>
            <a class="create-card purple" href="objetos.html?new=1"><strong>Nuevo objeto</strong><span>Añade un nuevo objeto a tu trastero</span></a>
        </section>
        <h2 class="home-section-title">Acceso rápido</h2>
        <section class="quick-grid">
            ${quickCard('zonas.html', 'Todas las zonas', 'Ver todas tus zonas')}
            ${quickCard('cajas.html', 'Todas las cajas', 'Ver todas tus cajas')}
            ${quickCard('objetos.html', 'Todos los objetos', 'Ver todos tus objetos')}
        </section>`);
    let timer;
    document.getElementById('global-search').addEventListener('input', (event) => {
        clearTimeout(timer);
        timer = setTimeout(() => globalSearch(event.target.value.trim()), 250);
    });
}

async function countTable(table) {
    const { count } = await supabaseClient.from(table).select('*', { count: 'exact', head: true }).eq('espacio_id', currentSpace.id);
    return count || 0;
}

function homeManageCard(href, title, text, count, tone) {
    return `<a class="manage-card ${tone}" href="${href}"><span class="manage-icon">${title[0]}</span><b>›</b><strong>${title}</strong><p>${text}</p><em>${count}</em></a>`;
}

function quickCard(href, title, text) {
    return `<a class="quick-card" href="${href}"><span>${title[0]}</span><strong>${title}</strong><small>${text}</small><b>›</b></a>`;
}

function bindHomeActions() {
    document.getElementById('app-shell').onclick = async (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;
        const action = actionElement.dataset.action;
        if (action === 'open-space-menu') document.getElementById('space-drawer').hidden = false;
        if (action === 'open-user-menu') document.getElementById('user-menu').hidden = false;
        if (action === 'close-menus') closeMenus();
        if (action === 'new-space') openSpaceForm();
        if (action === 'close-space-form') closeSpaceForm();
        if (action === 'select-space') {
            setSelectedSpaceId(actionElement.dataset.id);
            await initHome();
        }
        if (action === 'private-home') window.location.href = '../Privado/index.html';
        if (action === 'logout') {
            await supabaseClient.auth.signOut();
            window.location.href = '../Privado/index.html';
        }
    };
    document.getElementById('space-form')?.addEventListener('submit', saveSpace);
}

function closeMenus() {
    document.getElementById('space-drawer')?.setAttribute('hidden', '');
    document.getElementById('user-menu')?.setAttribute('hidden', '');
}

function openSpaceForm() {
    closeMenus();
    document.getElementById('space-form-panel').hidden = false;
    document.getElementById('space-form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeSpaceForm() {
    document.getElementById('space-form-panel').hidden = true;
}

async function saveSpace(event) {
    event.preventDefault();
    const name = document.getElementById('space-name').value.trim();
    const file = document.getElementById('space-photo').files[0];
    const { data, error } = await supabaseClient.from('trastero_espacios').insert({ user_id: currentUser.id, nombre: name }).select().single();
    if (error) {
        showToast(`No se pudo crear el espacio: ${error.message}`, true);
        return;
    }
    if (file) await uploadSpacePhoto(data.id, file);
    setSelectedSpaceId(data.id);
    showToast('Espacio creado.');
    await initHome();
}

async function uploadSpacePhoto(spaceId, file) {
    const [optimized, thumbnail] = await Promise.all([optimizeImage(file), createThumbnail(file)]);
    const path = `${currentUser.id}/espacios/${spaceId}/foto.jpg`;
    const thumbnailPath = `${currentUser.id}/espacios/${spaceId}/thumb.jpg`;
    const upload = await supabaseClient.storage.from(storageBucket).upload(path, optimized, { contentType: 'image/jpeg', upsert: true });
    if (upload.error) throw upload.error;
    const thumbnailUpload = await supabaseClient.storage.from(storageBucket).upload(thumbnailPath, thumbnail, { contentType: 'image/jpeg', upsert: true });
    if (thumbnailUpload.error) throw thumbnailUpload.error;
    const { error } = await supabaseClient.from('trastero_espacios').update({ foto_path: path, thumbnail_path: thumbnailPath }).eq('id', spaceId);
    if (error) throw error;
}

async function globalSearch(term) {
    const resultsBox = document.getElementById('search-results');
    if (!resultsBox) return;
    if (term.length < 2) {
        resultsBox.innerHTML = '';
        return;
    }
    const safeTerm = term.replace(/[%_,()]/g, ' ');
    const [zoneResult, boxResult, objectResult] = await Promise.all([
        supabaseClient.from('trastero_zonas').select('*').eq('espacio_id', currentSpace.id).or(`nombre.ilike.%${safeTerm}%,notas.ilike.%${safeTerm}%`).limit(20),
        supabaseClient.from('trastero_cajas').select('*').eq('espacio_id', currentSpace.id).or(`nombre.ilike.%${safeTerm}%,notas.ilike.%${safeTerm}%,ubicacion.ilike.%${safeTerm}%`).limit(20),
        supabaseClient.from('trastero_objetos').select('*').eq('espacio_id', currentSpace.id).or(`nombre.ilike.%${safeTerm}%,notas.ilike.%${safeTerm}%`).limit(20)
    ]);
    const error = zoneResult.error || boxResult.error || objectResult.error;
    if (error) {
        resultsBox.innerHTML = '<p class="empty-state">No se pudo completar la búsqueda.</p>';
        return;
    }
    const combined = [
        ...zoneResult.data.map((item) => ({ ...item, tipo: 'zona', url: 'zonas.html' })),
        ...boxResult.data.map((item) => ({ ...item, tipo: 'caja', url: 'cajas.html' })),
        ...objectResult.data.map((item) => ({ ...item, tipo: 'objeto', url: 'objetos.html' }))
    ];
    resultsBox.innerHTML = combined.length ? combined.map((item) => `<a class="search-result-card" href="${item.url}?id=${item.id}"><strong>${escapeHtml(item.nombre)}</strong><span>${item.tipo}</span><small>${escapeHtml(item.ubicacion || item.notas || 'Sin notas')}</small></a>`).join('') : '<p class="empty-state">No hay coincidencias.</p>';
}

async function initEntityPage() {
    if (!await ensureSpaceForEntityPage()) return;
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
    if (requestedId) {
        document.getElementById('entity-list').closest('.panel').hidden = true;
        document.getElementById('form-panel').hidden = true;
        document.querySelector('.app-nav').hidden = true;
        document.querySelector('.back-link').hidden = true;
        await showDetail(requestedId);
        return;
    }
    if (queryParam('new') === '1') openForm(null, { zona_id: queryParam('zona_id'), caja_id: queryParam('caja_id') });
}

async function loadItems() {
    const { data, error } = await supabaseClient.from(config[entityType].table).select('*').eq('espacio_id', currentSpace.id).order('nombre');
    if (error) {
        showToast('No se pudieron cargar los datos.', true);
        return;
    }
    items = await attachThumbnails(data || []);
    renderList();
}

function renderList() {
    const term = document.getElementById('list-filter').value.trim().toLowerCase();
    const filtered = items.filter((item) => [item.nombre, item.notas, item.ubicacion, itemMeta(item)].some((value) => String(value || '').toLowerCase().includes(term)));
    const compact = entityType === 'objeto';
    document.getElementById('entity-list').innerHTML = filtered.length ? filtered.map((item) => `
        <article class="entity-card entity-list-row ${compact ? 'compact-object-row' : ''}">
            ${renderThumbnail(item, entityType)}
            <button class="entity-list-content" type="button" data-action="view" data-id="${item.id}">
                <span class="entity-type">${config[entityType].label}</span>
                <strong>${escapeHtml(item.nombre)}</strong>
                ${itemMeta(item) ? `<span class="meta-line">${escapeHtml(itemMeta(item))}</span>` : ''}
                <span class="entity-summary">${item.notas ? escapeHtml(item.notas) : 'Sin notas'}</span>
            </button>
            <button class="row-action" type="button" data-action="edit" data-id="${item.id}" aria-label="Editar">Editar</button>
        </article>`).join('') : '<p class="empty-state">No hay elementos que mostrar.</p>';
}

function renderThumbnail(item, type = entityType, className = 'entity-thumbnail') {
    return item.thumbnail_url
        ? `<img class="${className}" src="${escapeHtml(item.thumbnail_url)}" alt="" loading="lazy">`
        : `<span class="${className} thumbnail-placeholder" aria-hidden="true">${entityInitial(type)}</span>`;
}

function handleListAction(event) {
    const button = event.target.closest('[data-action][data-id]');
    if (!button) return;
    if (button.dataset.action === 'view') window.location.href = `${config[entityType].page}?id=${button.dataset.id}`;
    if (button.dataset.action === 'edit') {
        const item = items.find((candidate) => String(candidate.id) === button.dataset.id);
        openForm(item);
    }
}

function openForm(item = null, defaults = {}) {
    currentItem = item;
    currentCreateContext = item ? {} : { ...defaults };
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
    currentCreateContext = {};
}

async function saveItem(event) {
    event.preventDefault();
    const submit = event.target.querySelector('[type="submit"]');
    submit.disabled = true;
    const id = document.getElementById('entity-id').value;
    const createContext = { ...currentCreateContext };
    const payload = { user_id: currentUser.id, espacio_id: currentSpace.id };
    config[entityType].fields.forEach((field) => {
        const value = document.getElementById(field)?.value.trim();
        payload[field] = value || null;
    });
    const result = id
        ? await supabaseClient.from(config[entityType].table).update(payload).eq('id', id).select().single()
        : await supabaseClient.from(config[entityType].table).insert(payload).select().single();
    submit.disabled = false;
    if (result.error) {
        showToast(`No se pudo guardar: ${result.error.message}`, true);
        return;
    }
    showToast(`${config[entityType].label} guardada.`);
    closeForm();
    await fetchRelations();
    await loadItems();
    const repeatContext = getRepeatContext(createContext, payload);
    if (!id && repeatContext && window.confirm(repeatContext.question)) {
        openForm(null, repeatContext.defaults);
        return;
    }
    window.location.href = `${config[entityType].page}?id=${result.data.id}`;
}

function getRepeatContext(createContext, payload) {
    if (entityType === 'caja' && createContext.zona_id && payload.zona_id) return { question: 'Caja creada. ¿Quieres crear otra caja en esta misma zona?', defaults: { zona_id: payload.zona_id } };
    if (entityType === 'objeto' && createContext.caja_id && payload.caja_id) return { question: 'Objeto creado. ¿Quieres crear otro objeto en esta misma caja?', defaults: { caja_id: payload.caja_id, zona_id: payload.zona_id } };
    return null;
}

async function loadRelatedItems(item) {
    if (entityType === 'zona') {
        const { data, error } = await supabaseClient.from('trastero_cajas').select('id,nombre,ubicacion,notas').eq('espacio_id', currentSpace.id).eq('zona_id', item.id).order('nombre');
        if (error) throw error;
        return { label: 'Cajas en esta zona', itemLabel: 'caja', url: 'cajas.html', createUrl: `cajas.html?new=1&zona_id=${item.id}`, createLabel: 'Añadir caja', items: await attachThumbnails(data || [], 'caja') };
    }
    if (entityType === 'caja') {
        const { data, error } = await supabaseClient.from('trastero_objetos').select('id,nombre,notas').eq('espacio_id', currentSpace.id).eq('caja_id', item.id).order('nombre');
        if (error) throw error;
        return { label: 'Objetos en esta caja', itemLabel: 'objeto', url: 'objetos.html', createUrl: `objetos.html?new=1&caja_id=${item.id}${item.zona_id ? `&zona_id=${item.zona_id}` : ''}`, createLabel: 'Añadir objeto', items: await attachThumbnails(data || [], 'objeto') };
    }
    return null;
}

function renderRelatedItems(related) {
    if (!related) return '';
    const rows = related.items.length ? related.items.map((item) => `
        <a class="related-row ${related.itemLabel === 'objeto' ? 'compact-related-row' : ''}" href="${related.url}?id=${item.id}">
            ${renderThumbnail(item, related.itemLabel, 'related-thumbnail')}
            <span class="related-copy"><strong>${escapeHtml(item.nombre)}</strong><span>${escapeHtml(item.ubicacion || item.notas || 'Sin notas')}</span></span>
            <span class="related-chevron" aria-hidden="true">›</span>
        </a>`).join('') : `<p class="empty-state">No hay ${related.itemLabel === 'caja' ? 'cajas' : 'objetos'} asociados.</p>`;
    return `<section class="detail-card related-items"><div class="detail-card-heading"><h3>${related.label} (${related.items.length})</h3><a href="${related.createUrl}">+ ${related.createLabel}</a></div><div class="related-list">${rows}</div></section>`;
}

function renderInfoRows(item) {
    const rows = [];
    rows.push(['Espacio', currentSpace.nombre]);
    if (entityType !== 'zona') rows.push(['Zona', relationName(zonas, item.zona_id) || 'Sin zona']);
    if (entityType === 'objeto') rows.push(['Caja', relationName(cajas, item.caja_id) || 'Sin caja']);
    if (entityType === 'caja') rows.push(['Ubicación', item.ubicacion || 'Sin ubicación']);
    rows.push(['Notas', item.notas || 'Sin notas']);
    rows.push(['Creado', formatDate(item.created_at)]);
    rows.push(['Actualizado', formatDate(item.updated_at)]);
    return rows.map(([label, value]) => `<div class="info-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

async function showDetail(id) {
    const { data: item, error } = await supabaseClient.from(config[entityType].table).select('*').eq('espacio_id', currentSpace.id).eq('id', id).single();
    if (error || !item) {
        showToast('No se pudo abrir la ficha.', true);
        window.location.href = config[entityType].page;
        return;
    }
    currentItem = item;
    let photos;
    let related;
    try {
        [photos, related] = await Promise.all([loadPhotos(item.id), loadRelatedItems(item)]);
    } catch (loadError) {
        showToast(`No se pudieron cargar los elementos relacionados: ${loadError.message}`, true);
        photos = await loadPhotos(item.id);
        related = null;
    }
    const extraActions = entityType === 'zona'
        ? `<a class="button button-success" href="cajas.html?new=1&zona_id=${item.id}">Crear caja</a><a class="button button-success" href="objetos.html?new=1&zona_id=${item.id}">Crear objeto</a>`
        : entityType === 'caja'
            ? `<a class="button button-success" href="objetos.html?new=1&caja_id=${item.id}${item.zona_id ? `&zona_id=${item.zona_id}` : ''}">Crear objeto</a>`
            : '';
    const mainPhoto = photos[0]?.signed_url || '';
    const locationLines = [];
    if (item.zona_id) locationLines.push(`<span><b>Zona</b> ${escapeHtml(relationName(zonas, item.zona_id))}</span>`);
    if (item.caja_id) locationLines.push(`<span><b>Caja</b> ${escapeHtml(relationName(cajas, item.caja_id))}</span>`);
    if (item.ubicacion) locationLines.push(`<span><b>Ubicación</b> ${escapeHtml(item.ubicacion)}</span>`);
    const panel = document.getElementById('detail-panel');
    panel.classList.add('detail-panel');
    panel.innerHTML = `
        <div class="detail-topbar"><button class="detail-back" type="button" data-action="back-list" aria-label="Volver">‹</button><span class="detail-type-mark">${entityInitial()}</span><strong>${config[entityType].label}</strong></div>
        <section class="detail-card detail-hero">
            ${mainPhoto ? `<img class="detail-main-photo" src="${escapeHtml(mainPhoto)}" alt="Foto de ${escapeHtml(item.nombre)}">` : `<span class="detail-main-photo thumbnail-placeholder">${entityInitial()}</span>`}
            <div class="detail-hero-copy">
                <div class="detail-title-row"><h2>${escapeHtml(item.nombre)}</h2><button class="photo-count-button" type="button" data-action="focus-photos">Fotos (${photos.length})</button></div>
                <div class="detail-locations">${locationLines.join('') || `<span><b>Espacio</b> ${escapeHtml(currentSpace.nombre)}</span>`}</div>
            </div>
            <div class="detail-notes-card"><h3>Notas</h3><p>${formatNotes(item.notas)}</p><button type="button" data-action="edit-detail">Editar</button></div>
        </section>
        <section class="detail-card detail-information"><h3>Información</h3>${renderInfoRows(item)}</section>
        ${renderRelatedItems(related)}
        <section id="detail-photos" class="detail-card photo-upload">
            <div class="detail-card-heading"><h3>Fotos (${photos.length})</h3><label class="photo-add-button" for="photo-input">+ Añadir foto</label></div>
            <p class="help-text">Las imágenes se comprimen antes de subirlas.</p>
            <input id="photo-input" class="sr-only" type="file" accept="image/*" capture="environment">
            <div class="photos-grid">${renderPhotos(photos)}</div>
        </section>
        <div class="detail-actions"><button class="button detail-edit" type="button" data-action="edit-detail">Editar</button><button class="button detail-delete" type="button" data-action="delete">Eliminar</button>${extraActions}</div>`;
    panel.hidden = false;
}

function handleDetailAction(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'back-list') window.location.href = config[entityType].page;
    if (action === 'edit-detail') openForm(currentItem);
    if (action === 'delete') deleteItem();
    if (action === 'delete-photo') deletePhoto(event.target.closest('[data-photo-id]'));
    if (action === 'focus-photos') document.getElementById('detail-photos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteItem() {
    if (!currentItem || !window.confirm(`¿Eliminar "${currentItem.nombre}"? Las fotos asociadas también se eliminarán.`)) return;
    const photos = await loadPhotos(currentItem.id);
    if (photos.length) await supabaseClient.storage.from(storageBucket).remove(photos.flatMap((photo) => [photo.storage_path, photo.thumbnail_path].filter(Boolean)));
    if (photos.length) await supabaseClient.from('trastero_fotos').delete().eq('tipo', entityType).eq('relacion_id', currentItem.id);
    const { error } = await supabaseClient.from(config[entityType].table).delete().eq('id', currentItem.id);
    if (error) {
        showToast(`No se pudo eliminar: ${error.message}`, true);
        return;
    }
    showToast(`${config[entityType].label} eliminada.`);
    window.location.href = config[entityType].page;
}

async function loadPhotos(relationId) {
    const { data, error } = await supabaseClient.from('trastero_fotos').select('*').eq('tipo', entityType).eq('relacion_id', relationId).order('created_at', { ascending: false });
    if (error) {
        showToast('No se pudieron cargar las fotos.', true);
        return [];
    }
    const photos = data || [];
    if (!photos.length) return photos;
    const paths = photos.flatMap((photo) => [photo.storage_path, photo.thumbnail_path].filter(Boolean));
    const signed = await supabaseClient.storage.from(storageBucket).createSignedUrls(paths, 3600);
    if (signed.error) return photos;
    let signedIndex = 0;
    return photos.map((photo) => {
        const signedUrl = signed.data[signedIndex++]?.signedUrl || '';
        const thumbnailUrl = photo.thumbnail_path ? signed.data[signedIndex++]?.signedUrl || signedUrl : signedUrl;
        return { ...photo, signed_url: signedUrl, thumbnail_url: thumbnailUrl };
    });
}

function renderPhotos(photos) {
    if (!photos.length) return '<p class="empty-state">Todavía no hay fotos.</p>';
    return photos.map((photo) => `<figure class="photo-card"><a href="${escapeHtml(photo.signed_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(photo.thumbnail_url)}" alt="Foto de ${escapeHtml(currentItem.nombre)}" loading="lazy"></a><div class="photo-actions"><button class="button button-small button-danger" type="button" data-action="delete-photo" data-photo-id="${photo.id}" data-path="${escapeHtml(photo.storage_path)}" data-thumbnail-path="${escapeHtml(photo.thumbnail_path || '')}">Eliminar</button></div></figure>`).join('');
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
        if (quality > .34) quality -= .08;
        else {
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

async function createThumbnail(file) {
    const bitmap = await createImageBitmap(file);
    const size = 320;
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').drawImage(bitmap, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .72));
    bitmap.close();
    return blob;
}

document.addEventListener('change', async (event) => {
    if (event.target.id !== 'photo-input' || !event.target.files[0] || !currentItem) return;
    const input = event.target;
    input.disabled = true;
    try {
        const [optimized, thumbnail] = await Promise.all([optimizeImage(input.files[0]), createThumbnail(input.files[0])]);
        const folder = `${entityType}s`;
        const photoId = crypto.randomUUID();
        const path = `${currentUser.id}/${folder}/${currentItem.id}/${photoId}.jpg`;
        const thumbnailPath = `${currentUser.id}/${folder}/${currentItem.id}/thumbs/${photoId}.jpg`;
        const upload = await supabaseClient.storage.from(storageBucket).upload(path, optimized, { contentType: 'image/jpeg', upsert: false });
        if (upload.error) throw upload.error;
        const thumbnailUpload = await supabaseClient.storage.from(storageBucket).upload(thumbnailPath, thumbnail, { contentType: 'image/jpeg', upsert: false });
        if (thumbnailUpload.error) {
            await supabaseClient.storage.from(storageBucket).remove([path]);
            throw thumbnailUpload.error;
        }
        const record = await supabaseClient.from('trastero_fotos').insert({ user_id: currentUser.id, tipo: entityType, relacion_id: currentItem.id, storage_path: path, thumbnail_path: thumbnailPath });
        if (record.error) {
            await supabaseClient.storage.from(storageBucket).remove([path, thumbnailPath]);
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
    const paths = [button.dataset.path, button.dataset.thumbnailPath].filter(Boolean);
    const storageResult = await supabaseClient.storage.from(storageBucket).remove(paths);
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
