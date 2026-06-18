const supabaseClient = window.websSupabase;
const storageBucket = 'trastero-fotos';
const folderIcon = 'assets/folder-box.png';
const folderTreeIcon = 'assets/folder-tree.png';
const itemIcon = 'assets/item-box.png';
const searchIcon = 'assets/search.png';
const scanIcon = 'assets/scan.png';
const photoIcon = 'assets/photo.png';

let currentUser = null;
let folders = [];
let items = [];
let folderCovers = new Map();
let itemCovers = new Map();
let folderPhotoMap = new Map();
let itemPhotoMap = new Map();
let toastTimer = null;
let searchOpen = false;
let activeGalleryPhotos = [];
let activeGalleryIndex = 0;

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function params() {
    return new URLSearchParams(window.location.search);
}

function currentRoute() {
    const query = params();
    return {
        folderId: query.get('folder'),
        itemId: query.get('item')
    };
}

function showToast(message, error = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast${error ? ' error' : ''}`;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
}

async function requireAccess() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
        window.location.replace(`../Privado/index.html?next=${encodeURIComponent('../Trastero/index.html')}`);
        return false;
    }
    const { data: profile, error } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).single();
    if (error || profile?.role !== 'admin') {
        document.getElementById('app-loading').textContent = 'No tienes permiso de administrador para acceder a Trastero.';
        return false;
    }
    currentUser = session.user;
    document.getElementById('app-loading').hidden = true;
    document.getElementById('app-shell').hidden = false;
    return true;
}

async function loadData() {
    const [folderResult, itemResult] = await Promise.all([
        supabaseClient.from('trastero_carpetas').select('*').order('nombre'),
        supabaseClient.from('trastero_items').select('*').order('nombre')
    ]);
    if (folderResult.error || itemResult.error) throw folderResult.error || itemResult.error;
    folders = folderResult.data || [];
    items = itemResult.data || [];
    [folderPhotoMap, itemPhotoMap] = await Promise.all([
        loadPhotoMap('carpeta', folders.map((folder) => folder.id)),
        loadPhotoMap('item', items.map((item) => item.id))
    ]);
    folderCovers = coverMap(folderPhotoMap);
    itemCovers = coverMap(itemPhotoMap);
}

function coverMap(photoMap) {
    const map = new Map();
    photoMap.forEach((photos, id) => {
        if (photos.length) map.set(id, photos[0]);
    });
    return map;
}

async function loadPhotoMap(type, ids) {
    const map = new Map();
    if (!ids.length) return map;
    const { data, error } = await supabaseClient
        .from('trastero_fotos')
        .select('*')
        .eq('tipo', type)
        .in('relacion_id', ids)
        .order('es_portada', { ascending: false })
        .order('created_at', { ascending: false });
    if (error || !data?.length) return map;
    const paths = [...new Set(data.flatMap((photo) => [photo.storage_path, photo.thumbnail_path || photo.storage_path]).filter(Boolean))];
    const signed = await supabaseClient.storage.from(storageBucket).createSignedUrls(paths, 3600);
    if (signed.error) return map;
    const signedByPath = new Map(paths.map((path, index) => [path, signed.data[index]?.signedUrl || '']));
    data.forEach((photo) => {
        const key = String(photo.relacion_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({
            ...photo,
            url: signedByPath.get(photo.storage_path) || '',
            thumbUrl: signedByPath.get(photo.thumbnail_path || photo.storage_path) || ''
        });
    });
    return map;
}

function photosFor(type, relationId) {
    const map = type === 'carpeta' ? folderPhotoMap : itemPhotoMap;
    return map.get(String(relationId)) || [];
}

function folderById(id) {
    return folders.find((folder) => String(folder.id) === String(id)) || null;
}

function itemById(id) {
    return items.find((item) => String(item.id) === String(id)) || null;
}

function childrenOf(parentId) {
    return folders.filter((folder) => String(folder.parent_id || '') === String(parentId || ''));
}

function itemsOf(folderId) {
    return items.filter((item) => String(item.carpeta_id || '') === String(folderId || ''));
}

function pathToFolder(folderId) {
    const path = [];
    let cursor = folderById(folderId);
    const guard = new Set();
    while (cursor && !guard.has(String(cursor.id))) {
        path.unshift(cursor);
        guard.add(String(cursor.id));
        cursor = cursor.parent_id ? folderById(cursor.parent_id) : null;
    }
    return path;
}

function pathLabel(folderId, fallback = 'Root Level Items') {
    const path = pathToFolder(folderId);
    return path.length ? path.map((folder) => folder.nombre).join(' / ') : fallback;
}

function navigateToFolder(folderId = '') {
    const url = folderId ? `index.html?folder=${encodeURIComponent(folderId)}` : 'index.html';
    history.pushState({}, '', url);
    renderCurrent();
}

function navigateToItem(itemId) {
    history.pushState({}, '', `index.html?item=${encodeURIComponent(itemId)}`);
    renderCurrent();
}

function formatQuantity(item) {
    const quantity = item.cantidad ?? 1;
    return `${Number(quantity).toLocaleString('es-ES')} ${item.unidad || 'unit'}`;
}

function renderCurrent() {
    const route = currentRoute();
    if (route.itemId) renderItemDetail(route.itemId);
    else renderFolderView(route.folderId || '');
}

function renderFolderView(folderId = '') {
    const currentFolder = folderId ? folderById(folderId) : null;
    if (folderId && !currentFolder) {
        navigateToFolder('');
        return;
    }
    const childFolders = childrenOf(folderId);
    const childItems = itemsOf(folderId);
    const title = currentFolder?.nombre || 'Items';
    const backTarget = currentFolder?.parent_id || '';
    const folderPhotos = currentFolder ? photosFor('carpeta', currentFolder.id) : [];
    const shell = document.getElementById('app-shell');
    shell.innerHTML = `
        <section class="screen folder-screen">
            ${renderEntityHeader({
                type: 'carpeta',
                id: currentFolder?.id || '',
                title,
                code: currentFolder?.codigo || '',
                path: currentFolder ? pathLabel(folderId, 'Inicio') : '',
                photos: folderPhotos,
                backAction: currentFolder
                    ? `<button class="round-button" type="button" data-action="go-folder" data-id="${backTarget}" aria-label="Volver">←</button>`
                    : `<button class="round-button" type="button" data-action="open-tree" aria-label="Arbol de carpetas"><img class="round-icon" src="${folderTreeIcon}" alt=""></button>`,
                menuAction: `<button class="icon-only-inline" type="button" data-action="folder-menu" data-id="${folderId}" aria-label="Menu">•••</button>`,
                showPhotoControls: Boolean(currentFolder)
            })}
            <section class="stats">
                <div class="stat"><span>Folders</span><strong>${childFolders.length}</strong></div>
                <div class="stat"><span>Items</span><strong>${childItems.length}</strong></div>
            </section>
            ${currentFolder?.notas ? `<section class="notes-panel"><strong>Notas:</strong> ${escapeHtml(currentFolder.notas)}</section>` : ''}
            <section class="content-list">
                ${renderRows(childFolders, childItems)}
            </section>
            <button class="fab" type="button" data-action="open-create-sheet" data-parent="${folderId}" aria-label="Crear">+</button>
        </section>`;
}

function renderRows(childFolders, childItems) {
    const folderRows = childFolders.map((folder) => {
        const cover = folderCovers.get(String(folder.id))?.thumbUrl || folderCovers.get(String(folder.id))?.url || '';
        const folderCount = childrenOf(folder.id).length;
        const itemCount = itemsOf(folder.id).length;
        return `
            <article class="content-row" role="button" tabindex="0" data-action="go-folder" data-id="${folder.id}">
                ${cover ? `<img class="thumb" src="${escapeHtml(cover)}" alt="">` : `<img class="thumb thumb-placeholder" src="${folderIcon}" alt="">`}
                <div class="row-copy">
                    ${folder.codigo ? `<span class="code">Id: ${escapeHtml(folder.codigo)}</span>` : ''}
                    <strong class="row-title">${escapeHtml(folder.nombre)}</strong>
                    <span class="row-meta">
                        <span class="meta-part">${folderCount}<img class="meta-icon" src="${folderIcon}" alt=""></span>
                        <span class="meta-separator">|</span>
                        <span>${itemCount} items</span>
                    </span>
                </div>
                <button class="row-menu" type="button" data-action="row-menu" data-type="folder" data-id="${folder.id}" aria-label="Menu">•••</button>
            </article>`;
    }).join('');
    const itemRows = childItems.map((item) => {
        const cover = itemCovers.get(String(item.id))?.thumbUrl || itemCovers.get(String(item.id))?.url || '';
        return `
            <article class="content-row" role="button" tabindex="0" data-action="go-item" data-id="${item.id}">
                ${cover ? `<img class="thumb item-thumb" src="${escapeHtml(cover)}" alt="">` : `<img class="thumb item-thumb thumb-placeholder" src="${itemIcon}" alt="">`}
                <div class="row-copy">
                    ${item.codigo ? `<span class="code">Id: ${escapeHtml(item.codigo)}</span>` : ''}
                    <strong class="row-title">${escapeHtml(item.nombre)}</strong>
                    <span class="row-meta">${escapeHtml(formatQuantity(item))}</span>
                </div>
                <button class="row-menu" type="button" data-action="row-menu" data-type="item" data-id="${item.id}" aria-label="Menu">•••</button>
            </article>`;
    }).join('');
    return folderRows || itemRows ? `${folderRows}${itemRows}` : '<p class="empty-state">No hay carpetas ni items en este nivel.</p>';
}

function renderEntityHeader({ type, id, title, code = '', path = '', photos = [], backAction, menuAction, showPhotoControls = true }) {
    const cover = photos[0]?.url || '';
    return `
        <div class="topbar-actions-bar">
            <div class="topbar-actions">
                ${backAction}
                <div class="pill-button" aria-label="Acciones">
                    <button class="icon-only-inline search-trigger" type="button" data-action="toggle-search" aria-label="Buscar"><img class="action-icon" src="${searchIcon}" alt=""></button>
                    <button class="icon-only-inline" type="button" data-action="scan-code" aria-label="Escanear"><img class="action-icon" src="${scanIcon}" alt=""></button>
                    ${menuAction}
                </div>
            </div>
            ${searchOpen ? renderSearchPanel() : ''}
        </div>
        <header class="topbar">
            ${cover ? `<section class="folder-hero"><img src="${escapeHtml(cover)}" alt="Foto de ${escapeHtml(title)}"></section>` : ''}
            <div class="title-block">
                <h1>${escapeHtml(title)}</h1>
                ${path ? `<div class="breadcrumb">${escapeHtml(path)}</div>` : ''}
                ${code ? `<div class="entity-code">id: ${escapeHtml(code)}</div>` : ''}
            </div>
            ${showPhotoControls ? renderPhotoStack(type, id) : ''}
            ${showPhotoControls && !photos.length ? renderPhotoPrompt(type, id) : ''}
        </header>`;
}

function renderPhotoStack(type, relationId) {
    const photos = photosFor(type, relationId);
    if (!photos.length) return '';
    const visible = photos.slice(0, 3);
    const extra = photos.length - visible.length;
    return `
        <div class="photo-gallery-row">
            <button class="photo-stack" type="button" data-action="open-photos" data-type="${type}" data-id="${relationId}" aria-label="Abrir galeria">
                ${visible.map((photo, index) => `
                    <span class="photo-stack-item">
                        <img src="${escapeHtml(photo.thumbUrl || photo.url)}" alt="">
                        ${index === 2 && extra > 0 ? `<span class="photo-stack-more">+${extra}</span>` : ''}
                    </span>`).join('')}
            </button>
            ${renderPhotoPrompt(type, relationId)}
        </div>`;
}

function renderPhotoPrompt(type, relationId) {
    return `
        <button class="photo-empty-action" type="button" data-action="open-photos" data-type="${type}" data-id="${relationId}" aria-label="Añadir foto">
            <img class="action-icon" src="${photoIcon}" alt="">
        </button>`;
}

function renderSearchPanel() {
    return `
        <section class="search-panel">
            <input id="global-search" type="search" placeholder="Buscar por nombre, codigo o notas..." autocomplete="off">
            <div id="search-results" class="search-results"></div>
        </section>`;
}

function renderItemDetail(itemId) {
    const item = itemById(itemId);
    if (!item) {
        navigateToFolder('');
        return;
    }
    const folder = item.carpeta_id ? folderById(item.carpeta_id) : null;
    const itemPhotos = photosFor('item', item.id);
    const shell = document.getElementById('app-shell');
    shell.innerHTML = `
        <section class="screen item-screen">
            ${renderEntityHeader({
                type: 'item',
                id: item.id,
                title: item.nombre,
                code: item.codigo || '',
                path: pathLabel(item.carpeta_id, 'Root Level Items'),
                photos: itemPhotos,
                backAction: `<button class="round-button" type="button" data-action="go-folder" data-id="${item.carpeta_id || ''}" aria-label="Volver">←</button>`,
                menuAction: `<button class="icon-only-inline" type="button" data-action="row-menu" data-type="item" data-id="${item.id}" aria-label="Menu">•••</button>`
            })}
            <section class="detail-grid">
                <div class="detail-row"><span>Cantidad</span><strong>${escapeHtml(formatQuantity(item))}</strong></div>
                <div class="detail-row"><span>Notas</span><strong>${escapeHtml(item.notas || 'Sin notas')}</strong></div>
            </section>
        </section>`;
}

function renderSearchResults(term) {
    const box = document.getElementById('search-results');
    if (!box) return;
    const normalized = term.trim().toLowerCase();
    if (normalized.length < 2) {
        box.innerHTML = '';
        return;
    }
    const folderResults = folders.filter((folder) => [folder.nombre, folder.codigo, folder.notas].some((value) => String(value || '').toLowerCase().includes(normalized))).map((folder) => ({
        type: 'folder',
        id: folder.id,
        title: folder.nombre,
        code: folder.codigo,
        path: pathLabel(folder.parent_id, 'Root Level Items')
    }));
    const itemResults = items.filter((item) => [item.nombre, item.codigo, item.notas].some((value) => String(value || '').toLowerCase().includes(normalized))).map((item) => ({
        type: 'item',
        id: item.id,
        title: item.nombre,
        code: item.codigo,
        path: pathLabel(item.carpeta_id, 'Root Level Items')
    }));
    const results = [...folderResults, ...itemResults].slice(0, 30);
    box.innerHTML = results.length ? results.map((result) => `
        <button class="search-result" type="button" data-action="${result.type === 'folder' ? 'go-folder' : 'go-item'}" data-id="${result.id}" data-search-result="1">
            <strong>${escapeHtml(result.title)}</strong>
            <small>${escapeHtml(`${result.type === 'folder' ? 'Carpeta' : 'Item'}${result.code ? ` · ${result.code}` : ''}`)}</small>
            <small>${escapeHtml(result.path)}</small>
        </button>`).join('') : '<p class="empty-state">Sin resultados.</p>';
}

function openSheet(title, actions) {
    closeOverlay();
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `<section class="sheet"><h2>${escapeHtml(title)}</h2><div class="sheet-actions">${actions.map((action) => `<button type="button" data-sheet-action="${escapeHtml(action.id)}" class="${action.className || ''}">${escapeHtml(action.label)}</button>`).join('')}</div></section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) closeOverlay();
        const button = event.target.closest('[data-sheet-action]');
        if (!button) return;
        const action = actions.find((candidate) => candidate.id === button.dataset.sheetAction);
        closeOverlay();
        action?.handler();
    });
}

