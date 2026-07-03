const page = document.body.dataset.playPage;
const statusEl = document.getElementById("play-status");
let currentCode = EscapeTinApi.normalizeCode(EscapeTinApi.getQueryParam("code"));
let currentGame = null;
let realtimeChannel = null;
let pendingPoll = null;

function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function showStep(id) {
    document.querySelectorAll(".flow-step").forEach((step) => step.classList.toggle("app-hidden", step.id !== id));
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function ensureModal() {
    let modal = document.getElementById("app-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "app-modal";
    modal.className = "permission-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="permission-modal-box" role="dialog" aria-modal="true"><h2 id="app-modal-title"></h2><p id="app-modal-message"></p><div class="modal-actions"><button class="btn btn-primary" type="button">Aceptar</button></div></div>`;
    document.body.appendChild(modal);
    return modal;
}

function showPlayModal(message, title = "EscapeTin") {
    return new Promise((resolve) => {
        const modal = ensureModal();
        modal.querySelector("#app-modal-title").textContent = title;
        modal.querySelector("#app-modal-message").textContent = message;
        const button = modal.querySelector("button");
        button.onclick = () => { modal.hidden = true; resolve(); };
        modal.hidden = false;
        button.focus();
    });
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return "-";
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function renderGameSummary(game) {
    return `<p class="eyebrow">Codigo ${escapeHtml(game.access_code)}</p><h2>${escapeHtml(game.title)}</h2>${game.cover_image_url ? `<img class="app-cover" src="${escapeHtml(game.cover_image_url)}" alt="">` : ""}<p>${escapeHtml(game.description || "Prepara el equipo y empieza la mision.")}</p>`;
}

async function loadPublicGame(code) {
    const game = await EscapeTinApi.rpc("escapetin_get_public_game", { p_access_code: EscapeTinApi.normalizeCode(code) });
    if (!game || game.error) throw new Error(game?.error || "No se encontro una gincana activa con ese codigo.");
    return game;
}

async function bootAccessPage() {
    const codeInput = document.getElementById("game-code");
    const gameSummary = document.getElementById("game-summary");
    const recoverSelect = document.getElementById("recover-name");

    async function populateTeams() {
        recoverSelect.innerHTML = `<option value="">Cargando equipos...</option>`;
        const result = await EscapeTinApi.rpc("escapetin_list_game_teams", { p_access_code: currentCode });
        if (result.error) throw new Error(result.error);
        recoverSelect.innerHTML = result.length
            ? `<option value="">Escoge equipo</option>${result.map((team) => `<option value="${escapeHtml(team.name)}">${escapeHtml(team.name)}</option>`).join("")}`
            : `<option value="">No hay equipos creados</option>`;
    }

    async function selectCode(code) {
        setStatus("");
        currentCode = EscapeTinApi.normalizeCode(code);
        codeInput.value = currentCode;
        currentGame = await loadPublicGame(currentCode);
        gameSummary.innerHTML = renderGameSummary(currentGame);
        showStep("choice-step");
    }

    document.getElementById("code-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try { await selectCode(codeInput.value); }
        catch (error) { await showPlayModal(error.message, "No encontramos la gincana"); }
    });

    document.getElementById("new-team-button").addEventListener("click", () => showStep("new-team-step"));
    document.getElementById("continue-team-button").addEventListener("click", async () => {
        try { await populateTeams(); showStep("recover-step"); }
        catch (error) { await showPlayModal(error.message, "No se pudo cargar equipos"); }
    });
    document.querySelectorAll("[data-back-choice]").forEach((button) => button.addEventListener("click", () => showStep("choice-step")));

    document.getElementById("team-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const formData = new FormData(event.target);
            const result = await EscapeTinApi.rpc("escapetin_create_team", { p_access_code: currentCode, p_team_name: String(formData.get("team") || "").trim() });
            if (result.error) throw new Error(result.error);
            EscapeTinApi.storeToken(currentCode, result.access_token);
            await showPlayModal(`Tu PIN de recuperacion es ${result.recovery_pin}. Guardalo o haz una captura para continuar desde otro dispositivo.`, "PIN de recuperacion");
            window.location.href = EscapeTinApi.challengeUrl(currentCode);
        } catch (error) { await showPlayModal(error.message, "No se pudo crear el equipo"); }
    });

    document.getElementById("recover-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const formData = new FormData(event.target);
            const result = await EscapeTinApi.rpc("escapetin_recover_team", { p_access_code: currentCode, p_team_name: String(formData.get("team") || "").trim(), p_recovery_pin: String(formData.get("pin") || "").trim() });
            if (result.error) throw new Error(result.error);
            EscapeTinApi.storeToken(currentCode, result.access_token);
            window.location.href = EscapeTinApi.challengeUrl(currentCode);
        } catch (error) { await showPlayModal(error.message, "No se pudo continuar"); }
    });

    if (currentCode) {
        try { await selectCode(currentCode); }
        catch (error) { await showPlayModal(error.message, "No encontramos la gincana"); }
    }
}

