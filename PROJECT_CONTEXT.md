# PROJECT_CONTEXT

Ultima actualizacion: 2026-06-30

## Resumen

`Webs` es un repositorio multipagina publicado con GitHub Pages y dominio personalizado. Usa HTML, CSS y JavaScript vanilla, sin sistema de build, `package.json`, framework local ni tests automatizados.

Repositorio:

```text
V:\Proyectos\Git\Webs
```

Rama principal:

```text
main
```

Remoto:

```text
https://github.com/alaraz1921/Webs.git
```

Dominio:

```text
https://www.alaraz1921.com/
```

## Proyectos Dentro Del Repositorio

El repositorio contiene dos proyectos logicamente independientes:

1. `Webs`: portal personal, juegos, zona privada y formulario de contacto.
2. `EvenTin/`: plataforma de eventos con su propia base de datos, autenticacion, Edge Functions y documentacion.

Aunque comparten repositorio y GitHub Pages, no deben compartir tablas, claves ni funciones Supabase.

## Cambios Recientes

### Webs

- Se creo `games.html` como concentrador de juegos. Sus tarjetas muestran iconos decorativos inclinados a la derecha, con el texto por encima para mantener la lectura.
- La portada incluye un enlace directo `PROYECTOS` hacia `proyectos.html`.
- La navegacion principal mantiene el orden `PROYECTOS`, `GAMES` y `CONTACTO`, ademas del icono discreto de acceso privado.
- Se creo `proyectos.html` como concentrador de EvenTin, EvenPic, TRASTER, Guia Abierta y Subastas Solidarias.
- Se creo `coming-soon.html` como pagina compartida para proyectos en desarrollo.
- Las paginas propias de Webs comparten un `title` y una descripcion orientados a proyectos web, eventos y experiencias digitales.
- La portada presenta el mensaje principal de eventos y proyectos, el subtitulo `Nothing Gonna Change My World` y un texto introductorio antes del contacto.
- La portada, `games.html`, `proyectos.html` y `coming-soon.html` usan entradas discretas y pausadas al aparecer en pantalla mediante `assets/js/scroll-reveal.js`, respetando `prefers-reduced-motion`.
- El contacto guarda en `webs_contact_messages` y envia aviso mediante `notify-webs-contact`.
- Bingo, Monitor, Infiltrado, Privado y Games comparten fondo y cabecera visual.
- Infiltrado ofrece modo local compatible con el flujo anterior y modo online multi-dispositivo con anfitrion autenticado e invitados por codigo/token.
- Los juegos vuelven a `games.html`.
- `supabase/.temp/` esta ignorado mediante `.gitignore`.

### EvenTin

- Se amplio a plataforma de eventos completa con paginas publicas, invitaciones por token, invitados y panel privado.
- Se incorporaron gestion de usuarios, restauracion de contrasena, almacenamiento de imagenes y Edge Functions.
- Se refinaron branding, cabeceras, navegacion, vistas admin y experiencia movil.
- El estado operativo detallado se mantiene en `EvenTin/PROJECT_HANDOFF.md`.

## Stack

- HTML multipagina.
- CSS compartido de Webs en `assets/styles.css`.
- JavaScript por pagina en `assets/js/`.
- Tailwind CSS por CDN en ValentinaPlay.
- Google Fonts por CDN.
- Supabase JS por CDN.
- Supabase Auth para zonas privadas.
- Supabase Edge Functions y Resend para avisos por email.
- `localStorage` para persistencia de juegos.

No existen:

- Sistema de build.
- Gestor de paquetes local.
- Linter o formatter configurado.
- Tests automatizados.

## Estructura Principal