function openModal(title, body) {
    closeOverlay();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<section class="modal"><div class="modal-top"><h2>${escapeHtml(title)}</h2><button class="modal-close" type="button" data-action="close-overlay">×</button></div>${body}</section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop || event.target.closest('[data-action="close-overlay"]')) closeOverlay();
    });
    return backdrop;
}

function closeOverlay() {
    document.querySelectorAll('.sheet-backdrop,.modal-backdrop').forEach((node) => node.remove());
}

function openCreateSheet(parentId = '') {
    openSheet('Crear nuevo', [
        { id: 'folder', label: 'Crear carpeta', handler: () => openFolderForm(null, parentId) },
        { id: 'item', label: 'Crear item', handler: () => openItemForm(null, parentId) },
        { id: 'cancel', label: 'Cancelar', className: 'button-muted', handler: () => {} }
    ]);
}

function openRowMenu(type, id) {
    const entity = type === 'folder' ? folderById(id) : itemById(id);
    if (!entity) return;
    openSheet(entity.nombre, [
        { id: 'edit', label: '✎ Editar', handler: () => type === 'folder' ? openFolderForm(entity) : openItemForm(entity) },
        { id: 'move', label: '⇄ Mover', handler: () => type === 'folder' ? moveFolder(entity) : moveItem(entity) },
        { id: 'delete', label: '🗑 Eliminar', className: 'button-danger', handler: () => deleteEntity(type, entity) },
        { id: 'cancel', label: '× Cancelar', className: 'button-muted', handler: () => {} }
    ]);
}

