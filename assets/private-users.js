const usersClient = window.websSupabase;

const PROFILE_ROLES = ['admin', 'member', 'viewer'];
const PROJECT_ROLES = ['', 'owner', 'editor', 'viewer'];

const adminEmail = document.getElementById('users-admin-email');
const searchInput = document.getElementById('users-search');
const listContainer = document.getElementById('users-admin-list');
const messageBox = document.getElementById('users-admin-message');
const editModal = document.getElementById('user-edit-modal');
const editTitle = document.getElementById('user-edit-title');
const editFields = document.getElementById('user-edit-fields');
const editSave = document.getElementById('user-edit-save');
const editCancel = document.getElementById('user-edit-cancel');
const createOpen = document.getElementById('user-create-open');
const createModal = document.getElementById('user-create-modal');
const createForm = document.getElementById('user-create-form');
const createSubmit = document.getElementById('user-create-submit');
const createCancel = document.getElementById('user-create-cancel');
const deleteModal = document.getElementById('user-delete-modal');
const deleteTitle = document.getElementById('user-delete-title');
const deleteConfirm = document.getElementById('user-delete-confirm');
const deleteCancel = document.getElementById('user-delete-cancel');

let currentUserId = null;
let profiles = [];
let projects = [];
let memberships = [];
let editingUserId = null;
let deletingUserId = null;

function showUsersMessage(text, type = 'info') {
    messageBox.textContent = text;
    messageBox.dataset.type = type;
    messageBox.hidden = false;
}

function clearUsersMessage() {
    messageBox.hidden = true;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function approvalInfo(profile) {
    const status = profile.approval_status || 'temporal';
    const expired = status === 'temporal' && profile.trial_expires_at && Date.now() >= Date.parse(profile.trial_expires_at);
    const labels = {
        temporal: 'Temporal',
        validado: 'Validado',
        bloqueado: 'Bloqueado'
    };

    return {
        status,
        expired,
        label: expired ? 'Temporal · Caducado' : (labels[status] || 'Temporal'),
        expires: status === 'temporal' ? formatDateTime(profile.trial_expires_at) : '-'
    };
}
async function requireAdminSession() {
    const { data } = await usersClient.auth.getSession();
    const user = data.session?.user;
    if (!user) {
        window.location.replace('index.html');
        return false;
    }

    const { data: profile, error } = await usersClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error || profile?.role !== 'admin') {
        await usersClient.auth.signOut();
        window.location.replace('index.html');
        return false;
    }

    currentUserId = user.id;
    adminEmail.textContent = user.email;
    return true;
}

function membershipFor(userId, projectId) {
    return memberships.find((membership) => membership.user_id === userId && membership.project_id === projectId);
}

