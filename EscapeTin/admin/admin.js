const adminPage = document.body.dataset.adminPage;
const adminClient = window.websSupabase;
const adminStatus = document.getElementById("admin-status");

function setAdminStatus(message, isError = false) {
    if (!adminStatus) return;
    adminStatus.textContent = message || "";
    adminStatus.classList.toggle("error", Boolean(isError));
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
}

function makeCode() {
    return `ET${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function toDatetimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value) {
    return value ? new Date(value).toISOString() : null;
}

async function resolveLoginEmail(identifier) {
    const value = String(identifier || "").trim().toLowerCase();
    if (!value || value.includes("@")) return value;
    const { data, error } = await adminClient.rpc("resolve_games_login_email", { p_identifier: value });
    return error ? "" : data;
}

async function canManageEscapeTin() {
    const { data, error } = await adminClient.rpc("can_manage_escapetin");
    return !error && data === true;
}

function ensureModal() {
    let modal = document.getElementById("app-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "app-modal";
    modal.className = "permission-modal";
    modal.hidden = true;
    modal.innerHTML = `
        <div class="permission-modal-box" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
            <h2 id="app-modal-title"></h2>
            <p id="app-modal-message"></p>
            <div class="modal-actions"></div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

function showAdminModal(message, title = "EscapeTin", options = {}) {
    return new Promise((resolve) => {
        const modal = ensureModal();
        modal.querySelector("#app-modal-title").textContent = title;
        modal.querySelector("#app-modal-message").textContent = message;
        const actions = modal.querySelector(".modal-actions");
        actions.innerHTML = "";
        const ok = document.createElement("button");
        ok.type = "button";
        ok.className = "btn btn-primary";
        ok.textContent = options.okText || "Aceptar";
        ok.addEventListener("click", () => { modal.hidden = true; resolve(true); }, { once: true });
        actions.appendChild(ok);
        if (options.cancelText) {
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "btn btn-secondary";
            cancel.textContent = options.cancelText;
            cancel.addEventListener("click", () => { modal.hidden = true; resolve(false); }, { once: true });
            actions.appendChild(cancel);
        }
        modal.hidden = false;
        ok.focus();
    });
}

function showPermissionModal() {
    const modal = document.getElementById("permission-modal");
    if (!modal) return;
    modal.hidden = false;
    modal.querySelector("button")?.focus();
}

function qrImageUrl(text, size = 220) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

function renderQrBlock(label, url) {
    const image = qrImageUrl(url);
    return `
        <details class="qr-box">
            <summary>${escapeHtml(label)}</summary>
            <img src="${image}" alt="QR ${escapeHtml(label)}">
            <div class="admin-actions">
                <a class="btn btn-secondary" href="${image}" download="escapetin-qr.png">Descargar PNG</a>
                <button class="btn btn-secondary" type="button" data-copy="${escapeHtml(url)}">Copiar enlace</button>
            </div>
        </details>`;
}

function renderPreview(containerId, url) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = url ? `<img class="app-cover" src="${escapeHtml(url)}" alt="">` : "";
}

async function getSessionOrRedirect() {
    const { data } = await adminClient.auth.getSession();
    if (!data.session) {
        window.location.href = "login.html";
        return null;
    }
    if (!await canManageEscapeTin()) {
        await adminClient.auth.signOut();
        window.location.href = "login.html?permission=denied";
        return null;
    }
    return data.session;
}

async function setupLogout() {
    const link = document.getElementById("logout-link");
    if (!link) return;
    link.addEventListener("click", async (event) => {
        event.preventDefault();
        await adminClient.auth.signOut();
        window.location.href = "login.html";
    });
}

