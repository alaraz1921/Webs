const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

// The dialog owns its DOM so background updates of the detail page do not close it.
export function openListPicker({title, getLists, isMember, getItems, toggleList, createList, onClose}) {
  if (document.querySelector('.list-picker')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'list-picker';
  dialog.setAttribute('aria-labelledby', 'list-picker-title');
  dialog.innerHTML = `
    <header class="list-picker-header">
      <h2 id="list-picker-title">Agregar <strong>${escapeHtml(title)}</strong> a las listas</h2>
      <div class="picker-header-actions"><button class="picker-search-toggle" type="button" aria-label="Buscar una lista" aria-expanded="false" aria-controls="picker-search-field"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button><button class="picker-close" type="button" aria-label="Cerrar listas" autofocus>×</button></div>
    </header>
    <label class="picker-search" id="picker-search-field" hidden><span class="sr-only">Buscar una lista</span><input class="input" type="search" placeholder="Buscar una lista…" autocomplete="off"></label>
    <div class="picker-grid" aria-label="Listas personales"></div>
    <p class="picker-feedback" role="status" aria-live="polite"></p>
    <form class="picker-create">
      <label for="picker-list-name">Crea una nueva lista</label>
      <div class="row"><input class="input" id="picker-list-name" name="name" placeholder="Mi nueva lista…" required maxlength="80"><button class="btn" type="submit">Crear</button></div>
    </form>`;
  const grid = dialog.querySelector('.picker-grid');
  const search = dialog.querySelector('input[type="search"]');
  const feedback = dialog.querySelector('.picker-feedback');
  const searchToggle = dialog.querySelector('.picker-search-toggle');
  let busy = false;

  function draw() {
    const lists = getLists();
    const query = search.value.trim().toLocaleLowerCase('es');
    const visible = lists.filter(list => list.name.toLocaleLowerCase('es').includes(query));
    grid.innerHTML = visible.map(list => {
      const selected = isMember(list.id);
      const items = getItems(list.id);
      const cover = items.find(item => item.poster_path)?.poster_path;
      return `<button type="button" class="picker-card ${selected ? 'is-selected' : ''}" data-picker-list="${escapeHtml(list.id)}" aria-pressed="${selected}" aria-label="${selected ? 'Quitar de' : 'Añadir a'} ${escapeHtml(list.name)}" ${busy ? 'disabled' : ''}>
        <span class="picker-cover">${cover ? `<img src="https://image.tmdb.org/t/p/w342${escapeHtml(cover)}" alt="" loading="lazy">` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4"/><circle cx="15" cy="9" r="1"/></svg>'}
          <span class="picker-overlay"><span class="picker-symbol">${selected ? '✓' : '+'}</span></span>
        </span>
        <strong>${escapeHtml(list.name)}</strong>
        <small>${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}</small>
        <small class="picker-membership">${selected ? 'Añadido · Pulsa para quitar' : 'Pulsa para añadir'}</small>
      </button>`;
    }).join('') || `<p class="picker-empty">${lists.length ? 'No hay listas que coincidan con tu búsqueda.' : 'Todavía no tienes listas. Crea la primera aquí abajo.'}</p>`;
    dialog.querySelector('.picker-create button').disabled = busy;
  }

  async function run(action, success, focusId) {
    if (busy) return;
    busy = true;
    feedback.textContent = 'Guardando…';
    draw();
    try {
      await action();
      feedback.textContent = success;
    } catch (error) {
      feedback.textContent = error.message || 'No se pudo guardar el cambio. Inténtalo de nuevo.';
    } finally {
      busy = false;
      draw();
      if (dialog.open && focusId) [...grid.querySelectorAll('[data-picker-list]')].find(b => b.dataset.pickerList === focusId)?.focus();
    }
  }

  searchToggle.addEventListener('click', () => {
    const field = dialog.querySelector('.picker-search');
    field.hidden = !field.hidden;
    searchToggle.setAttribute('aria-expanded', String(!field.hidden));
    if (!field.hidden) search.focus();
    else { search.value = ''; draw(); searchToggle.focus(); }
  });
  search.addEventListener('input', draw);
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-picker-list]');
    if (!button || busy) return;
    const id = button.dataset.pickerList;
    const selected = isMember(id);
    run(() => toggleList(id, selected), selected ? 'Título quitado de la lista.' : 'Título añadido a la lista.', id);
  });
  dialog.querySelector('.picker-create').addEventListener('submit', event => {
    event.preventDefault();
    const input = dialog.querySelector('[name="name"]');
    const name = input.value.trim();
    if (!name || busy) return;
    run(async () => { await createList(name); input.value = ''; search.value = ''; }, 'Lista creada. Pulsa su tarjeta para añadir el título.');
  });
  dialog.querySelector('.picker-close').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog || busy) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { dialog.remove(); onClose(); }, {once:true});
  document.body.append(dialog);
  draw();
  dialog.showModal();
  dialog.querySelector('.picker-close').focus();
}