function openFolderForm(folder = null, defaultParentId = '') {
    let selectedParentId = folder ? folder.parent_id || '' : defaultParentId || '';
    const modal = openModal(folder ? 'Editar carpeta' : 'Crear carpeta', `
        <form id="folder-form">
            <label for="folder-name">Nombre</label>
            <input id="folder-name" required maxlength="180" value="${escapeHtml(folder?.nombre || '')}">
            <label for="folder-code">Codigo</label>
            <input id="folder-code" maxlength="80" value="${escapeHtml(folder?.codigo || '')}">
            <label>Carpeta padre</label>
            <div class="picker-row"><div id="folder-parent-label" class="picker-label">${escapeHtml(pathLabel(selectedParentId, 'Nivel raiz'))}</div><button class="button button-muted" type="button" id="pick-folder-parent">Elegir</button></div>
            <label for="folder-notes">Notas</label>
            <textarea id="folder-notes">${escapeHtml(folder?.notas || '')}</textarea>
            <label for="folder-photo">Foto/portada</label>
            <input id="folder-photo" type="file" accept="image/*">
            <div class="form-actions"><button class="button" type="submit">Guardar</button><button class="button button-muted" type="button" data-action="close-overlay">Cancelar</button></div>
        </form>`);
    modal.querySelector('#pick-folder-parent').addEventListener('click', () => {
        openFolderTree({
            selectedId: selectedParentId,
            excludeId: folder?.id,
            onSelect: (id) => {
                selectedParentId = id || '';
                document.getElementById('folder-parent-label').textContent = pathLabel(selectedParentId, 'Nivel raiz');
            }
        });
    });
    modal.querySelector('#folder-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            user_id: currentUser.id,
            parent_id: selectedParentId || null,
            nombre: document.getElementById('folder-name').value.trim(),
            codigo: document.getElementById('folder-code').value.trim() || null,
            notas: document.getElementById('folder-notes').value.trim() || null
        };
        const result = folder
            ? await supabaseClient.from('trastero_carpetas').update(payload).eq('id', folder.id).select().single()
            : await supabaseClient.from('trastero_carpetas').insert(payload).select().single();
        if (result.error) {
            showToast(`No se pudo guardar: ${result.error.message}`, true);
            return;
        }
        const file = document.getElementById('folder-photo').files[0];
        if (file) await uploadPhoto('carpeta', result.data.id, file);
        closeOverlay();
        await refreshAndRender(folder ? null : result.data.id);
    });
}

