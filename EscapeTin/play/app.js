const page = document.body.dataset.playPage;
const statusEl = document.getElementById("play-status");
let currentCode = EscapeTinApi.normalizeCode(EscapeTinApi.getQueryParam("code"));
let currentGame = null;

function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", Boolean(isError));
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return "-";
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function renderGameSummary(game) {
    return `
        <p class="eyebrow">${escapeHtml(game.access_code)}</p>
        <h2>${escapeHtml(game.title)}</h2>
        ${game.cover_image_url ? `<img class="app-cover" src="${escapeHtml(game.cover_image_url)}" alt="">` : ""}
        <p>${escapeHtml(game.description || "Prepara el equipo y empieza la mision.")}</p>
    `;
}

async function loadPublicGame(code) {
    const game = await EscapeTinApi.rpc("escapetin_get_public_game", { p_access_code: EscapeTinApi.normalizeCode(code) });
    if (!game || game.error) throw new Error(game?.error || "No se encontro una gincana activa con ese codigo.");
    return game;
}

async function bootAccessPage() {
    const codeInput = document.getElementById("game-code");
    const codeForm = document.getElementById("code-form");
    const gameAccess = document.getElementById("game-access");
    const gameSummary = document.getElementById("game-summary");
    const continueCard = document.getElementById("continue-card");
    const teamForm = document.getElementById("team-form");
    const recoverForm = document.getElementById("recover-form");

    async function selectCode(code) {
        setStatus("");
        currentCode = EscapeTinApi.normalizeCode(code);
        codeInput.value = currentCode;
        currentGame = await loadPublicGame(currentCode);
        gameSummary.innerHTML = renderGameSummary(currentGame);
        gameAccess.classList.remove("app-hidden");

        const storedToken = EscapeTinApi.getStoredToken(currentCode);
        continueCard.classList.add("app-hidden");
        if (storedToken) {
            try {
                const team = await EscapeTinApi.rpc("escapetin_get_team_by_token", { p_access_code: currentCode, p_access_token: storedToken });
                if (team && !team.error) {
                    continueCard.innerHTML = `
                        <strong>Continuar como ${escapeHtml(team.name)}</strong>
                        <span>${team.total_points || 0} puntos acumulados</span>
                        <a class="btn btn-secondary" href="${EscapeTinApi.challengeUrl(currentCode)}">Continuar partida</a>
                    `;
                    continueCard.classList.remove("app-hidden");
                }
            } catch (error) {
                EscapeTinApi.clearToken(currentCode);
            }
        }
    }

    codeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await selectCode(codeInput.value);
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    teamForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const formData = new FormData(teamForm);
            const result = await EscapeTinApi.rpc("escapetin_create_team", {
                p_access_code: currentCode,
                p_team_name: String(formData.get("team") || "").trim()
            });
            if (result.error) throw new Error(result.error);
            EscapeTinApi.storeToken(currentCode, result.access_token);
            alert(`Tu PIN de recuperacion es ${result.recovery_pin}. Guardalo o haz una captura para continuar desde otro dispositivo.`);
            window.location.href = EscapeTinApi.challengeUrl(currentCode);
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    recoverForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            const formData = new FormData(recoverForm);
            const result = await EscapeTinApi.rpc("escapetin_recover_team", {
                p_access_code: currentCode,
                p_team_name: String(formData.get("team") || "").trim(),
                p_recovery_pin: String(formData.get("pin") || "").trim()
            });
            if (result.error) throw new Error(result.error);
            EscapeTinApi.storeToken(currentCode, result.access_token);
            window.location.href = EscapeTinApi.challengeUrl(currentCode);
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    if (currentCode) {
        try {
            await selectCode(currentCode);
        } catch (error) {
            setStatus(error.message, true);
        }
    }
}