async function bootLogin() {
    const { data } = await adminClient.auth.getSession();
    document.getElementById("permission-modal-close")?.addEventListener("click", () => {
        document.getElementById("permission-modal").hidden = true;
    });
    if (new URLSearchParams(window.location.search).get("permission") === "denied") showPermissionModal();
    if (data.session) {
        if (await canManageEscapeTin()) { window.location.href = "index.html"; return; }
        await adminClient.auth.signOut();
        showPermissionModal();
    }
    document.getElementById("login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        setAdminStatus("");
        const formData = new FormData(event.target);
        const email = await resolveLoginEmail(formData.get("identifier"));
        const { error } = await adminClient.auth.signInWithPassword({ email, password: String(formData.get("password") || "") });
        if (error) { setAdminStatus("No se pudo iniciar sesion.", true); return; }
        if (!await canManageEscapeTin()) { await adminClient.auth.signOut(); showPermissionModal(); return; }
        window.location.href = "index.html";
    });
}

async function bootGames() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;
    const list = document.getElementById("games-list");
    const { data, error } = await adminClient.from("escapetin_games").select("*, escapetin_challenges(count)").order("created_at", { ascending: false });
    if (error) { setAdminStatus(error.message, true); return; }
    list.innerHTML = data.length ? data.map((game) => {
        const playUrl = new URL("../play/index.html", window.location.href);
        playUrl.searchParams.set("code", game.access_code);
        const challengeCount = game.escapetin_challenges?.[0]?.count || 0;
        return `
            <article class="admin-card">
                <span class="status-pill">${escapeHtml(game.status)}</span>
                <h2>${escapeHtml(game.title)}</h2>
                <p>${escapeHtml(game.description || "Sin descripcion")}</p>
                <strong>Codigo: ${escapeHtml(game.access_code)}</strong>
                <span>${challengeCount} pruebas</span>
                <div class="admin-actions">
                    <a class="btn btn-secondary" href="game-edit.html?id=${game.id}">Editar</a>
                    <a class="btn btn-secondary" href="challenges.html?game=${game.id}">Pruebas</a>
                    <a class="btn btn-secondary" href="participants.html?game=${game.id}">Participantes</a>
                    <button class="btn btn-secondary" type="button" data-duplicate="${game.id}">Duplicar</button>
                    <button class="btn btn-primary" type="button" data-copy="${playUrl.href}">Copiar enlace</button>
                </div>
                ${renderQrBlock("QR de acceso", playUrl.href)}
            </article>`;
    }).join("") : `<p>Aun no hay gincanas. Crea la primera mision.</p>`;
    list.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(button.dataset.copy);
        await showAdminModal("Enlace copiado.", "Listo");
    }));
    list.querySelectorAll("[data-duplicate]").forEach((button) => button.addEventListener("click", async () => {
        if (!await showAdminModal("Duplicar esta gincana completa como borrador?", "Duplicar", { okText: "Duplicar", cancelText: "Cancelar" })) return;
        const { data, error } = await adminClient.rpc("escapetin_duplicate_game", { p_game_id: button.dataset.duplicate });
        if (error || data?.error) { await showAdminModal(error?.message || data.error, "No se pudo duplicar"); return; }
        window.location.href = `game-edit.html?id=${data.game_id}`;
    }));
}

