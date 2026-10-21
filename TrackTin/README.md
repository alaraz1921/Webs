# TrackTin

TrackTin es una aplicación web en español integrada en el repositorio compartido **Webs**, dentro de `TrackTin/`, para seguir películas y series. Usa TMDB como fuente de información y Supabase para autenticación y datos personales.

La publicación se realiza junto al resto del repositorio en `https://www.alaraz1921.com/TrackTin/` (o en la ruta equivalente configurada en GitHub Pages).

## Funcionalidades implementadas

- Inicio y cierre de sesión con correo y contraseña mediante Supabase, con comprobación de permisos de acceso a TrackTin.
- Inicio con títulos en seguimiento, pendientes, favoritos, añadidos recientemente y siguiente episodio pendiente.
- Búsqueda de películas y series en TMDB o entre los títulos de las listas personales.
- Fichas con carátula, año, géneros, sinopsis desplegable y plataformas disponibles en España según los datos de TMDB.
- Mi lista con filtros por tipo, estado, lista personalizada y favoritos, además de edición de estado, valoración personal y notas desde la ficha.
- Listas personalizadas: crear, renombrar, borrar y añadir o quitar títulos. Borrar una lista personalizada conserva los títulos en Mi lista principal.
- Seguimiento de series por temporadas y episodios: marcar o desmarcar episodios, temporadas o la serie completa, con confirmación para esta última. El marcado en bloque incluye los episodios emitidos o sin fecha conocida.
- Progreso de visionado, siguiente episodio pendiente y actualización automática del estado de las series según el progreso y los datos de emisión.
- Estadísticas de películas y episodios vistos, series completadas, tiempo estimado, géneros más vistos y actividad de episodios del mes y del año. Cuando falta la duración, el cálculo usa 120 minutos por película y 45 por episodio.
- PWA con manifiesto, service worker y caché básica de recursos; todavía no incluye una cola de sincronización de cambios offline.

La aplicación usa HTML, CSS y JavaScript con módulos, sin proceso de compilación. La navegación entre vistas se mantiene en memoria; no hay rutas hash implementadas.

## Configuración

1. Usa el proyecto Supabase compartido de Webs y ejecuta [`supabase/tracktin_schema.sql`](supabase/tracktin_schema.sql). Todos los objetos propios usan el prefijo SQL `tracktin_` para evitar colisiones.
2. Ejecuta después [`supabase/tracktin_lists.sql`](supabase/tracktin_lists.sql) para activar las listas personalizadas, sus políticas RLS y sus permisos.
3. Ejecuta [`supabase/tracktin_stats.sql`](supabase/tracktin_stats.sql) para guardar metadatos opcionales usados por las estadísticas.
4. Con el sistema compartido de proyectos y permisos de Webs ya instalado (`app_projects`, `project_members` e `is_admin()`), ejecuta la migración [`../supabase/migrations/20260925120000_tracktin_access.sql`](../supabase/migrations/20260925120000_tracktin_access.sql). Registra TrackTin, define `public.can_use_tracktin()` y añade la comprobación de acceso a las políticas RLS. Los usuarios deben ser administradores o miembros del proyecto activo `tracktin`.
5. Despliega la función `supabase/functions/tracktin-tmdb` y configura `TMDB_API_TOKEN`:

   ```bash
   supabase secrets set TMDB_API_TOKEN=tu_token
   supabase functions deploy tracktin-tmdb
   ```

6. Copia `js/config.example.js` como `js/config.js` y completa la URL, la clave anónima y la URL de la función. Configura también las URLs de redirección en Supabase Auth.
7. Desde la raíz del repositorio, sirve el proyecto con `python -m http.server 8080` y abre `http://localhost:8080/TrackTin/`.
8. Para GitHub Pages, publica el proyecto en `/TrackTin/`, la ruta usada por el manifiesto y el service worker. `APP_BASE_PATH` está declarado en la configuración, pero actualmente no se utiliza en el código.

## TMDB y atribuciones

Crea una cuenta en TMDB, genera un API Read Access Token y guárdalo solo como secreto de Supabase. TrackTin no está respaldada ni certificada por TMDB. Si se muestran proveedores, incluye también la atribución de JustWatch conforme a sus condiciones.

## Seguridad

La clave anónima de Supabase puede estar en el frontend porque las tablas tienen RLS. Las políticas de la migración compartida comprueban tanto la propiedad de los datos (`auth.uid() = user_id`) como el permiso de acceso mediante `can_use_tracktin()`. El frontend consulta esa misma función al iniciar la sesión y muestra «Acceso no autorizado» si no obtiene permiso.

El token privado de TMDB se guarda como secreto de la Edge Function y nunca debe entrar en GitHub. La aplicación no implementa registro de cuentas desde su interfaz; las cuentas y sus permisos se gestionan mediante el sistema compartido de Webs y Supabase. La sesión se gestiona con el cliente de Supabase; no añadas almacenamiento manual de contraseñas o del token privado de TMDB.

## Pruebas manuales

Comprueba inicio/cierre de sesión con una cuenta autorizada y rechazo de una cuenta sin permisos; búsqueda en TMDB y en las listas; añadir títulos; edición de estados, favoritos, valoraciones y notas desde la ficha; creación, renombrado y borrado de listas; añadir y quitar títulos de listas personalizadas; filtros; marcar/desmarcar episodios, temporadas y series completas; progreso y estados automáticos; estadísticas; navegación de vuelta desde las fichas y comportamiento de la caché PWA sin conexión.

## Pendiente para una segunda versión

Cola completa de sincronización IndexedDB para cambios offline, ampliación de las estadísticas actuales, notificaciones de nueva versión y pruebas automatizadas end-to-end.
