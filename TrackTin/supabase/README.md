# Supabase

Ejecuta `tracktin_schema.sql`, después `tracktin_lists.sql` y finalmente `tracktin_stats.sql` en el SQL Editor. El último script añade metadatos opcionales para calcular tiempos y géneros. Despliega la función con `supabase functions deploy tracktin-tmdb` y guarda el token con `supabase secrets set TMDB_API_TOKEN=...`. Configura en Auth las URLs de redirección del sitio de GitHub Pages.
