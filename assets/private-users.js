const usersClient = window.websSupabase;

const PROFILE_ROLES = ['admin', 'member', 'viewer', 'trastero'];
const PROJECT_ROLES = ['', 'owner', 'editor', 'viewer'];

const adminEmail = document.getElementById('users-admin-email');
const searchInput = document.getElementById('users-search');
const listContainer = document.getElementById('users-admin-list');
const messageBox = document.getElementById('users-admin-message');

let currentUserId = null;
let profiles = [];
let projects = [];
let memberships = [];

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
    return values.map((value) => {
        const label = value || 'Sin acceso';
        return `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;
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
        const card = document.createElement('article');
        card.className = 'private-user-admin-card';
        const title = profile.display_name || profile.username || profile.email || 'Usuario';
        const email = profile.email || 'Sin email';
        const username = profile.username ? `@${profile.username}` : 'Sin alias';
        const canDelete = profile.id !== currentUserId;

        card.innerHTML = `
            <div class="private-user-admin-head">
                <div>
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(email)}</p>
                    <small>${escapeHtml(username)}</small>
                </div>
                <button type="button" class="btn-danger private-user-delete"${canDelete ? '' : ' disabled'}>Borrar</button>
            </div>
            <label>Rol general</label>
            <select class="private-profile-role">
                ${optionList(PROFILE_ROLES, profile.role)}
            </select>
            <div class="private-project-role-grid"></div>
        `;

        card.querySelector('.private-profile-role').addEventListener('change', (event) => {
            updateProfileRole(profile.id, event.target.value);
        });

        const deleteButton = card.querySelector('.private-user-delete');
        deleteButton.addEventListener('click', () => deleteUser(profile.id, title));

        const projectGrid = card.querySelector('.private-project-role-grid');
        projects.forEach((project) => {
            const wrapper = document.createElement('label');
            const membership = membershipFor(profile.id, project.id);
            wrapper.textContent = project.name || project.slug;
            const select = document.createElement('select');
            select.innerHTML = optionList(PROJECT_ROLES, membership?.role || '');
            select.addEventListener('change', (event) => {
                updateProjectRole(profile.id, project, event.target.value);
            });
            wrapper.appendChild(select);
            projectGrid.appendChild(wrapper);
        });

        listContainer.appendChild(card);
    });
}

async function loadAdminData() {
    clearUsersMessage();
    listContainer.innerHTML = '<p>Cargando usuarios...</p>';

    const [profilesResult, projectsResult, membershipsResult] = await Promise.all([
        usersClient.from('profiles').select('id, email, display_name, username, role, created_at').order('created_at', { ascending: false }),
        usersClient.from('app_projects').select('id, slug, name').order('name', { ascending: true }),
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

async function updateProjectRole(userId, project, role) {
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
        return;
    }

    if (result.error) {
        await loadAdminData();
        showUsersMessage('No se pudo cambiar el rol del proyecto.', 'error');
        return;
    }

    await loadAdminData();
    showUsersMessage('Rol de proyecto actualizado.');
}

async function deleteUser(userId, label) {
    if (userId === currentUserId) return;
    if (!window.confirm(`¿Quieres borrar el usuario ${label}? Esta accion no se puede deshacer.`)) return;

    const { data, error } = await usersClient.rpc('admin_delete_registered_user', { p_user_id: userId });
    if (error || !data?.ok) {
        showUsersMessage(data?.message || 'No se pudo borrar el usuario. Ejecuta la migracion de gestion de usuarios si aun no esta aplicada.', 'error');
        return;
    }

    await loadAdminData();
    showUsersMessage('Usuario borrado.');
}

searchInput.addEventListener('input', renderUsers);

requireAdminSession().then((isAdmin) => {
    if (isAdmin) loadAdminData();
});
