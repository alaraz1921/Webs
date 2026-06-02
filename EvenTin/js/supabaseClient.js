(function () {
    const config = window.eventPlatformConfig;

    if (!window.supabase || !config?.supabaseUrl || !config?.supabaseAnonKey) {
        window.eventSupabase = null;
        return;
    }

    window.eventSupabase = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey
    );
})();
