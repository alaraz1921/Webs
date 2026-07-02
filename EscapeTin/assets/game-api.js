const EscapeTinApi = (() => {
    const client = window.websSupabase;
    const storagePrefix = "escapetin_team_token_";

    function normalizeCode(code) {
        return String(code || "").trim().toUpperCase();
    }

    function tokenKey(code) {
        return `${storagePrefix}${normalizeCode(code)}`;
    }

    function getStoredToken(code) {
        return localStorage.getItem(tokenKey(code));
    }

    function storeToken(code, token) {
        localStorage.setItem(tokenKey(code), token);
    }

    function clearToken(code) {
        localStorage.removeItem(tokenKey(code));
    }

    async function rpc(name, args = {}) {
        if (!client) throw new Error("Supabase no esta disponible.");
        const { data, error } = await client.rpc(name, args);
        if (error) throw error;
        return data;
    }

    function getQueryParam(name) {
        return new URLSearchParams(window.location.search).get(name) || "";
    }

    function publicGameUrl(code) {
        const base = new URL("index.html", window.location.href);
        base.searchParams.set("code", normalizeCode(code));
        return base.href;
    }

    function challengeUrl(code) {
        const url = new URL("challenge.html", window.location.href);
        url.searchParams.set("code", normalizeCode(code));
        return url.href;
    }

    function rankingUrl(code) {
        const url = new URL("ranking.html", window.location.href);
        url.searchParams.set("code", normalizeCode(code));
        return url.href;
    }

    return {
        client,
        normalizeCode,
        tokenKey,
        getStoredToken,
        storeToken,
        clearToken,
        rpc,
        getQueryParam,
        publicGameUrl,
        challengeUrl,
        rankingUrl
    };
})();