function openItemForm(item = null, defaultFolderId = '') {
    let selectedFolderId = item ? item.carpeta_id || '' : defaultFolderId || '';
    const modal = openModal(item ? 'Editar item' : 'Crear item', `
        <form id="item-form">
            <label for="item-name">Nombre</label>
            <input id="item-name" required maxlength="180" value="${escapeHtml(item?.nombre || '')}">
            <label for="item-code">Codigo</label>
            <input id="item-code" maxlength="80" value="${escapeHtml(item?.codigo || '')}">
            <label>Carpeta</label>
            <div class="picker-row"><div id="item-folder-label" class="picker-label">${escapeHtml(pathLabel(selectedFolderId, 'Root Level Items'))}</div><button class="button button-muted" type="button" id="pick-item-folder">Elegir</button></div>
            <label for="item-quantity">Cantidad</label>
            <input id="item-quantity" type="number" step="0.01" value="${escapeHtml(item?.cantidad ?? 1)}">
            <label for="item-unit">Unidad</label>
            <input id="item-unit" maxlength="40" value="${escapeHtml(item?.unidad || 'unit')}">
            <label for="item-notes">Notas</label>
            <textarea id="item-notes">${escapeHtml(item?.notas || '')}</textarea>
            <label for="item-photo">Foto/portada</label>
            <input id="item-photo" type="file" accept="image/*">
            <div class="form-actions"><button class="button" type="submit">Guardar</button><button class="button button-muted" type="button" data-action="close-overlay">Cancelar</button></div>
        </form>`);
    modal.querySelector('#pick-item-folder').addEventListener('click', () => {
        openFolderTree({
            selectedId: selectedFolderId,
            onSelect: (id) => {
                selectedFolderId = id || '';
                document.getElementById('item-folder-label').textContent = pathLabel(selectedFolderId, 'Root Level Items');
            }
        });
    });
    modal.querySelector('#item-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            user_id: currentUser.id,
            carpeta_id: selectedFolderId || null,
            nombre: document.getElementById('item-name').value.trim(),
            codigo: document.getElementById('item-code').value.trim() || null,
            cantidad: document.getElementById('item-quantity').value || 1,
            unidad: document.getElementById('item-unit').value.trim() || 'unit',
            notas: document.getElementById('item-notes').value.trim() || null
        };
        const result = item
            ? await supabaseClient.from('trastero_items').update(payload).eq('id', item.id).select().single()
            : await supabaseClient.from('trastero_items').insert(payload).select().single();
        if (result.error) {
            showToast(`No se pudo guardar: ${result.error.message}`, true);
            return;
        }
        const file = document.getElementById('item-photo').files[0];
        if (file) await uploadPhoto('item', result.data.id, file);
        closeOverlay();
        await refreshAndRender(null, result.data.id);
    });
}