```text
.
|-- index.html
|-- games.html
|-- proyectos.html
|-- coming-soon.html
|-- 404.html
|-- CNAME
|-- .gitignore
|-- PROJECT_CONTEXT.md
|-- TODO.md
|-- assets/
|   |-- styles.css
|   |-- supabase-client.js
|   |-- private-auth.js
|   `-- js/
|-- images/
|   `-- IMG_1914.jpg
|-- Privado/
|   |-- index.html
|   `-- usuarios.html
|-- Bingo/
|   |-- carton.html
|   `-- monitor.html
|-- infiltrado/
|   `-- index.html
|-- ValentinaPlay/
|-- supabase/
|   |-- README.md
|   |-- migrations/
|   `-- functions/
|       |-- notify-webs-contact/
|       `-- notify-new-user/
`-- EvenTin/
    |-- index.html
    |-- evento.html
    |-- invitacion.html
    |-- invitados.html
    |-- admin.html
    |-- reset-password.html
    |-- debug.html
    |-- README.md
    |-- PROJECT_HANDOFF.md
    |-- MANUAL_USUARIO.md
    |-- css/
    |-- js/
    |-- sql/schema.sql
    |-- assets/
    `-- supabase/functions/
```

## Webs

### Portada `index.html`

Responsabilidades actuales:

- Navbar responsive con enlaces directos a Proyectos, `games.html` y la seccion de contacto.
- Hero con `images/IMG_1914.jpg`.
- H1 editorial, subtitulo y presentacion de alaraz1921 antes del formulario.
- Acceso discreto a `Privado/` mediante icono inferior.
- Formulario de contacto real.
- Proteccion anti-spam previa al envio mediante honeypot, tiempo minimo de 5 segundos y validaciones de contenido.

El formulario:

- Usa `assets/supabase-client.js`.
- Guarda mensajes en `public.webs_contact_messages`.
- Invoca la Edge Function `notify-webs-contact`.
- La funcion envia aviso por email mediante Resend.
- Si falla el email, el mensaje puede seguir quedando guardado en Supabase.
- Las validaciones anti-spam se ejecutan antes de insertar en Supabase o invocar la Edge Function, sin modificar el payload enviado.

### `games.html`

Concentrador de juegos:

- Valentina's Play Time.
- Bingo.
- Infiltrado.
- EscapeTin.

Las tarjetas incluyen iconos decorativos inclinados a la derecha, con cajas compactas de altura cercana al icono y el texto en una capa superior para mantener la lectura aunque el icono sobresalga.

- Incluye un icono de usuario con inicio de sesion por alias o correo, registro, restauracion de contraseña desde el login y cierre de sesion.
- Monitor Bingo e Infiltrado enlazan desde sus accesos a la restauracion y al nuevo registro de Games mediante `?auth=recovery` y `?auth=register`.
- Los controles de acceso de Monitor e Infiltrado mantienen ancho completo, altura tactil estable y separacion uniforme.
- Games, Monitor Bingo e Infiltrado permiten iniciar sesion tanto por alias como por correo mediante `resolve_games_login_email(text)`.
- El registro usa Supabase Auth con confirmacion de correo y guarda el nombre visible en los metadatos del usuario. Los nuevos perfiles de Games nacen como `temporal`, con acceso durante 48 horas hasta validacion administrativa.
- Los registros creados desde Games reciben acceso automatico al Monitor de Bingo y a Infiltrado mediante `project_members`, pero el acceso efectivo depende de `profiles.approval_status` y `trial_expires_at`.
- Games, Monitor Bingo e Infiltrado comparten una validacion local de sesion de 24 horas mediante `games_auth_time` y verifican en cada acceso si el perfil esta `validado`, `bloqueado` o `temporal` caducado.
- `profiles.username` guarda alias unicos y la RPC `resolve_games_login_email(text)` permite iniciar sesion por alias.

Los botones de vuelta de Bingo, Monitor e Infiltrado regresan a `games.html` y se ocultan cuando el juego se ejecuta como PWA instalada. Desde `games.html` se vuelve a la portada.

### `proyectos.html`

Concentrador de proyectos y experiencias digitales:

- Incluye boton visible de vuelta a `index.html` bajo el titulo.
- EvenTin enlaza a su pagina publicada.
- EvenPic enlaza temporalmente a `coming-soon.html`.
- Trastero enlaza a `https://www.alaraz1921.com/Trastero` como `TRASTER`.
- Guia Abierta enlaza temporalmente a `coming-soon.html`.
- Subastas Solidarias enlaza temporalmente a `coming-soon.html`.
- EvenTin, TRASTER y Guia Abierta muestran iconos rectos y contenidos dentro de sus tarjetas.

