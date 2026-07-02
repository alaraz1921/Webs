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

async function getSessionOrRedirect() {
    const { data } = await adminClient.auth.getSession();
    if (!data.session) {
        window.location.href = "login.html";
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
    if (data.session) window.location.href = "index.html";

    document.getElementById("login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        setAdminStatus("");
        const formData = new FormData(event.target);
        const { error } = await adminClient.auth.signInWithPassword({
            email: String(formData.get("email") || "").trim(),
            password: String(formData.get("password") || "")
        });
        if (error) {
            setAdminStatus("No se pudo iniciar sesion.", true);
            return;
        }
        window.location.href = "index.html";
    });
}

async function bootGames() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;

    const list = document.getElementById("games-list");
    const { data, error } = await adminClient
        .from("escapetin_games")
        .select("*, escapetin_challenges(count)")
        .order("created_at", { ascending: false });

    if (error) {
        setAdminStatus(error.message, true);
        return;
    }

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
                    <button class="btn btn-primary" type="button" data-copy="${playUrl.href}">Copiar enlace</button>
                </div>
            </article>
        `;
    }).join("") : `<p>Aun no hay gincanas. Crea la primera mision.</p>`;

    list.querySelectorAll("[data-copy]").forEach((button) => {
        button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(button.dataset.copy);
            button.textContent = "Enlace copiado";
        });
    });
}

async function bootGameEdit() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;

    const id = getParam("id");
    const form = document.getElementById("game-form");
    const title = document.getElementById("editor-title");
    const codeInput = document.getElementById("access_code");
    if (!id) codeInput.value = makeCode();

    document.getElementById("generate-code").addEventListener("click", () => {
        codeInput.value = makeCode();
    });

    if (id) {
        title.textContent = "Editar gincana";
        const { data, error } = await adminClient.from("escapetin_games").select("*").eq("id", id).single();
        if (error) {
            setAdminStatus(error.message, true);
            return;
        }
        ["title", "description", "cover_image_url", "access_code", "status"].forEach((field) => {
            form.elements[field].value = data[field] || "";
        });
        form.elements.show_ranking.checked = data.show_ranking;
        form.elements.allow_teams.checked = data.allow_teams;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            title: String(formData.get("title") || "").trim(),
            description: String(formData.get("description") || "").trim(),
            cover_image_url: String(formData.get("cover_image_url") || "").trim(),
            access_code: String(formData.get("access_code") || "").trim().toUpperCase(),
            status: String(formData.get("status") || "draft"),
            show_ranking: form.elements.show_ranking.checked,
            allow_teams: form.elements.allow_teams.checked,
            created_by: session.user.id
        };

        const query = id
            ? adminClient.from("escapetin_games").update(payload).eq("id", id)
            : adminClient.from("escapetin_games").insert(payload).select("id").single();
        const { data, error } = await query;
        if (error) {
            setAdminStatus(error.message, true);
            return;
        }
        setAdminStatus("Gincana guardada correctamente.");
        if (!id && data?.id) window.location.href = `challenges.html?game=${data.id}`;
    });
}

async function bootChallenges() {
    await setupLogout();
    const session = await getSessionOrRedirect();
    if (!session) return;
    const gameId = getParam("game");
    const list = document.getElementById("challenge-list");
    const form = document.getElementById("challenge-form");

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
                    <span class="status-pill">${escapeHtml(challenge.challenge_type)} · ${challenge.points} pts</span>
                    <h2>${escapeHtml(challenge.order_index)}. ${escapeHtml(challenge.title)}</h2>
                    <p>${escapeHtml(challenge.description || "")}</p>
                    <div class="admin-actions">
                        <button class="btn btn-secondary" type="button" data-edit="${challenge.id}">Editar</button>
                        <button class="btn btn-secondary" type="button" data-copy="${qrUrl.href}">Copiar QR/link</button>
                        <button class="btn btn-primary" type="button" data-delete="${challenge.id}">Eliminar</button>
                    </div>
                </article>
            `;
        }).join("") : `<p>No hay pruebas todavia.</p>`;

        list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
            const challenge = data.find((item) => item.id === button.dataset.edit);
            Object.entries(challenge).forEach(([key, value]) => {
                if (form.elements[key] && form.elements[key].type !== "checkbox") form.elements[key].value = value ?? "";
            });
            form.elements.id.value = challenge.id;
            form.elements.is_active.checked = challenge.is_active;
            document.getElementById("challenge-form-title").textContent = "Editar prueba";
        }));
        list.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(button.dataset.copy);
            button.textContent = "Copiado";
        }));
        list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
            if (!confirm("Eliminar esta prueba?")) return;
            const { error } = await adminClient.from("escapetin_challenges").delete().eq("id", button.dataset.delete);
            if (error) setAdminStatus(error.message, true);
            await load();
        }));
    }

    document.getElementById("reset-challenge").addEventListener("click", () => {
        form.reset();
        form.elements.id.value = "";
        form.elements.points.value = 10;
        form.elements.order_index.value = 0;
        form.elements.is_active.checked = true;
        document.getElementById("challenge-form-title").textContent = "Anadir prueba";
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const id = String(formData.get("id") || "");
        const payload = {
            game_id: gameId,
            title: String(formData.get("title") || "").trim(),
            description: String(formData.get("description") || "").trim(),
            image_url: String(formData.get("image_url") || "").trim(),
            challenge_type: String(formData.get("challenge_type") || "question"),
            question: String(formData.get("question") || "").trim(),
            correct_answer: String(formData.get("correct_answer") || "").trim(),
            keyword: String(formData.get("keyword") || "").trim(),
            points: Number(formData.get("points") || 0),
            order_index: Number(formData.get("order_index") || 0),
            hint_1: String(formData.get("hint_1") || "").trim(),
            hint_2: String(formData.get("hint_2") || "").trim(),
            hint_penalty: Number(formData.get("hint_penalty") || 0),
            is_active: form.elements.is_active.checked
        };
        const query = id
            ? adminClient.from("escapetin_challenges").update(payload).eq("id", id)
            : adminClient.from("escapetin_challenges").insert(payload);
        const { error } = await query;
        if (error) {
            setAdminStatus(error.message, true);
            return;
        }
        setAdminStatus("Prueba guardada.");
        form.reset();
        form.elements.id.value = "";
        await load();
    });

    try { await load(); } catch (error) { setAdminStatus(error.message, true); }
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
        const { data, error } = await adminClient
            .from("escapetin_teams")
            .select("*, escapetin_progress(count)")
            .eq("game_id", gameId)
            .order("total_points", { ascending: false });
        if (error) throw error;
        list.innerHTML = data.length ? data.map((team, index) => `
            <article class="ranking-row">
                <strong>${index + 1}. ${escapeHtml(team.name)}</strong>
                <span>${team.total_points} puntos · ${team.escapetin_progress?.[0]?.count || 0} pruebas · ${team.finished_at ? "finalizado" : "en juego"}</span>
            </article>
        `).join("") : `<p>Aun no hay participantes.</p>`;
    }

    document.getElementById("refresh-participants").addEventListener("click", () => load().catch((error) => setAdminStatus(error.message, true)));
    try { await load(); } catch (error) { setAdminStatus(error.message, true); }
}

if (adminPage === "login") bootLogin();
if (adminPage === "games") bootGames();
if (adminPage === "game-edit") bootGameEdit();
if (adminPage === "challenges") bootChallenges();
if (adminPage === "participants") bootParticipants();