function flattenedFolders(parentId = '', level = 0, output = []) {
    childrenOf(parentId).forEach((folder) => {
        output.push({ ...folder, level });
        flattenedFolders(folder.id, level + 1, output);
    });
    return output;
}

function visibleTreeFolders(expanded, parentId = '', level = 0, output = []) {
    childrenOf(parentId).forEach((folder) => {
        output.push({ ...folder, level, hasChildren: childrenOf(folder.id).length > 0 });
        if (expanded.has(String(folder.id))) visibleTreeFolders(expanded, folder.id, level + 1, output);
    });
    return output;
}

function ancestorIds(folderId) {
    const ids = [];
    let cursor = folderById(folderId);
    const guard = new Set();
    while (cursor?.parent_id && !guard.has(String(cursor.parent_id))) {
        ids.unshift(String(cursor.parent_id));
        guard.add(String(cursor.parent_id));
        cursor = folderById(cursor.parent_id);
    }
    return ids;
}

function descendantIds(folderId, output = new Set()) {
    childrenOf(folderId).forEach((folder) => {
        output.add(String(folder.id));
        descendantIds(folder.id, output);
    });
    return output;
}

function openFolderTree({ selectedId = '', excludeId = '', onSelect = null } = {}) {
    const disabled = excludeId ? descendantIds(excludeId) : new Set();
    if (excludeId) disabled.add(String(excludeId));
    const expanded = new Set(ancestorIds(selectedId));
    if (selectedId) expanded.add(String(selectedId));
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop tree-picker-backdrop';
    backdrop.innerHTML = `<section class="modal"><div class="modal-top"><h2>Folders</h2><button class="modal-close" type="button" data-tree-close>×</button></div><input id="tree-search" type="search" placeholder="Search"><div id="tree-list" class="tree-list"></div></section>`;
    document.body.appendChild(backdrop);
    const modal = backdrop.querySelector('.modal');
    const closeTree = () => backdrop.remove();
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop || event.target.closest('[data-tree-close]')) closeTree();
    });
    const renderTree = () => {
        const term = modal.querySelector('#tree-search').value.trim().toLowerCase();
        const rows = term
            ? flattenedFolders().filter((folder) => [folder.nombre, folder.codigo, folder.notas].some((value) => String(value || '').toLowerCase().includes(term))).map((folder) => ({ ...folder, hasChildren: childrenOf(folder.id).length > 0 }))
            : visibleTreeFolders(expanded);
        modal.querySelector('#tree-list').innerHTML = `
            <button class="tree-row ${!selectedId ? 'selected' : ''}" type="button" data-tree-id="">
                <span class="tree-toggle-spacer"></span><span class="tree-copy"><span>▣</span><span>Root Level Items</span></span><span></span>
            </button>
            ${rows.map((folder) => `
                <button class="tree-row ${String(folder.id) === String(selectedId) ? 'selected' : ''} ${disabled.has(String(folder.id)) ? 'disabled' : ''}" style="--level:${folder.level}" type="button" data-tree-id="${folder.id}" data-has-children="${folder.hasChildren ? '1' : '0'}" data-expanded="${expanded.has(String(folder.id)) ? '1' : '0'}" ${disabled.has(String(folder.id)) ? 'disabled' : ''}>
                    <span class="tree-toggle">${folder.hasChildren ? (expanded.has(String(folder.id)) ? '⌄' : '›') : ''}</span>
                    <span class="tree-copy"><span>▰</span><span>${escapeHtml(folder.nombre)}</span></span>
                    ${folder.hasChildren ? '<span class="tree-select" data-tree-select>Elegir</span>' : '<span></span>'}
                </button>`).join('')}`;
    };
    renderTree();
    modal.querySelector('#tree-search').addEventListener('input', renderTree);
    modal.querySelector('#tree-list').addEventListener('click', (event) => {
        const row = event.target.closest('[data-tree-id]');
        if (!row || row.disabled) return;
        const id = row.dataset.treeId;
        const term = modal.querySelector('#tree-search').value.trim();
        if (id && row.dataset.hasChildren === '1' && !event.target.closest('[data-tree-select]') && !term) {
            if (expanded.has(String(id))) expanded.delete(String(id));
            else expanded.add(String(id));
            renderTree();
            return;
        }
        closeTree();
        if (onSelect) onSelect(id);
        else navigateToFolder(id);
    });
}