### `coming-soon.html`

Pagina compartida para proyectos todavia no publicados:

- Reutiliza la imagen de fondo y overlay oscuro de Webs.
- Presenta un mensaje central de proyecto en desarrollo.
- Actualmente recibe los enlaces de EvenPic, Guia Abierta y Subasta Solidaria.
- Incluye vuelta a la pagina principal.

### Estilo Compartido

`games.html`, Bingo, Monitor, Infiltrado y Privado comparten:

- Fondo con `images/IMG_1914.jpg` y overlay oscuro.
- Cabecera con `alaraz1921` en rojo `#c72c43` sobre pastilla clara translucida.
- Titulo grande blanco.

Tipografias:

- Montserrat para titulos.
- Manrope para texto general.
- Comic Neue para ValentinaPlay.

### Zona Privada

`Privado/index.html`:

- Login mediante Supabase Auth.
- Usa `profiles`, `app_projects` y `project_members`.
- Solo permite acceso a usuarios con `profiles.role = 'admin'`.
- La gestion de usuarios muestra estado de validacion, caducidad temporal y acciones para validar o bloquear usuarios, con tarjetas responsive que apilan contenido y acciones en movil.
- Muestra acceso a la gestion de usuarios registrados en `Privado/usuarios.html`.
- Se ha eliminado el antiguo apartado Notas.

`Privado/usuarios.html`:

- Requiere sesion de administrador.
- Muestra los usuarios en lista con acciones de editar y borrar.
- Permite buscar usuarios por nombre, alias o email.
- Permite cambiar el rol general de `profiles.role` y los roles por proyecto en una ventana modal.
- Permite crear usuarios nuevos desde un modal, escogiendo rol general, proyecto y rol del proyecto.
- Permite borrar usuarios mediante modal de confirmacion y la RPC `admin_delete_registered_user(uuid)`.
- La creacion de usuarios invoca la Edge Function `admin-create-user`, que valida sesion admin y usa `SUPABASE_SERVICE_ROLE_KEY` solo en el entorno seguro de Supabase.

Roles generales (`profiles.role`):

- `admin`: acceso completo a `Privado/`, gestion de usuarios y operaciones administrativas protegidas por `public.is_admin()`. Tambien puede acceder como administrador a Bingo, Infiltrado y Trastero.
- `member`: rol general intermedio reservado para futuros permisos globales. Actualmente no concede permisos especiales por si mismo; el acceso operativo depende de `project_members`.
- `viewer`: rol general basico por defecto. No accede a `Privado/`; sus permisos dependen de los roles asignados por proyecto.
- `trastero`: rol permitido en `profiles`, pero Trastero valida actualmente `admin` en el frontend. Para dar acceso real a Trastero hoy se usa `admin`, salvo que se ajuste Trastero para aceptar tambien `trastero`.

Roles por proyecto (`project_members.role`):

- `owner`: rol maximo dentro de un proyecto concreto. Se trata como acceso operativo completo; en Bingo permite entrar al Monitor.
- `editor`: rol operativo del proyecto. En Bingo permite entrar al Monitor.
- `viewer`: rol de acceso/consulta del proyecto. En Infiltrado permite acceso al juego; en Bingo no permite entrar al Monitor porque este exige `owner` o `editor`.
- Sin registro en `project_members`: sin acceso a ese proyecto.

Asignaciones habituales:

- Usuario normal de juegos: `profiles.role = 'viewer'`.
- Monitor Bingo: proyecto `bingo` con rol `editor` u `owner`.
- Infiltrado: proyecto `infiltrado` con rol `viewer`, `editor` u `owner` segun el nivel operativo deseado.
- Administracion global: `profiles.role = 'admin'`.

### Trastero

`Trastero/` es una aplicacion privada mobile-first para gestionar carpetas anidadas, items y fotos:

- Acceso exclusivo para usuarios autenticados con rol `admin`.
- Cada usuario solo puede gestionar sus propios registros mediante RLS y validaciones de relaciones.
- La jerarquia funcional es libre: carpeta raiz, subcarpetas ilimitadas e items finales.
- La navegacion usa `index.html?folder=` e `index.html?item=` con vuelta al padre.
- Incluye busqueda global, CRUD completo, creacion contextual, arbol de carpetas, movimiento y fotos comprimidas antes de subir.
- Las pantallas antiguas de zonas/cajas/objetos redirigen a `index.html`.
- Las fichas de item siguen una estructura visual móvil con foto destacada y accion de mover.
- Las fotos pueden marcarse como portada para listados y fichas.
- El bucket privado `trastero-fotos` usa carpetas por usuario y URLs firmadas.
- SQL operativo: `supabase/migrations/20260617090000_trastero_carpetas_items.sql`.

### Bingo

`Bingo/carton.html`:

- Genera carton 3x9 con 15 numeros.
- Es publico y no requiere login.
- Permite seleccionar una partida existente por id de 3 cifras.
- Muestra `Id Partida: ---` cuando no existe una partida seleccionada.
- Persiste carton, tachados e id seleccionado en `localStorage`.
- Permite cambiar carton sin id o mientras la partida seleccionada no este iniciada.
- Consulta `bingo_partidas.iniciada` antes de marcar numeros o cambiar carton.
- Volver a Games y limpiar usan confirmacion.

Claves principales:

```text
bingo_perm_matrizCarton
bingo_perm_tachados
bingo_partida_id
```

`Bingo/monitor.html`:

- Requiere Supabase Auth y acceso al proyecto `bingo`.
- Acepta el nombre de usuario o correo de cualquier usuario autorizado creado en Supabase.
- Siempre valida la contraseña real configurada en Supabase Auth; no existen accesos demo especiales.
- El rol `admin` y los miembros `owner` o `editor` del proyecto pueden gestionarlo.
- La validacion propia del Monitor caduca a las 24 horas y obliga a introducir de nuevo usuario y clave.
- El acceso iniciado desde `games.html` tambien permite entrar al Monitor durante esas 24 horas.
- Crea partidas, inicia el bloqueo de cartones y reinicia una partida conservando su id.
- Persiste los numeros cantados por id de partida en `localStorage`.
- Organiza los controles en dos filas: `Empezar/Reanudar/Pausar` con `Reiniciar`, y `Nuevo Id` con `Ir a Carton`; este ultimo vuelve al carton con confirmacion.

Base de datos y PWA:

- Migracion: `supabase/migrations/20260611120000_bingo_partidas.sql`.
- La migracion es idempotente y puede completar una ejecucion parcial sin borrar `bingo_partidas`.
- Proyecto privado: `app_projects.slug = 'bingo'`.
- Tabla publica de lectura y gestion protegida: `bingo_partidas`.
- Id automatico entre 100 y 999.
- `Bingo/manifest.json`, `Bingo/sw.js` e iconos permiten instalar la PWA `Bingo Alaraz1921`.
- Los iconos PWA usan el nuevo arte colorido de carton y bolas de Bingo proporcionado para Games - Bingo.
- El carton ofrece instalacion PWA desde el panel de botones y desde su menu superior.
- Los controles de instalacion aparecen solo cuando existe instalacion nativa disponible o en iOS, y se ocultan tras instalar.
- En modo PWA se ocultan los controles de vuelta a `games.html` tanto en el carton como en el Monitor. La deteccion combina modos de visualizacion instalados y la marca `?pwa=1` del manifiesto.
- La ocultacion de `Volver a Games` se aplica antes de pintar las paginas de Bingo y se revalida al reanudar o cambiar el modo de visualizacion de la PWA.