async function bootGameEdit() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;
    const id = getParam("id");
    const form = document.getElementById("game-form");
    const title = document.getElementById("editor-title");
    const codeInput = document.getElementById("access_code");
    EscapeTinMedia?.configureImageInput(document.getElementById("cover_image_file"));
    if (!id) codeInput.value = makeCode();
    document.getElementById("generate-code").addEventListener("click", () => { codeInput.value = makeCode(); });
    if (id) {
        title.textContent = "Editar gincana";
        const { data, error } = await adminClient.from("escapetin_games").select("*").eq("id", id).single();
        if (error) { setAdminStatus(error.message, true); return; }
        ["title", "description", "cover_image_url", "access_code", "status", "mode"].forEach((field) => { form.elements[field].value = data[field] || ""; });
        form.elements.show_ranking.checked = data.show_ranking;
        form.elements.allow_teams.checked = data.allow_teams;
        form.elements.is_template.checked = data.is_template;
        form.elements.starts_at.value = toDatetimeLocal(data.starts_at);
        form.elements.ends_at.value = toDatetimeLocal(data.ends_at);
        form.elements.time_limit_minutes.value = data.time_limit_minutes || "";
        renderPreview("cover-preview", data.cover_image_url);
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector("button[type='submit']");
        submit.disabled = true;
        try {
            const formData = new FormData(form);
            let coverUrl = String(formData.get("cover_image_url") || "").trim();
            const file = formData.get("cover_image_file");
            if (file instanceof File && file.size) coverUrl = await EscapeTinMedia.uploadImage(adminClient, file, "admin/games");
            const payload = {
                title: String(formData.get("title") || "").trim(),
                description: String(formData.get("description") || "").trim(),
                cover_image_url: coverUrl,
                access_code: String(formData.get("access_code") || "").trim().toUpperCase(),
                status: String(formData.get("status") || "draft"),
                show_ranking: form.elements.show_ranking.checked,
                allow_teams: form.elements.allow_teams.checked,
                mode: String(formData.get("mode") || "linear"),
                starts_at: fromDatetimeLocal(String(formData.get("starts_at") || "")),
                ends_at: fromDatetimeLocal(String(formData.get("ends_at") || "")),
                time_limit_minutes: formData.get("time_limit_minutes") ? Number(formData.get("time_limit_minutes")) : null,
                is_template: form.elements.is_template.checked,
                created_by: session.user.id
            };
            const query = id ? adminClient.from("escapetin_games").update(payload).eq("id", id) : adminClient.from("escapetin_games").insert(payload).select("id").single();
            const { data, error } = await query;
            if (error) throw error;
            await showAdminModal("Gincana guardada correctamente.", "Guardado");
            if (!id && data?.id) window.location.href = `challenges.html?game=${data.id}`;
        } catch (error) {
            await showAdminModal(error.message, "No se pudo guardar");
        } finally { submit.disabled = false; }
    });
}

function challengeTypeLabel(type) {
    return ({ question: "Pregunta", multiple_choice: "Pregunta con opciones", qr: "QR", manual: "Manual", photo: "Foto", keyword: "Pregunta" })[type] || type;
}

async function bootChallenges() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;
    const gameId = getParam("game");
    const list = document.getElementById("challenge-list");
    document.getElementById("new-challenge-link").href = `challenge-edit.html?game=${gameId}`;
    async function load() {
        const { data: game, error: gameError } = await adminClient.from("escapetin_games").select("*").eq("id", gameId).single();
        if (gameError) throw gameError;
        document.getElementById("challenge-game-title").textContent = game.title;
        const { data, error } = await adminClient.from("escapetin_challenges").select("*").eq("game_id", gameId).order("order_index");
        if (error) throw error;
        list.innerHTML = data.length ? data.map((challenge) => {
            const checkpoint = challenge.qr_token || "";
            const qrUrl = new URL("../play/challenge.html", window.location.href);
            qrUrl.searchParams.set("code", game.access_code);
            if (checkpoint) qrUrl.searchParams.set("checkpoint", checkpoint);
            return `
                <article class="admin-card">
                    <span class="status-pill">${escapeHtml(challengeTypeLabel(challenge.challenge_type))} · ${challenge.points} pts</span>
                    <h2>${escapeHtml(challenge.order_index)}. ${escapeHtml(challenge.title)}</h2>
                    <p>${escapeHtml(challenge.description || "")}</p>
                    <div class="admin-actions">
                        <a class="btn btn-secondary" href="challenge-edit.html?game=${gameId}&id=${challenge.id}">Editar</a>
                        <button class="btn btn-secondary" type="button" data-copy="${qrUrl.href}">Copiar QR/link</button>
                        <button class="btn btn-primary" type="button" data-delete="${challenge.id}">Eliminar</button>
                    </div>
                    ${renderQrBlock("QR de prueba", qrUrl.href)}
                </article>`;
        }).join("") : `<p>No hay pruebas todavia.</p>`;
        list.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(button.dataset.copy);
            await showAdminModal("Enlace copiado.", "Listo");
        }));
        list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
            if (!await showAdminModal("Eliminar esta prueba?", "Eliminar", { okText: "Eliminar", cancelText: "Cancelar" })) return;
            const { error } = await adminClient.from("escapetin_challenges").delete().eq("id", button.dataset.delete);
            if (error) await showAdminModal(error.message, "No se pudo eliminar");
            await load();
        }));
    }
    try { await load(); } catch (error) { setAdminStatus(error.message, true); }
}