async function moveFolder(folder) {
    openFolderTree({
        selectedId: folder.parent_id || '',
        excludeId: folder.id,
        onSelect: async (parentId) => {
            if (!await confirmAction('Mover carpeta', `Mover "${folder.nombre}" a ${pathLabel(parentId, 'Nivel raiz')}?`)) return;
            const { error } = await supabaseClient.from('trastero_carpetas').update({ parent_id: parentId || null }).eq('id', folder.id);
            if (error) showToast(`No se pudo mover: ${error.message}`, true);
            else await refreshAndRender(folder.id);
        }
    });
}

async function moveItem(item) {
    openFolderTree({
        selectedId: item.carpeta_id || '',
        onSelect: async (folderId) => {
            if (!await confirmAction('Mover item', `Mover "${item.nombre}" a ${pathLabel(folderId, 'Root Level Items')}?`)) return;
            const { error } = await supabaseClient.from('trastero_items').update({ carpeta_id: folderId || null }).eq('id', item.id);
            if (error) showToast(`No se pudo mover: ${error.message}`, true);
            else await refreshAndRender(null, item.id);
        }
    });
}

function confirmAction(title, message, { html = false } = {}) {
    return new Promise((resolve) => {
        const content = html ? message : `<p>${escapeHtml(message)}</p>`;
        const modal = openModal(title, `${content}<div class="form-actions"><button class="button button-muted" type="button" data-confirm="no">Cancelar</button><button class="button" type="button" data-confirm="yes">Confirmar</button></div>`);
        modal.addEventListener('click', (event) => {
            const button = event.target.closest('[data-confirm]');
            if (!button) return;
            const ok = button.dataset.confirm === 'yes';
            closeOverlay();
            resolve(ok);
        });
    });
}

async function deleteEntity(type, entity) {
    const label = type === 'folder' ? 'carpeta' : 'item';
    if (!await confirmAction(`Eliminar ${label}`, `Eliminar "${entity.nombre}"?`)) return;
    const photos = type === 'folder' ? await collectFolderTreePhotos(entity.id) : await collectPhotos('item', [entity.id]);
    if (photos.length) {
        await supabaseClient.storage.from(storageBucket).remove(photoPaths(photos));
        await supabaseClient.from('trastero_fotos').delete().in('id', photos.map((photo) => photo.id));
    }
    const table = type === 'folder' ? 'trastero_carpetas' : 'trastero_items';
    const { error } = await supabaseClient.from(table).delete().eq('id', entity.id);
    if (error) {
        showToast(`No se pudo eliminar: ${error.message}`, true);
        return;
    }
    showToast('Eliminado.');
    await refreshAndRender(type === 'folder' ? entity.parent_id || '' : entity.carpeta_id || '');
}

async function collectPhotos(type, ids) {
    if (!ids.length) return [];
    const { data, error } = await supabaseClient.from('trastero_fotos').select('id,storage_path,thumbnail_path').eq('tipo', type).in('relacion_id', ids);
    return error ? [] : data || [];
}

function photoPaths(photos) {
    return [...new Set(photos.flatMap((photo) => [photo.storage_path, photo.thumbnail_path]).filter(Boolean))];
}

async function collectFolderTreePhotos(folderId) {
    const folderIds = [String(folderId), ...descendantIds(folderId)];
    const itemIds = items.filter((item) => folderIds.includes(String(item.carpeta_id))).map((item) => item.id);
    const [folderPhotos, itemPhotos] = await Promise.all([
        collectPhotos('carpeta', folderIds),
        collectPhotos('item', itemIds)
    ]);
    return [...folderPhotos, ...itemPhotos];
}

async function openPhotos(type, relationId) {
    const photos = await loadPhotos(type, relationId);
    activeGalleryPhotos = photos;
    const modal = openModal('Fotos', `
        <label class="button photo-upload-button" for="modal-photo-input"><img class="action-icon" src="${photoIcon}" alt="">Añadir foto</label>
        <input id="modal-photo-input" class="sr-only" type="file" accept="image/*" data-photo-type="${type}" data-photo-id="${relationId}">
        <div class="photos-list">${photos.length ? photos.map((photo, index) => `
            <article class="photo-tile">
                <button class="photo-thumb-button" type="button" data-action="open-photo-viewer" data-index="${index}" aria-label="Ver foto">
                    <img src="${escapeHtml(photo.thumbUrl || photo.url)}" alt="">
                    ${photo.es_portada ? '<span class="cover-badge">Portada</span>' : ''}
                </button>
                <div class="photo-tile-actions">
                    ${photo.es_portada ? '' : `<button class="photo-icon-action cover-action" type="button" data-action="set-cover" data-id="${photo.id}" data-photo-type="${type}" data-relation-id="${relationId}" aria-label="Poner como portada">✓</button>`}
                    <button class="photo-icon-action delete-action" type="button" data-action="delete-photo" data-id="${photo.id}" data-path="${escapeHtml(photo.storage_path)}" data-thumbnail-path="${escapeHtml(photo.thumbnail_path || '')}" data-thumb-url="${escapeHtml(photo.thumbUrl || photo.url)}" data-photo-type="${type}" data-relation-id="${relationId}" aria-label="Eliminar foto">🗑</button>
                </div>
            </article>`).join('') : '<p class="empty-state">Todavia no hay fotos.</p>'}</div>`);
    modal.querySelector('#modal-photo-input').addEventListener('change', handlePhotoInput);
}