async function scanQrWithCamera(onCode) {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite escanear QR desde la web. Usa la camara normal del movil para abrir el enlace QR.");
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.createElement("video");
    video.className = "qr-video";
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;
    await video.play();
    document.getElementById("game-state").appendChild(video);
    let stopped = false;
    const stop = () => { stopped = true; stream.getTracks().forEach((track) => track.stop()); video.remove(); };
    async function tick() {
        if (stopped) return;
        const codes = await detector.detect(video);
        if (codes.length) { stop(); onCode(codes[0].rawValue || ""); return; }
        requestAnimationFrame(tick);
    }
    tick();
}

async function uploadPhotoFile(file, state, challengeId) {
    if (!file) return "";
    return EscapeTinMedia.uploadImage(EscapeTinApi.client, file, `${state.game.id}/${state.team.id}/${challengeId}`);
}

async function bootChallengePage() {
    const stateEl = document.getElementById("game-state");
    const rankingLink = document.getElementById("ranking-link");
    if (rankingLink && currentCode) rankingLink.href = EscapeTinApi.rankingUrl(currentCode);

    async function loadState() {
        const token = EscapeTinApi.getStoredToken(currentCode);
        if (!currentCode || !token) { window.location.href = `index.html${currentCode ? `?code=${encodeURIComponent(currentCode)}` : ""}`; return; }
        const state = await EscapeTinApi.rpc("escapetin_get_current_state", { p_access_code: currentCode, p_access_token: token });
        if (state.error) throw new Error(state.error);
        renderState(state);
    }

    function clearPendingWatch() {
        if (realtimeChannel) {
            EscapeTinApi.client.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
        if (pendingPoll) {
            clearInterval(pendingPoll);
            pendingPoll = null;
        }
    }

    function setupPendingWatch(state) {
        if (realtimeChannel) EscapeTinApi.client.removeChannel(realtimeChannel);
        if (pendingPoll) clearInterval(pendingPoll);
        const pendingId = state.pending_progress?.id;
        realtimeChannel = EscapeTinApi.client.channel(`escapetin-player-${state.team.id}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "escapetin_progress", filter: `team_id=eq.${state.team.id}` }, async (payload) => {
                if (payload.new?.id === pendingId && payload.new?.is_correct) { await showPlayModal("El administrador ha validado la prueba. A por la siguiente prueba", "Prueba validada"); await loadState(); }
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "escapetin_progress" }, async (payload) => {
                if (payload.old?.id === pendingId) { await showPlayModal("El administrador ha rechazado la prueba. Puedes volver a responderla.", "Prueba rechazada"); await loadState(); }
            }).subscribe();
        pendingPoll = setInterval(async () => {
            try {
                const token = EscapeTinApi.getStoredToken(currentCode);
                const fresh = await EscapeTinApi.rpc("escapetin_get_current_state", { p_access_code: currentCode, p_access_token: token });
                if (!fresh.pending_progress) { await showPlayModal("El administrador ha revisado la prueba.", "Revision completada"); await loadState(); }
            } catch (_) {}
        }, 6000);
    }

    function renderFinal(state) {
        stateEl.innerHTML = `<p class="eyebrow">Gincana completada</p><h1>Gincana completada</h1><p class="app-lead">${escapeHtml(state.team.name)}, habeis terminado ${escapeHtml(state.game.title)} con ${state.team.total_points} puntos.</p><div class="hero-actions"><a class="btn btn-primary" href="${EscapeTinApi.rankingUrl(currentCode)}">Ver ranking</a><a class="btn btn-secondary" href="index.html">Volver al inicio</a></div>`;
    }

    function renderOptions(challenge) {
        return `<div class="choice-options">${[["a", challenge.option_a], ["b", challenge.option_b], ["c", challenge.option_c], ["d", challenge.option_d]].filter(([, text]) => text).map(([value, text]) => `<label><input type="radio" name="answer" value="${value}" required><span>${escapeHtml(text)}</span></label>`).join("")}</div>`;
    }

    function renderChallengeCard(challenge, state, isFreeMode) {
        const isQr = challenge.challenge_type === "qr";
        const isPhoto = challenge.challenge_type === "photo";
        const isManual = challenge.challenge_type === "manual";
        const isOptions = challenge.challenge_type === "multiple_choice";
        const progressText = isFreeMode ? `${state.completed_count} de ${state.total_challenges} completadas` : `Prueba ${state.completed_count + 1} de ${state.total_challenges}`;
        return `<article class="challenge-play-card" data-challenge-card="${challenge.id}"><p class="eyebrow">${escapeHtml(progressText)} · ${state.team.total_points} puntos</p><h1>${escapeHtml(challenge.title)}</h1>${challenge.image_url ? `<img class="app-cover" src="${escapeHtml(challenge.image_url)}" alt="">` : ""}<p class="app-lead">${escapeHtml(challenge.description || "Sigue la pista y resuelve la prueba.")}</p>${challenge.question ? `<div class="notice-card"><strong>${escapeHtml(challenge.question)}</strong></div>` : ""}<div id="hint-box-${challenge.id}" class="hint-box"></div><form class="stack-form answer-form" data-challenge-id="${challenge.id}" data-game-id="${state.game.id}" data-team-id="${state.team.id}">${isQr ? `<p>Esta prueba se completa escaneando o abriendo el QR correcto.</p>` : ""}${isPhoto ? `<label for="photo-${challenge.id}">Foto</label><input id="photo-${challenge.id}" name="photo" type="file" accept="image/*"><p>La foto quedara pendiente de revision del administrador.</p>` : ""}${isManual ? `<label for="answer-${challenge.id}">Respuesta para revisar</label><textarea id="answer-${challenge.id}" name="answer" rows="3" required></textarea><p>Quedara pendiente de validacion manual.</p>` : ""}${isOptions ? renderOptions(challenge) : ""}${!isQr && !isPhoto && !isManual && !isOptions ? `<label for="answer-${challenge.id}">Respuesta</label><input id="answer-${challenge.id}" name="answer" type="text" autocomplete="off" required>` : ""}<div class="hero-actions"><button class="btn btn-primary" type="submit">${isQr ? "Validar QR" : isPhoto || isManual ? "Enviar prueba" : "Comprobar"}</button>${isQr ? `<button class="btn btn-secondary scan-qr-button" type="button" data-scan="${challenge.id}">Escanear QR</button>` : ""}<button class="btn btn-secondary hint-button" type="button" data-hint="${challenge.id}">Necesito una pista</button></div></form></article>`;
    }

    function renderPending(state) {
        stateEl.innerHTML = `<p class="eyebrow">Validacion manual</p><h1>Esperando validacion</h1><p class="app-lead">El administrador esta revisando la prueba "${escapeHtml(state.pending_progress.challenge_title)}". Esta pantalla se actualizara automaticamente.</p><div class="notice-card"><strong>Equipo ${escapeHtml(state.team.name)}</strong><span>${state.team.total_points} puntos acumulados</span></div>`;
        setupPendingWatch(state);
    }

    function bindChallengeForms() {
        stateEl.querySelectorAll("input[type='file']").forEach((input) => EscapeTinMedia.configureImageInput(input));
        stateEl.querySelectorAll(".answer-form").forEach((form) => {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                try {
                    const formData = new FormData(form);
                    const photoFile = formData.get("photo") instanceof File && formData.get("photo").size ? formData.get("photo") : null;
                    const fileUrl = photoFile ? await uploadPhotoFile(photoFile, { game: { id: form.dataset.gameId }, team: { id: form.dataset.teamId } }, form.dataset.challengeId) : "";
                    const result = await EscapeTinApi.rpc("escapetin_submit_answer", { p_access_code: currentCode, p_access_token: EscapeTinApi.getStoredToken(currentCode), p_answer: String(formData.get("answer") || photoFile?.name || ""), p_checkpoint: EscapeTinApi.getQueryParam("checkpoint"), p_challenge_id: form.dataset.challengeId || null, p_file_url: fileUrl || null });
                    if (!result.correct) { await showPlayModal(result.message || "Respuesta incorrecta, intentalo de nuevo.", "Respuesta incorrecta"); return; }
                    if (result.pending) { await showPlayModal(result.message || "Esperando validacion.", "Prueba enviada"); await loadState(); return; }
                    await showPlayModal(result.message || "Prueba superada. A por la siguiente prueba", "Correcto");
                    await loadState();
                } catch (error) { await showPlayModal(error.message, "No se pudo enviar"); }
            });
        });
        stateEl.querySelectorAll(".hint-button").forEach((button) => button.addEventListener("click", async () => {
            try {
                const result = await EscapeTinApi.rpc("escapetin_use_hint", { p_access_code: currentCode, p_access_token: EscapeTinApi.getStoredToken(currentCode), p_challenge_id: button.dataset.hint || null });
                if (result.error) throw new Error(result.error);
                document.getElementById(`hint-box-${button.dataset.hint}`).innerHTML = `<div class="notice-card"><strong>Pista ${result.hints_used}</strong><span>${escapeHtml(result.hint || "No hay mas pistas disponibles.")}</span></div>`;
            } catch (error) { await showPlayModal(error.message, "Pista no disponible"); }
        }));
        stateEl.querySelectorAll(".scan-qr-button").forEach((button) => button.addEventListener("click", async () => {
            try { await scanQrWithCamera((rawValue) => { const url = new URL(rawValue, window.location.href); const checkpoint = url.searchParams.get("checkpoint") || rawValue; const current = new URL(window.location.href); current.searchParams.set("checkpoint", checkpoint); window.location.href = current.href; }); }
            catch (error) { await showPlayModal(error.message, "Camara no disponible"); }
        }));
    }

    function renderState(state) {
        if (state.error) { stateEl.innerHTML = `<h1>Ups</h1><p class="app-lead">${escapeHtml(state.error)}</p>`; return; }
        if (state.pending_progress) { renderPending(state); return; }
        clearPendingWatch();
        if (state.finished || (!state.challenge && !state.available_challenges?.length)) { renderFinal(state); return; }
        if (state.message) { stateEl.innerHTML = `<p class="eyebrow">Estado de la gincana</p><h1>${escapeHtml(state.game?.title || "EscapeTin")}</h1><p class="app-lead">${escapeHtml(state.message)}</p>`; return; }
        const freeChallenges = state.available_challenges || [];
        if (state.game.mode === "free" && freeChallenges.length) {
            stateEl.innerHTML = `<p class="eyebrow">Modo libre · ${state.team.total_points} puntos</p><h1>${escapeHtml(state.game.title)}</h1><p class="app-lead">Elige cualquier prueba activa y completala en el orden que prefieras.</p><div class="free-challenge-list">${freeChallenges.map((challenge) => renderChallengeCard(challenge, state, true)).join("")}</div>`;
        } else stateEl.innerHTML = renderChallengeCard(state.challenge, state, false);
        bindChallengeForms();
    }
    try { await loadState(); } catch (error) { await showPlayModal(error.message, "No se pudo cargar la prueba"); }
}

async function bootRankingPage() {
    const form = document.getElementById("ranking-form");
    const codeInput = document.getElementById("ranking-code");
    const list = document.getElementById("ranking-list");
    if (currentCode) codeInput.value = currentCode;
    async function loadRanking(code) {
        setStatus("");
        const result = await EscapeTinApi.rpc("escapetin_get_ranking", { p_access_code: EscapeTinApi.normalizeCode(code) });
        if (result.error) throw new Error(result.error);
        list.innerHTML = `<h2>${escapeHtml(result.game.title)}</h2>${result.ranking.length ? result.ranking.map((team, index) => `<article class="ranking-row"><strong>${index + 1}. ${escapeHtml(team.name)}</strong><span>${team.total_points} puntos · ${formatTime(team.elapsed_seconds)}</span></article>`).join("") : `<p>Aun no hay equipos en el ranking.</p>`}`;
    }
    form.addEventListener("submit", async (event) => { event.preventDefault(); try { currentCode = EscapeTinApi.normalizeCode(codeInput.value); await loadRanking(currentCode); } catch (error) { await showPlayModal(error.message, "Ranking no disponible"); } });
    if (currentCode) { try { await loadRanking(currentCode); } catch (error) { await showPlayModal(error.message, "Ranking no disponible"); } }
}

if (page === "access") bootAccessPage();
if (page === "challenge") bootChallengePage();
if (page === "ranking") bootRankingPage();