async function scanQrWithCamera(onCode) {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no permite escanear QR desde la web. Usa la camara normal del movil para abrir el enlace QR.");
    }
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.createElement("video");
    video.className = "qr-video";
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;
    await video.play();
    document.getElementById("game-state").appendChild(video);

    let stopped = false;
    const stop = () => {
        stopped = true;
        stream.getTracks().forEach((track) => track.stop());
        video.remove();
    };

    async function tick() {
        if (stopped) return;
        const codes = await detector.detect(video);
        if (codes.length) {
            stop();
            onCode(codes[0].rawValue || "");
            return;
        }
        requestAnimationFrame(tick);
    }
    tick();
}
async function bootChallengePage() {
    const stateEl = document.getElementById("game-state");
    const rankingLink = document.getElementById("ranking-link");
    if (rankingLink && currentCode) rankingLink.href = EscapeTinApi.rankingUrl(currentCode);

    async function loadState() {
        const token = EscapeTinApi.getStoredToken(currentCode);
        if (!currentCode || !token) {
            window.location.href = `index.html${currentCode ? `?code=${encodeURIComponent(currentCode)}` : ""}`;
            return;
        }
        const state = await EscapeTinApi.rpc("escapetin_get_current_state", { p_access_code: currentCode, p_access_token: token });
        if (state.error) throw new Error(state.error);
        renderState(state);
    }

    function renderFinal(state) {
        stateEl.innerHTML = `
            <p class="eyebrow">Gincana completada</p>
            <h1>Prueba superada</h1>
            <p class="app-lead">${escapeHtml(state.team.name)}, habeis terminado ${escapeHtml(state.game.title)} con ${state.team.total_points} puntos.</p>
            <div class="hero-actions">
                <a class="btn btn-primary" href="${EscapeTinApi.rankingUrl(currentCode)}">Ver ranking</a>
                <a class="btn btn-secondary" href="index.html">Volver al inicio</a>
            </div>
        `;
    }

    function renderChallengeCard(challenge, state, isFreeMode) {
        const isQr = challenge.challenge_type === "qr";
        const isPhoto = challenge.challenge_type === "photo";
        const isManual = challenge.challenge_type === "manual";
        const checkpoint = EscapeTinApi.getQueryParam("checkpoint");
        const progressText = isFreeMode ? `${state.completed_count} de ${state.total_challenges} completadas` : `Prueba ${state.completed_count + 1} de ${state.total_challenges}`;
        return `
            <article class="challenge-play-card" data-challenge-card="${challenge.id}">
                <p class="eyebrow">${escapeHtml(progressText)} · ${state.team.total_points} puntos</p>
                <h1>${escapeHtml(challenge.title)}</h1>
                ${challenge.image_url ? `<img class="app-cover" src="${escapeHtml(challenge.image_url)}" alt="">` : ""}
                <p class="app-lead">${escapeHtml(challenge.description || "Sigue la pista y resuelve la prueba.")}</p>
                ${challenge.question ? `<div class="notice-card"><strong>${escapeHtml(challenge.question)}</strong></div>` : ""}
                <div id="hint-box-${challenge.id}" class="hint-box"></div>
                <form class="stack-form answer-form" data-challenge-id="${challenge.id}">
                    ${isQr ? `<p>Esta prueba se completa escaneando o abriendo el QR correcto.</p>` : ""}
                    ${isPhoto ? `<label for="photo-${challenge.id}">Foto</label><input id="photo-${challenge.id}" name="photo" type="file" accept="image/*" capture="environment"><p>Primera version: registra la prueba como pendiente para revision del administrador.</p>` : ""}
                    ${isManual ? `<label for="answer-${challenge.id}">Respuesta para revisar</label><textarea id="answer-${challenge.id}" name="answer" rows="3" required></textarea><p>Quedara pendiente de validacion manual.</p>` : ""}
                    ${!isQr && !isPhoto && !isManual ? `<label for="answer-${challenge.id}">Respuesta</label><input id="answer-${challenge.id}" name="answer" type="text" autocomplete="off" required>` : ""}
                    <div class="hero-actions">
                        <button class="btn btn-primary" type="submit">${isQr ? "Validar QR" : isPhoto || isManual ? "Enviar prueba" : "Comprobar"}</button>
                        ${isQr ? `<button class="btn btn-secondary scan-qr-button" type="button" data-scan="${challenge.id}">Escanear QR</button>` : ""}
                        <button class="btn btn-secondary hint-button" type="button" data-hint="${challenge.id}">Necesito una pista</button>
                    </div>
                </form>
            </article>
        `;
    }

    function renderFinal(state) {
        stateEl.innerHTML = `
            <p class="eyebrow">Gincana completada</p>
            <h1>Gincana completada</h1>
            <p class="app-lead">${escapeHtml(state.team.name)}, habeis terminado ${escapeHtml(state.game.title)} con ${state.team.total_points} puntos.</p>
            <div class="hero-actions">
                <a class="btn btn-primary" href="${EscapeTinApi.rankingUrl(currentCode)}">Ver ranking</a>
                <a class="btn btn-secondary" href="index.html">Volver al inicio</a>
            </div>
        `;
    }

    function bindChallengeForms() {
        stateEl.querySelectorAll(".answer-form").forEach((form) => {
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                try {
                    const formData = new FormData(form);
                    const result = await EscapeTinApi.rpc("escapetin_submit_answer", {
                        p_access_code: currentCode,
                        p_access_token: EscapeTinApi.getStoredToken(currentCode),
                        p_answer: String(formData.get("answer") || formData.get("photo")?.name || ""),
                        p_checkpoint: EscapeTinApi.getQueryParam("checkpoint"),
                        p_challenge_id: form.dataset.challengeId || null
                    });
                    if (!result.correct) {
                        setStatus(result.message || "Respuesta incorrecta, intentalo de nuevo.", true);
                        return;
                    }
                    setStatus(result.message || "Prueba superada", false);
                    setTimeout(loadState, 700);
                } catch (error) {
                    setStatus(error.message, true);
                }
            });
        });

        stateEl.querySelectorAll(".hint-button").forEach((button) => {
            button.addEventListener("click", async () => {
                try {
                    const result = await EscapeTinApi.rpc("escapetin_use_hint", {
                        p_access_code: currentCode,
                        p_access_token: EscapeTinApi.getStoredToken(currentCode),
                        p_challenge_id: button.dataset.hint || null
                    });
                    if (result.error) throw new Error(result.error);
                    document.getElementById(`hint-box-${button.dataset.hint}`).innerHTML = `<div class="notice-card"><strong>Pista ${result.hints_used}</strong><span>${escapeHtml(result.hint || "No hay mas pistas disponibles.")}</span></div>`;
                } catch (error) {
                    setStatus(error.message, true);
                }
            });
        });

        stateEl.querySelectorAll(".scan-qr-button").forEach((button) => {
            button.addEventListener("click", async () => {
                try {
                    await scanQrWithCamera((rawValue) => {
                        const url = new URL(rawValue, window.location.href);
                        const checkpoint = url.searchParams.get("checkpoint") || rawValue;
                        const current = new URL(window.location.href);
                        current.searchParams.set("checkpoint", checkpoint);
                        window.location.href = current.href;
                    });
                } catch (error) {
                    setStatus(error.message, true);
                }
            });
        });
    }

    function renderState(state) {
        if (state.error) {
            stateEl.innerHTML = `<h1>Ups</h1><p class="app-lead">${escapeHtml(state.error)}</p>`;
            return;
        }
        if (state.finished || (!state.challenge && !state.available_challenges?.length)) {
            renderFinal(state);
            return;
        }

        if (state.message) {
            stateEl.innerHTML = `<p class="eyebrow">Estado de la gincana</p><h1>${escapeHtml(state.game?.title || "EscapeTin")}</h1><p class="app-lead">${escapeHtml(state.message)}</p>`;
            return;
        }

        const freeChallenges = state.available_challenges || [];
        if (state.game.mode === "free" && freeChallenges.length) {
            stateEl.innerHTML = `
                <p class="eyebrow">Modo libre · ${state.team.total_points} puntos</p>
                <h1>${escapeHtml(state.game.title)}</h1>
                <p class="app-lead">Elige cualquier prueba activa y completala en el orden que prefieras.</p>
                <div class="free-challenge-list">${freeChallenges.map((challenge) => renderChallengeCard(challenge, state, true)).join("")}</div>
            `;
        } else {
            stateEl.innerHTML = renderChallengeCard(state.challenge, state, false);
        }
        bindChallengeForms();
    }
    try {
        await loadState();
    } catch (error) {
        setStatus(error.message, true);
    }
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
        list.innerHTML = `
            <h2>${escapeHtml(result.game.title)}</h2>
            ${result.ranking.length ? result.ranking.map((team, index) => `
                <article class="ranking-row">
                    <strong>${index + 1}. ${escapeHtml(team.name)}</strong>
                    <span>${team.total_points} puntos · ${formatTime(team.elapsed_seconds)}</span>
                </article>
            `).join("") : `<p>Aun no hay equipos en el ranking.</p>`}
        `;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            currentCode = EscapeTinApi.normalizeCode(codeInput.value);
            await loadRanking(currentCode);
        } catch (error) {
            setStatus(error.message, true);
        }
    });

    if (currentCode) {
        try {
            await loadRanking(currentCode);
        } catch (error) {
            setStatus(error.message, true);
        }
    }
}

if (page === "access") bootAccessPage();
if (page === "challenge") bootChallengePage();
if (page === "ranking") bootRankingPage();