function openPhotoViewer(index = 0) {
    if (!activeGalleryPhotos.length) return;
    activeGalleryIndex = Math.max(0, Math.min(Number(index) || 0, activeGalleryPhotos.length - 1));
    renderPhotoViewer();
}

function renderPhotoViewer() {
    document.querySelector('.photo-viewer-backdrop')?.remove();
    const photo = activeGalleryPhotos[activeGalleryIndex];
    const backdrop = document.createElement('div');
    backdrop.className = 'photo-viewer-backdrop';
    backdrop.innerHTML = `
        <section class="photo-viewer">
            <button class="photo-viewer-close" type="button" data-action="close-photo-viewer" aria-label="Cerrar">×</button>
            <button class="photo-viewer-nav photo-viewer-prev" type="button" data-action="photo-viewer-prev" aria-label="Anterior" ${activeGalleryPhotos.length < 2 ? 'disabled' : ''}>‹</button>
            <img src="${escapeHtml(photo.url || photo.thumbUrl)}" alt="">
            <button class="photo-viewer-nav photo-viewer-next" type="button" data-action="photo-viewer-next" aria-label="Siguiente" ${activeGalleryPhotos.length < 2 ? 'disabled' : ''}>›</button>
            <div class="photo-viewer-count">${activeGalleryIndex + 1} / ${activeGalleryPhotos.length}</div>
        </section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) closePhotoViewer();
    });
}

function closePhotoViewer() {
    document.querySelector('.photo-viewer-backdrop')?.remove();
}

function stepPhotoViewer(direction) {
    if (!activeGalleryPhotos.length) return;
    activeGalleryIndex = (activeGalleryIndex + direction + activeGalleryPhotos.length) % activeGalleryPhotos.length;
    renderPhotoViewer();
}

async function loadPhotos(type, relationId) {
    const { data, error } = await supabaseClient.from('trastero_fotos').select('*').eq('tipo', type).eq('relacion_id', relationId).order('es_portada', { ascending: false }).order('created_at', { ascending: false });
    if (error || !data?.length) return [];
    const paths = [...new Set(data.flatMap((photo) => [photo.storage_path, photo.thumbnail_path || photo.storage_path]).filter(Boolean))];
    const signed = await supabaseClient.storage.from(storageBucket).createSignedUrls(paths, 3600);
    if (signed.error) return data;
    const signedByPath = new Map(paths.map((path, index) => [path, signed.data[index]?.signedUrl || '']));
    return data.map((photo) => ({
        ...photo,
        url: signedByPath.get(photo.storage_path) || '',
        thumbUrl: signedByPath.get(photo.thumbnail_path || photo.storage_path) || ''
    }));
}

async function handlePhotoInput(event) {
    const input = event.target;
    if (!input.files?.[0]) return;
    input.disabled = true;
    try {
        await uploadPhoto(input.dataset.photoType, input.dataset.photoId, input.files[0]);
        closeOverlay();
        await refreshAndRender(null, currentRoute().itemId);
    } catch (error) {
        showToast(`No se pudo subir la foto: ${error.message}`, true);
    } finally {
        input.disabled = false;
    }
}

async function uploadPhoto(type, relationId, file) {
    const optimized = await optimizeImage(file, { maxBytes: 300 * 1024, maxDimension: 1800 });
    const thumbnail = await optimizeImage(file, { maxBytes: 35 * 1024, maxDimension: 420, initialQuality: .78 });
    const folder = type === 'carpeta' ? 'carpetas' : 'items';
    const photoId = crypto.randomUUID();
    const path = `${currentUser.id}/${folder}/${relationId}/${photoId}.jpg`;
    const thumbnailPath = `${currentUser.id}/${folder}/${relationId}/thumbs/${photoId}.jpg`;
    const upload = await supabaseClient.storage.from(storageBucket).upload(path, optimized, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) throw upload.error;
    const thumbUpload = await supabaseClient.storage.from(storageBucket).upload(thumbnailPath, thumbnail, { contentType: 'image/jpeg', upsert: false });
    if (thumbUpload.error) {
        await supabaseClient.storage.from(storageBucket).remove([path]);
        throw thumbUpload.error;
    }
    const { count } = await supabaseClient.from('trastero_fotos').select('id', { count: 'exact', head: true }).eq('tipo', type).eq('relacion_id', relationId);
    const record = await supabaseClient.from('trastero_fotos').insert({ user_id: currentUser.id, tipo: type, relacion_id: relationId, storage_path: path, thumbnail_path: thumbnailPath, es_portada: !count });
    if (record.error) {
        await supabaseClient.storage.from(storageBucket).remove([path, thumbnailPath]);
        throw record.error;
    }
}

async function optimizeImage(file, { maxBytes = 300 * 1024, maxDimension = 1800, initialQuality = .84 } = {}) {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    let blob;
    let quality = initialQuality;
    let canvas;
    let context;
    for (let sizeAttempt = 0; sizeAttempt < 8; sizeAttempt += 1) {
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        quality = initialQuality;
        for (let qualityAttempt = 0; qualityAttempt < 10; qualityAttempt += 1) {
            blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (blob.size <= maxBytes) break;
            quality = Math.max(.28, quality - .07);
        }
        if (blob.size <= maxBytes || Math.max(canvas.width, canvas.height) <= 180) break;
        scale *= .78;
    }
    bitmap.close();
    return blob;
}


async function setCover(photoId, type, relationId) {
    const clear = await supabaseClient.from('trastero_fotos').update({ es_portada: false }).eq('tipo', type).eq('relacion_id', relationId);
    if (clear.error) {
        showToast(`No se pudo actualizar portada: ${clear.error.message}`, true);
        return;
    }
    const result = await supabaseClient.from('trastero_fotos').update({ es_portada: true }).eq('id', photoId);
    if (result.error) showToast(`No se pudo marcar portada: ${result.error.message}`, true);
    else {
        showToast('Portada actualizada.');
        closeOverlay();
        await refreshAndRender(null, currentRoute().itemId);
    }
}

async function deletePhoto(photoId, path, thumbnailPath = '', thumbUrl = '') {
    const preview = thumbUrl ? `<img class="confirm-photo-thumb" src="${escapeHtml(thumbUrl)}" alt="">` : '';
    if (!await confirmAction('Eliminar foto', `${preview}<p>Eliminar esta foto?</p>`, { html: true })) return;
    await supabaseClient.storage.from(storageBucket).remove([...new Set([path, thumbnailPath].filter(Boolean))]);
    const { error } = await supabaseClient.from('trastero_fotos').delete().eq('id', photoId);
    if (error) showToast(`No se pudo eliminar: ${error.message}`, true);
    else {
        closeOverlay();
        await refreshAndRender(null, currentRoute().itemId);
    }
}

async function refreshAndRender(folderId = null, itemId = null) {
    await loadData();
    if (itemId) navigateToItem(itemId);
    else if (folderId !== null) navigateToFolder(folderId);
    else renderCurrent();
}

document.addEventListener('click', async (event) => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.action;
    if (actionElement.dataset.searchResult) searchOpen = false;
    if (action === 'go-folder') navigateToFolder(actionElement.dataset.id || '');
    if (action === 'go-item') navigateToItem(actionElement.dataset.id);
    if (action === 'toggle-search') {
        searchOpen = !searchOpen;
        renderCurrent();
        document.getElementById('global-search')?.focus();
    }
    if (action === 'scan-code') showToast('Escaneo preparado visualmente. La lectura de camara se puede activar en una siguiente fase.');
    if (action === 'open-tree') openFolderTree();
    if (action === 'open-create-sheet') openCreateSheet(actionElement.dataset.parent || '');
    if (action === 'row-menu') {
        event.stopPropagation();
        openRowMenu(actionElement.dataset.type, actionElement.dataset.id);
    }
    if (action === 'folder-menu') {
        const id = actionElement.dataset.id;
        if (id) openRowMenu('folder', id);
        else openSheet('Trastero', [
            { id: 'tree', label: 'Ver arbol de carpetas', handler: () => openFolderTree() },
            { id: 'private', label: 'Zona privada', handler: () => { window.location.href = '../Privado/index.html'; } },
            { id: 'cancel', label: 'Cancelar', className: 'button-muted', handler: () => {} }
        ]);
    }
    if (action === 'move-item') moveItem(itemById(actionElement.dataset.id));
    if (action === 'open-photos') openPhotos(actionElement.dataset.type, actionElement.dataset.id);
    if (action === 'open-photo-viewer') openPhotoViewer(actionElement.dataset.index);
    if (action === 'close-photo-viewer') closePhotoViewer();
    if (action === 'photo-viewer-prev') stepPhotoViewer(-1);
    if (action === 'photo-viewer-next') stepPhotoViewer(1);
    if (action === 'set-cover') setCover(actionElement.dataset.id, actionElement.dataset.photoType, actionElement.dataset.relationId);
    if (action === 'delete-photo') deletePhoto(actionElement.dataset.id, actionElement.dataset.path, actionElement.dataset.thumbnailPath, actionElement.dataset.thumbUrl);
});

document.addEventListener('input', (event) => {
    if (event.target.id === 'global-search') renderSearchResults(event.target.value);
});

document.addEventListener('change', (event) => {
    if (event.target.id === 'photo-input') handlePhotoInput(event);
});

window.addEventListener('popstate', renderCurrent);

async function init() {
    if (!await requireAccess()) return;
    try {
        await loadData();
        renderCurrent();
    } catch (error) {
        showToast(`No se pudo iniciar Trastero: ${error.message}`, true);
    }
}

init();