### Infiltrado

`infiltrado/index.html`:

- Acceso mediante Supabase Auth para administradores y miembros del proyecto `infiltrado`.
- Acepta nombre de usuario o correo y siempre valida la contraseña real configurada en Supabase Auth.
- Tras el login permite elegir entre modo `Sin conexion` y `En linea`; los invitados pueden unirse al modo online sin cuenta.
- La validacion propia de Infiltrado caduca a las 24 horas y obliga a introducir de nuevo usuario y clave.
- El acceso iniciado desde `games.html` tambien permite entrar a Infiltrado durante esas 24 horas.
- Configuracion de jugadores, infiltrados y tipo de palabra, incluyendo `Aleatoria`.
- Sorteo y revelado individual, destacando en amarillo el nombre del jugador de cada turno.
- Resolucion mediante desplegables de participantes.
- Las palabras se cargan desde `infiltrado_palabras`.
- La partida temporal se guarda en `infiltrado_partidas`, sus jugadores en `infiltrado_jugadores` y las palabras ya utilizadas en `infiltrado_palabras_usadas`.
- Las rondas repetidas conservan la misma partida temporal y excluyen palabras anteriores; al reiniciar desde cero se elimina la partida y su historial por cascada y se vuelve a la seleccion de modo `Sin conexion` / `En linea`.
- El modo online reutiliza esas tablas, añade `infiltrado_resultados` y usa RPC seguras para crear, unirse, consultar estado, iniciar, finalizar y eliminar jugadores.
- Al finalizar una ronda online se guarda el resultado y se limpia su historial de palabras usadas.
- Los invitados se identifican mediante `player_token` en `localStorage`; solo reciben su propio rol y no tienen lectura publica directa de las tablas.
- Las identidades online se conservan localmente por codigo de partida para reanudar salas sin crear jugadores duplicados.
- Si el usuario autenticado es el creador de una partida, puede recuperarla por codigo y entrar directamente como anfitrion sin indicar nombre.
- El anfitrion usa Supabase Realtime para cambios de sala y todos los clientes mantienen actualizacion periodica/manual como respaldo.
- Durante una ronda iniciada, las actualizaciones de estado no reconstruyen la pantalla de rol para no cerrar los desplegables del anfitrion.
- El anfitrion resuelve la ronda desde la tarjeta de rol: un fallo mantiene la partida iniciada para volver a intentarlo y un acierto muestra confirmacion antes de regresar a la lista de jugadores.
- En el flujo online, el anfitrion dispone de `Terminar partida` solo en la lista de jugadores; los invitados pueden `Abandonar partida` desde la tarjeta de rol y reciben directamente el formulario para introducir otro codigo.
- Antes de pedir el nombre de un nuevo invitado se valida que el codigo corresponda a una partida disponible.
- Al terminar una ronda, los jugadores reciben un modal con el resultado antes de volver a la lista abierta; el anfitrion tambien puede terminarla sin resolver.
- En la lista abierta y la tarjeta de rol, Ayuda y Actualizar se muestran como iconos contextuales sobre el acceso a Games.
- La PWA `Infiltrado Alaraz1921` usa manifest, service worker y el nuevo arte colorido de jugadores e infiltrado proporcionado para Games - Infiltrado.
- El boton de instalacion aparece solo despues del login y muestra instrucciones especificas en iOS.
- En modo PWA se ocultan los controles de vuelta a `games.html`. La deteccion combina modos de visualizacion instalados y la marca `?pwa=1` del manifiesto.
- La ocultacion de `Volver a Games` se aplica antes de pintar la pagina y se revalida al reanudar o cambiar el modo de visualizacion de la PWA.

### ValentinaPlay

