# PROJECT_CONTEXT

Ultima actualizacion: 2026-06-08

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

- Se creo `games.html` como concentrador de juegos.
- La portada incluye un enlace directo `PROYECTOS` hacia `proyectos.html`.
- La navegacion principal mantiene el orden `PROYECTOS`, `GAMES` y `CONTACTO`, ademas del icono discreto de acceso privado.
- Se creo `proyectos.html` como concentrador de EvenTin, EvenPic y Subastas Solidarias.
- Se creo `coming-soon.html` como pagina compartida para proyectos en desarrollo.
- Las paginas propias de Webs comparten un `title` y una descripcion orientados a proyectos web, eventos y experiencias digitales.
- La portada presenta el mensaje principal de eventos y proyectos, el subtitulo `Nothing Gonna Change My World` y un texto introductorio antes del contacto.
- El contacto guarda en `webs_contact_messages` y envia aviso mediante `notify-webs-contact`.
- Bingo, Monitor, Infiltrado, Privado y Games comparten fondo y cabecera visual.
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
|   `-- index.html
|-- Bingo/
|   |-- carton.html
|   `-- monitor.html
|-- infiltrado/
|   `-- index.html
|-- ValentinaPlay/
|-- supabase/
|   |-- README.md
|   |-- migrations/
|   `-- functions/notify-webs-contact/
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

El formulario:

- Usa `assets/supabase-client.js`.
- Guarda mensajes en `public.webs_contact_messages`.
- Invoca la Edge Function `notify-webs-contact`.
- La funcion envia aviso por email mediante Resend.
- Si falla el email, el mensaje puede seguir quedando guardado en Supabase.

### `games.html`

Concentrador de juegos:

- Valentina's Play Time.
- Bingo.
- Infiltrado.

Los botones de vuelta de Bingo, Monitor e Infiltrado regresan a `games.html`. Desde `games.html` se vuelve a la portada.

### `proyectos.html`

Concentrador de proyectos y experiencias digitales:

- EvenTin enlaza a su pagina publicada.
- EvenPic enlaza temporalmente a `coming-soon.html`.
- Subastas Solidarias enlaza temporalmente a `coming-soon.html`.

### `coming-soon.html`

Pagina compartida para proyectos todavia no publicados:

- Reutiliza la imagen de fondo y overlay oscuro de Webs.
- Presenta un mensaje central de proyecto en desarrollo.
- Actualmente recibe los enlaces de EvenPic y Subasta Solidaria.
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
- Muestra recordatorio de formula de claves diarias.
- Todavia no carga la lista real de proyectos accesibles.

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
- Acepta el alias `demobingo` o el email del usuario administrador.
- El rol `admin` y los miembros `owner` o `editor` del proyecto pueden gestionarlo.
- Crea partidas, inicia el bloqueo de cartones y reinicia una partida conservando su id.
- Persiste los numeros cantados por id de partida en `localStorage`.

Base de datos y PWA:

- Migracion: `supabase/migrations/20260611120000_bingo_partidas.sql`.
- La migracion es idempotente y puede completar una ejecucion parcial sin borrar `bingo_partidas`.
- Proyecto privado: `app_projects.slug = 'bingo'`.
- Tabla publica de lectura y gestion protegida: `bingo_partidas`.
- Id automatico entre 100 y 999.
- `Bingo/manifest.json`, `Bingo/sw.js` e iconos permiten instalar Bingo como PWA.

### Infiltrado

`infiltrado/index.html`:

- Acceso mediante clave diaria validada por RPC.
- Configuracion de jugadores e infiltrados.
- Sorteo y revelado individual.
- Resolucion mediante desplegables de participantes.
- Persistencia con claves `infiltrado_*`.
- Sesion aproximada de 5 horas.
- Reinicio selectivo sin borrar datos de otros juegos.

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

Funciones/RPC:

- `validate_daily_access_code(text, text)`
- `get_daily_access_formula_note()`

Edge Function:

- `notify-webs-contact`

Migraciones:

- `20260601110000_initial_private_schema.sql`
- `20260601113000_daily_access_codes.sql`
- `20260601143000_enable_infiltrado_access_code.sql`
- `20260604120000_webs_contact_messages.sql`

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
- La migracion de Bingo y el usuario `demobingo` deben configurarse manualmente en Supabase antes de usar el monitor.
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