async function bootChallengeEdit() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;
    const gameId = getParam("game");
    const id = getParam("id");
    const form = document.getElementById("challenge-form");
    const typeSelect = document.getElementById("challenge_type");
    document.getElementById("game_id").value = gameId;
    document.getElementById("challenge-list-link").href = `challenges.html?game=${gameId}`;
    document.getElementById("cancel-challenge-link").href = `challenges.html?game=${gameId}`;
    EscapeTinMedia?.configureImageInput(document.getElementById("image_file"));

    function updateFields() {
        const type = typeSelect.value;
        document.querySelectorAll("[data-field]").forEach((el) => {
            const tags = String(el.dataset.field || "").split(/\s+/);
            const show = tags.includes(type) || (type === "multiple_choice" && tags.includes("options")) || (["qr", "manual", "photo"].includes(type) && tags.includes(type));
            el.classList.toggle("app-hidden", !show);
        });
    }
    typeSelect.addEventListener("change", updateFields);

    if (id) {
        document.getElementById("challenge-editor-title").textContent = "Editar prueba";
        const { data, error } = await adminClient.from("escapetin_challenges").select("*").eq("id", id).single();
        if (error) { setAdminStatus(error.message, true); return; }
        Object.entries(data).forEach(([key, value]) => {
            if (form.elements[key] && form.elements[key].type !== "checkbox" && form.elements[key].type !== "file") form.elements[key].value = value ?? "";
        });
        form.elements.is_active.checked = data.is_active;
        form.elements.requires_admin_validation.checked = data.requires_admin_validation;
        renderPreview("image-preview", data.image_url);
    }
    updateFields();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector("button[type='submit']");
        submit.disabled = true;
        try {
            const formData = new FormData(form);
            let imageUrl = String(formData.get("image_url") || "").trim();
            const file = formData.get("image_file");
            if (file instanceof File && file.size) imageUrl = await EscapeTinMedia.uploadImage(adminClient, file, `admin/challenges/${gameId}`);
            const type = String(formData.get("challenge_type") || "question");
            const payload = {
                game_id: gameId,
                title: String(formData.get("title") || "").trim(),
                description: String(formData.get("description") || "").trim(),
                image_url: imageUrl,
                challenge_type: type,
                question: String(formData.get("question") || "").trim(),
                correct_answer: type === "question" ? String(formData.get("correct_answer") || "").trim() : null,
                keyword: null,
                option_a: type === "multiple_choice" ? String(formData.get("option_a") || "").trim() : null,
                option_b: type === "multiple_choice" ? String(formData.get("option_b") || "").trim() : null,
                option_c: type === "multiple_choice" ? String(formData.get("option_c") || "").trim() : null,
                option_d: type === "multiple_choice" ? String(formData.get("option_d") || "").trim() : null,
                correct_option: type === "multiple_choice" ? String(formData.get("correct_option") || "a") : null,
                points: Number(formData.get("points") || 0),
                order_index: Number(formData.get("order_index") || 0),
                hint_1: String(formData.get("hint_1") || "").trim(),
                hint_2: String(formData.get("hint_2") || "").trim(),
                hint_penalty: Number(formData.get("hint_penalty") || 0),
                is_active: form.elements.is_active.checked,
                requires_admin_validation: form.elements.requires_admin_validation.checked
            };
            const query = id ? adminClient.from("escapetin_challenges").update(payload).eq("id", id) : adminClient.from("escapetin_challenges").insert(payload);
            const { error } = await query;
            if (error) throw error;
            await showAdminModal("Prueba guardada.", "Guardado");
            window.location.href = `challenges.html?game=${gameId}`;
        } catch (error) {
            await showAdminModal(error.message, "No se pudo guardar");
        } finally { submit.disabled = false; }
    });
}