Juegos educativos/infantiles:

- Tres en raya.
- Conecta cuatro.
- Secuencia numerica.
- Caza de multiplicaciones.
- Adivinar numero.
- Reloj.

Usan Comic Neue y Tailwind CSS por CDN. La logica principal esta separada en `assets/js/valentina-*.js`.

### Pagina 404

`404.html` usa el estilo visual general, ofrece vuelta a portada y contacto.

## Supabase De Webs

Proyecto:

```text
Project ref: nxuqkvuvmllqihaefjky
URL: https://nxuqkvuvmllqihaefjky.supabase.co
```

Configuracion publica:

```text
assets/supabase-client.js
```

Tablas usadas:

- `profiles`
- `app_projects`
- `project_members`
- `webs_contact_messages`
- `bingo_partidas`
- `infiltrado_palabras`
- `infiltrado_partidas`
- `infiltrado_jugadores`
- `infiltrado_palabras_usadas`
- `infiltrado_resultados`
- `trastero_carpetas`
- `trastero_items`
- `trastero_fotos`

Funciones/RPC:

- `validate_daily_access_code(text, text)`
- `get_daily_access_formula_note()`
- `infiltrado_online_create(text)`
- `infiltrado_online_join(text, text)`
- `infiltrado_online_state(text, text)`
- `infiltrado_online_start(uuid, text, integer, text)`
- `infiltrado_online_finish(uuid, text, bigint, bigint)`
- `infiltrado_online_remove_player(uuid, text, bigint)`
- `infiltrado_online_resume_host(text)`
- `infiltrado_online_leave(uuid, text)`
- `infiltrado_online_exists(text)`
- `infiltrado_online_end_round(uuid, text)`

Edge Function:

- `notify-webs-contact`
- `notify-new-user`: recibe asincronamente altas de `auth.users` y avisa al administrador mediante Resend.
- `admin-create-user`: crea usuarios de Supabase Auth desde `Privado/usuarios.html` y asigna perfil/proyecto tras verificar que el solicitante es admin.

Migraciones:

- `20260601110000_initial_private_schema.sql`
- `20260601113000_daily_access_codes.sql`
- `20260601143000_enable_infiltrado_access_code.sql`
- `20260604120000_webs_contact_messages.sql`
- `20260611120000_bingo_partidas.sql`
- `20260611150000_infiltrado_supabase.sql`
- `20260612100000_games_self_registration.sql`
- `20260612120000_games_username_password_recovery.sql`
- `20260612150000_notify_new_user.sql`
- `20260615120000_infiltrado_palabras_usadas.sql`
- `20260615150000_infiltrado_online.sql`
- `20260615170000_infiltrado_online_resume.sql`
- `20260615190000_infiltrado_online_retry_resolution.sql`
- `20260615200000_infiltrado_online_leave.sql`
- `20260615210000_infiltrado_online_round_flow.sql`
- `20260616090000_trastero.sql`
- `20260616110000_trastero_thumbnails.sql`
- `20260616130000_trastero_espacios.sql`
- `20260616150000_trastero_foto_principal.sql`
- `20260617090000_trastero_carpetas_items.sql`

Configuracion manual necesaria para el registro de Games:

- Activar `Confirm email` en Supabase Auth.
- Permitir `https://www.alaraz1921.com/games.html` como URL de redireccion.
- Permitir `https://www.alaraz1921.com/games.html?recovery=1` como URL de redireccion.
- Ejecutar `20260612100000_games_self_registration.sql`.
- Ejecutar `20260612120000_games_username_password_recovery.sql`.

No usar tablas `eventin_*` en este proyecto Supabase. Son restos candidatos a borrar si existen y estan vacios.

## EvenTin

EvenTin funciona como proyecto independiente dentro de `EvenTin/`.

Supabase:

```text
Project ref: tmnavlsptjhhdlypgtaa
URL: https://tmnavlsptjhhdlypgtaa.supabase.co
```

