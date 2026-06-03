(function () {
    const config = window.eventPlatformConfig;

    const hasConfig = config?.supabaseUrl
        && config?.supabaseAnonKey
        && !config.supabaseUrl.includes('TU-PROYECTO')
        && !config.supabaseAnonKey.includes('TU_ANON_PUBLIC_KEY');

    if (!window.supabase || !hasConfig) {
        window.eventSupabase = null;
        return;
    }

    window.eventSupabase = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey
    );
})();