function optionList(values, selected) {
    const options = values.includes(selected) || !selected ? values : [...values, selected];
    return options.map((value) => {
        const label = value || 'Sin acceso';
        return `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;
    }).join('');
}

function projectOptionList(selected = '') {
    return projects.filter((project) => project.is_active !== false).map((project) => {
        const label = project.name || project.slug;
        return `<option value="${project.id}"${project.id === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
}

function filteredProfiles() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return profiles;

    return profiles.filter((profile) => [
        profile.display_name,
        profile.username,
        profile.email
    ].some((value) => (value || '').toLowerCase().includes(query)));
}

function renderUsers() {
    const data = filteredProfiles();
    if (!data.length) {
        listContainer.innerHTML = '<p>No hay usuarios que coincidan con la busqueda.</p>';
        return;
    }

    listContainer.innerHTML = '';
    data.forEach((profile) => {
        const row = document.createElement('article');
        row.className = 'private-user-row';
        const title = profile.display_name || profile.username || profile.email || 'Usuario';
        const email = profile.email || 'Sin email';
        const username = profile.username ? `@${profile.username}` : 'Sin alias';
        const canDelete = profile.id !== currentUserId;

        const approval = approvalInfo(profile);
        row.classList.toggle('is-expired', approval.expired);
        row.innerHTML = `
            <div class="private-user-row-main">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(email)}</span>
                <small>${escapeHtml(username)} · ${escapeHtml(profile.role)}</small>
                <div class="private-user-status-line">
                    <span class="private-status-badge private-status-${escapeHtml(approval.status)}${approval.expired ? ' is-expired' : ''}">${escapeHtml(approval.label)}</span>
                    <span class="private-user-expiry">Caduca: ${escapeHtml(approval.expires)}</span>
                </div>
            </div>
            <div class="private-user-row-actions">
                <button type="button" class="private-user-action private-user-validate"${profile.approval_status === 'validado' ? ' disabled' : ''}>Validar</button>
                <button type="button" class="private-user-action private-user-block"${!canDelete || profile.approval_status === 'bloqueado' ? ' disabled' : ''}>Bloquear</button>
                <button type="button" class="private-icon-button private-user-edit" aria-label="Editar usuario" title="Editar usuario">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                    </svg>
                </button>
                <button type="button" class="private-icon-button private-user-delete" aria-label="Borrar usuario" title="Borrar usuario"${canDelete ? '' : ' disabled'}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 6h18"></path>
                        <path d="M8 6V4h8v2"></path>
                        <path d="M6 6l1 15h10l1-15"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                    </svg>
                </button>
            </div>
        `;

        row.querySelector('.private-user-validate').addEventListener('click', () => setApprovalStatus(profile.id, 'validado'));
        row.querySelector('.private-user-block').addEventListener('click', () => setApprovalStatus(profile.id, 'bloqueado'));
        row.querySelector('.private-user-edit').addEventListener('click', () => openEditModal(profile.id));
        row.querySelector('.private-user-delete').addEventListener('click', () => openDeleteModal(profile.id));

        listContainer.appendChild(row);
    });
}

async function loadAdminData() {
    clearUsersMessage();
    listContainer.innerHTML = '<p>Cargando usuarios...</p>';

    const [profilesResult, projectsResult, membershipsResult] = await Promise.all([
        usersClient.from('profiles').select('id, email, display_name, username, role, approval_status, trial_expires_at, validated_at, validated_by, created_at').order('created_at', { ascending: false }),
        usersClient.from('app_projects').select('id, slug, name, is_active').order('name', { ascending: true }),
        usersClient.from('project_members').select('project_id, user_id, role')
    ]);

    if (profilesResult.error || projectsResult.error || membershipsResult.error) {
        showUsersMessage('No se pudieron cargar los usuarios o permisos.', 'error');
        return;
    }

    profiles = profilesResult.data || [];
    projects = projectsResult.data || [];
    memberships = membershipsResult.data || [];
    renderUsers();
}

async function setApprovalStatus(userId, status) {
    clearUsersMessage();
    const payload = status === 'validado'
        ? { approval_status: 'validado', validated_at: new Date().toISOString(), validated_by: currentUserId }
        : { approval_status: 'bloqueado' };

    const { error } = await usersClient
        .from('profiles')
        .update(payload)
        .eq('id', userId);

    if (error) {
        showUsersMessage('No se pudo actualizar el estado del usuario.', 'error');
        return;
    }

    await loadAdminData();
    showUsersMessage(status === 'validado' ? 'Usuario validado.' : 'Usuario bloqueado.');
}
async function updateProfileRole(userId, role) {
    const { error } = await usersClient.from('profiles').update({ role }).eq('id', userId);
    if (error) {
        await loadAdminData();
        showUsersMessage('No se pudo cambiar el rol general.', 'error');
        return;
    }

    const profile = profiles.find((item) => item.id === userId);
    if (profile) profile.role = role;
    showUsersMessage('Rol general actualizado.');
}

async function updateProjectRole(userId, project, role, reload = true) {
    const existing = membershipFor(userId, project.id);
    let result;

    if (!role && existing) {
        result = await usersClient
            .from('project_members')
            .delete()
            .eq('project_id', project.id)
            .eq('user_id', userId);
    } else if (role && existing) {
        result = await usersClient
            .from('project_members')
            .update({ role })
            .eq('project_id', project.id)
            .eq('user_id', userId);
    } else if (role) {
        result = await usersClient
            .from('project_members')
            .insert({ project_id: project.id, user_id: userId, role });
    } else {
        return true;
    }

    if (result.error) {
        if (reload) await loadAdminData();
        showUsersMessage('No se pudo cambiar el rol del proyecto.', 'error');
        return false;
    }

    if (reload) {
        await loadAdminData();
        showUsersMessage('Rol de proyecto actualizado.');
    }
    return true;
}

function profileLabel(profile) {
    return profile.display_name || profile.username || profile.email || 'Usuario';
}

function openEditModal(userId) {
    const profile = profiles.find((item) => item.id === userId);
    if (!profile) return;
    editingUserId = userId;
    editTitle.textContent = `${profileLabel(profile)} · ${profile.email || 'Sin email'}`;
    editFields.innerHTML = '';

    const profileWrapper = document.createElement('label');
    profileWrapper.textContent = 'Rol general';
    const profileSelect = document.createElement('select');
    profileSelect.id = 'edit-profile-role';
    profileSelect.innerHTML = optionList(PROFILE_ROLES, profile.role);
    profileWrapper.appendChild(profileSelect);
    editFields.appendChild(profileWrapper);

    const projectGrid = document.createElement('div');
    projectGrid.className = 'private-project-role-grid';
    projects.forEach((project) => {
        const wrapper = document.createElement('label');
        const membership = membershipFor(userId, project.id);
        wrapper.textContent = project.name || project.slug;
        const select = document.createElement('select');
        select.dataset.projectId = project.id;
        select.innerHTML = optionList(PROJECT_ROLES, membership?.role || '');
        wrapper.appendChild(select);
        projectGrid.appendChild(wrapper);
    });
    editFields.appendChild(projectGrid);
    editModal.hidden = false;
}

function closeEditModal() {
    editingUserId = null;
    editModal.hidden = true;
}

function openCreateModal() {
    clearUsersMessage();
    const activeProjects = projects.filter((project) => project.is_active !== false);
    if (!activeProjects.length) {
        showUsersMessage('No hay proyectos activos para asignar al nuevo usuario.', 'error');
        return;
    }

    createForm.reset();
    createForm.elements.profile_role.innerHTML = optionList(PROFILE_ROLES, 'viewer');
    createForm.elements.project_id.innerHTML = projectOptionList(activeProjects[0]?.id || '');
    createForm.elements.project_role.innerHTML = optionList(PROJECT_ROLES.filter(Boolean), 'viewer');
    createModal.hidden = false;
    createForm.elements.username.focus();
}

function closeCreateModal() {
    createModal.hidden = true;
}

async function createUser(event) {
    event.preventDefault();
    clearUsersMessage();

    const formData = new FormData(createForm);
    const payload = {
        username: String(formData.get('username') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || ''),
        profile_role: String(formData.get('profile_role') || 'viewer'),
        project_id: String(formData.get('project_id') || ''),
        project_role: String(formData.get('project_role') || '')
    };

    if (!payload.username || !payload.email || !payload.password || !payload.project_id || !payload.project_role) {
        showUsersMessage('Completa todos los datos del nuevo usuario.', 'error');
        return;
    }

    createSubmit.disabled = true;
    createSubmit.textContent = 'Creando...';

    const { data, error } = await usersClient.functions.invoke('admin-create-user', {
        body: payload
    });

    createSubmit.disabled = false;
    createSubmit.textContent = 'Crear usuario';

    if (error || !data?.ok) {
        showUsersMessage(data?.message || 'No se pudo crear el usuario. Comprueba que la Edge Function este desplegada.', 'error');
        return;
    }

    closeCreateModal();
    await loadAdminData();
    showUsersMessage('Usuario creado correctamente.');
}

async function saveEditedRoles() {
    if (!editingUserId) return;
    editSave.disabled = true;
    clearUsersMessage();

    const profileRole = document.getElementById('edit-profile-role').value;
    const profileResult = await usersClient.from('profiles').update({ role: profileRole }).eq('id', editingUserId);
    if (profileResult.error) {
        editSave.disabled = false;
        showUsersMessage('No se pudo cambiar el rol general.', 'error');
        return;
    }

    const projectSelects = Array.from(editFields.querySelectorAll('[data-project-id]'));
    for (const select of projectSelects) {
        const project = projects.find((item) => item.id === select.dataset.projectId);
        const updated = await updateProjectRole(editingUserId, project, select.value, false);
        if (!updated) {
            editSave.disabled = false;
            return;
        }
    }

    closeEditModal();
    editSave.disabled = false;
    await loadAdminData();
    showUsersMessage('Roles actualizados.');
}

function openDeleteModal(userId) {
    if (userId === currentUserId) return;
    const profile = profiles.find((item) => item.id === userId);
    if (!profile) return;
    deletingUserId = userId;
    deleteTitle.textContent = `¿Quieres borrar el usuario ${profileLabel(profile)}? Esta accion no se puede deshacer.`;
    deleteModal.hidden = false;
}

function closeDeleteModal() {
    deletingUserId = null;
    deleteModal.hidden = true;
}

async function deleteUser() {
    if (!deletingUserId || deletingUserId === currentUserId) return;
    deleteConfirm.disabled = true;

    const { data, error } = await usersClient.rpc('admin_delete_registered_user', { p_user_id: deletingUserId });
    if (error || !data?.ok) {
        deleteConfirm.disabled = false;
        showUsersMessage(data?.message || 'No se pudo borrar el usuario. Ejecuta la migracion de gestion de usuarios si aun no esta aplicada.', 'error');
        return;
    }

    closeDeleteModal();
    deleteConfirm.disabled = false;
    await loadAdminData();
    showUsersMessage('Usuario borrado.');
}

searchInput.addEventListener('input', renderUsers);
editSave.addEventListener('click', saveEditedRoles);
editCancel.addEventListener('click', closeEditModal);
createOpen.addEventListener('click', openCreateModal);
createForm.addEventListener('submit', createUser);
createCancel.addEventListener('click', closeCreateModal);
deleteConfirm.addEventListener('click', deleteUser);
deleteCancel.addEventListener('click', closeDeleteModal);

requireAdminSession().then((isAdmin) => {
    if (isAdmin) loadAdminData();
});