async function bootParticipants() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;
    const gameId = getParam("game");
    const list = document.getElementById("participants-list");
    async function load() {
        const { data: game, error: gameError } = await adminClient.from("escapetin_games").select("*").eq("id", gameId).single();
        if (gameError) throw gameError;
        document.getElementById("participants-title").textContent = game.title;
        const { data, error } = await adminClient.from("escapetin_teams").select("*, escapetin_progress(count)").eq("game_id", gameId).order("total_points", { ascending: false });
        if (error) throw error;
        const { data: pending, error: pendingError } = await adminClient.from("escapetin_progress").select("id, answer, hints_used, created_at, is_correct, escapetin_teams(name), escapetin_challenges(title, points, challenge_type), escapetin_uploads(file_url)").eq("game_id", gameId).eq("is_correct", false).is("completed_at", null).order("created_at", { ascending: false });
        if (pendingError) throw pendingError;
        list.innerHTML = `
            ${data.length ? data.map((team, index) => `
                <article class="ranking-row">
                    <strong>${index + 1}. ${escapeHtml(team.name)}</strong>
                    <span>${team.total_points} puntos · ${team.escapetin_progress?.[0]?.count || 0} pruebas · PIN ${escapeHtml(team.recovery_pin || "-")} · ${team.finished_at ? "finalizado" : "en juego"}</span>
                </article>`).join("") : `<p>Aun no hay participantes.</p>`}
            <h2>Pendientes de revision</h2>
            ${pending.length ? pending.map((item) => `
                <article class="admin-card">
                    <span class="status-pill">${escapeHtml(challengeTypeLabel(item.escapetin_challenges?.challenge_type || "manual"))}</span>
                    <h2>${escapeHtml(item.escapetin_teams?.name)} · ${escapeHtml(item.escapetin_challenges?.title)}</h2>
                    <p>${escapeHtml(item.answer || "Sin respuesta textual")}</p>
                    ${item.escapetin_uploads?.[0]?.file_url ? `<a class="back-link" href="${escapeHtml(item.escapetin_uploads[0].file_url)}" target="_blank" rel="noopener">Ver foto enviada</a>` : ""}
                    <div class="admin-actions"><button class="btn btn-primary" type="button" data-approve="${item.id}">Aprobar</button><button class="btn btn-secondary" type="button" data-reject="${item.id}">Rechazar</button></div>
                </article>`).join("") : `<p>No hay pruebas pendientes.</p>`}`;
        list.querySelectorAll("[data-approve], [data-reject]").forEach((button) => button.addEventListener("click", async () => {
            const approved = Boolean(button.dataset.approve);
            const id = button.dataset.approve || button.dataset.reject;
            const { data: result, error: reviewError } = await adminClient.rpc("escapetin_review_progress", { p_progress_id: id, p_approved: approved });
            if (reviewError || result?.error) { await showAdminModal(reviewError?.message || result.error, "No se pudo revisar"); return; }
            await showAdminModal(approved ? "Prueba validada." : "Prueba rechazada.", "Revision");
            await load();
        }));
    }
    document.getElementById("refresh-participants").addEventListener("click", () => load().catch((error) => setAdminStatus(error.message, true)));
    try { await load(); } catch (error) { setAdminStatus(error.message, true); }
    adminClient.channel(`escapetin-admin-${gameId}`).on("postgres_changes", { event: "*", schema: "public", table: "escapetin_progress", filter: `game_id=eq.${gameId}` }, () => load().catch(() => {})).subscribe();
    setInterval(() => load().catch(() => {}), 30000);
}

if (adminPage === "login") bootLogin();
if (adminPage === "games") bootGames();
if (adminPage === "game-edit") bootGameEdit();
if (adminPage === "challenges") bootChallenges();
if (adminPage === "challenge-edit") bootChallengeEdit();
if (adminPage === "participants") bootParticipants();