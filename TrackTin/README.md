# TrackTin

TrackTin es una aplicación web en español integrada en el repositorio compartido **Webs**, dentro de `TrackTin/`, para seguir películas y series. Usa TMDB como fuente de información y Supabase para autenticación y datos personales.

La publicación se realiza junto al resto del repositorio en `https://www.alaraz1921.com/TrackTin/` (o en la ruta equivalente configurada en GitHub Pages).

## Primera versión

Incluye inicio de sesión, búsqueda de películas y series, fichas básicas, lista personal, estados, favoritos, valoraciones, notas, progreso de episodios, PWA y SQL con RLS. La aplicación usa rutas hash para funcionar en GitHub Pages.

## Configuración

1. Usa el proyecto Supabase compartido de Webs y ejecuta [`supabase/tracktin_schema.sql`](supabase/tracktin_schema.sql). Todos los objetos propios usan el prefijo SQL `tracktin_` para evitar colisiones.
2. Despliega la función `supabase/functions/tracktin-tmdb` y configura `TMDB_API_TOKEN`:

   ```bash
   supabase secrets set TMDB_API_TOKEN=tu_token
   supabase functions deploy tracktin-tmdb
   ```

3. Copia `js/config.example.js` como `js/config.js` y completa la URL, la clave anónima y la URL de la función.
4. Sirve el proyecto desde un servidor local, por ejemplo `python -m http.server 8080`.
5. Para GitHub Pages, publica la carpeta del proyecto y conserva `APP_BASE_PATH` como `/TrackTin/` si el repositorio se sirve con ese nombre.

## TMDB y atribuciones

Crea una cuenta en TMDB, genera un API Read Access Token y guárdalo solo como secreto de Supabase. TrackTin no está respaldada ni certificada por TMDB. Si se muestran proveedores, incluye también la atribución de JustWatch conforme a sus condiciones.

## Seguridad

La clave anónima de Supabase puede estar en el frontend porque las tablas tienen RLS. El token privado de TMDB nunca debe entrar en GitHub. No guardes credenciales en localStorage.

## Pruebas manuales

Comprueba registro, inicio/cierre de sesión, búsqueda, añadir títulos, actualización de estados, favoritos, notas, temporadas, marcar/desmarcar episodios, filtros, recarga de rutas y apertura offline de la carcasa de la PWA.

## Pendiente para una segunda versión

Cola completa de sincronización IndexedDB, listas personalizadas, estadísticas avanzadas, notificaciones de nueva versión y pruebas automatizadas end-to-end.
