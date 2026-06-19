const supabaseClient = window.websSupabase;
const folderIcon = 'assets/folder-box.png';
const itemIcon = 'assets/item-box.png';

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
            <section class="detail-grid">
                <div class="detail-row"><span>Tipo</span><strong>${typeLabel}</strong></div>
                ${detail}
                <div class="detail-row"><span>Notas</span><strong>${escapeHtml(record.notas || 'Sin notas')}</strong></div>
            </section>
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
    renderPublic(data);
}

init();