Documentacion operativa detallada:

- `EvenTin/PROJECT_HANDOFF.md`
- `EvenTin/MANUAL_USUARIO.md`
- `EvenTin/README.md`

Funcionalidades principales:

- Portada de servicio y acceso a eventos por codigo.
- Pagina publica por codigo o slug.
- Invitaciones genericas e individuales por token.
- Gestion privada de invitados.
- Panel admin para eventos, usuarios, respuestas, mensajes y contactos.
- Restauracion de contrasena.
- Subida/optimizacion de imagenes.
- Email de contacto mediante `notify-contact`.
- Alta segura de usuarios mediante `create-event-user`.
- PWA instalable con `manifest.json`, `sw.js`, iconos propios y enlace de instalacion en el pie del panel administrador. Al abrirse instalada, arranca directamente en `EvenTin/admin.html`.

Tablas principales:

- `eventin_event_types`
- `eventin_events`
- `eventin_event_settings`
- `eventin_profiles`
- `eventin_guests`
- `eventin_guest_responses`
- `eventin_public_messages`
- `eventin_contact_requests`

El esquema actual esta en:

```text
EvenTin/sql/schema.sql
```

## Navegacion Actual

```text
index.html
|-- proyectos.html
|   |-- EvenTin
|   |-- EvenPic -> coming-soon.html
|   |-- TRASTER -> Trastero/
|   |-- Guia Abierta -> coming-soon.html
|   `-- Subastas Solidarias -> coming-soon.html
|-- games.html
|   |-- ValentinaPlay/
|   |-- Bingo/carton.html
|   |   `-- Bingo/monitor.html
|   `-- infiltrado/
|-- Privado/
`-- contacto en la propia portada
```

## Flujo De Trabajo

Tras cada cambio solicitado en Webs:

1. Implementar y validar los cambios.
2. Actualizar `PROJECT_CONTEXT.md` y `TODO.md` cuando el estado del proyecto cambie.
3. Crear un commit con los archivos relacionados.
4. Subir el commit a GitHub.

EvenTin se publica en:

```text
https://www.alaraz1921.com/EvenTin/
```

## Ejecucion Local

Puede abrirse directamente, pero se recomienda servidor local:

```powershell
cd V:\Proyectos\Git\Webs
python -m http.server 8000
```

Abrir:

```text
http://localhost:8000/
```

## Estado De Calidad

Fortalezas:

- Arquitectura estatica simple y facil de desplegar.
- Webs y EvenTin separados logicamente y en Supabase.
- RLS y Edge Functions para operaciones sensibles.
- JavaScript mayoritariamente separado por pagina.
- Navegacion y estilo visual mas consistentes.
- Formularios de contacto persistentes con aviso por email.

Riesgos y deuda:

- `assets/styles.css` es grande y mezcla muchos dominios.
- Dependencia de CDN para fuentes, Tailwind y Supabase JS.
- No hay tests automatizados.
- Las migraciones de Bingo, Infiltrado y registro compartido de Games deben aplicarse manualmente en Supabase.
- La zona privada de Webs aun no lista proyectos reales.
- Quedan comentarios/textos mojibake en algunas partes de CSS/documentacion.
- Las Edge Functions y secretos deben configurarse manualmente en Supabase.

## Convenciones

- HTML independiente por pagina.
- Clases de `body` para aislar estilos.
- Nombres de funciones y variables principalmente en espanol.
- Navegacion relativa.
- Estado local con prefijos por funcionalidad.
- No guardar `service_role`, tokens Supabase ni API keys privadas en GitHub.

## Validacion Habitual

```powershell
node --check RUTA_DEL_JS
git -C V:\Proyectos\Git\Webs diff --check
git -C V:\Proyectos\Git\Webs status --short
```

La automatizacion del navegador integrado de Codex falla actualmente en este entorno Windows. No se intenta por defecto; las comprobaciones visuales se hacen manualmente cuando son necesarias.
