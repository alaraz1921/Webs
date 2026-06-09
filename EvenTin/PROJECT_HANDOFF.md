# EvenTin Project Handoff

Ultima actualizacion: 2026-06-09

## Resumen

EvenTin es un proyecto estatico dentro del repositorio `Webs`, pero funciona como proyecto independiente. Esta publicado dentro de:

```text
https://alaraz1921.com/EvenTin/
https://alaraz1921.github.io/Webs/EvenTin/
```

El repositorio sigue siendo unico:

```text
V:\Proyectos\Git\Webs
```

Rama principal:

```text
main
```

Supabase de EvenTin es independiente del Supabase privado de `Webs`.

## Supabase

Proyecto Supabase EvenTin:

```text
Project ref: tmnavlsptjhhdlypgtaa
Project URL: https://tmnavlsptjhhdlypgtaa.supabase.co
```

La configuracion publica esta en:

```text
EvenTin/js/config.js
```

No guardar nunca:

- `service_role key`
- API keys privadas de Resend
- Access tokens de Supabase

## Estructura Principal

```text
EvenTin/
|-- index.html
|-- contacto.html
|-- evento.html
|-- invitacion.html
|-- invitados.html
|-- debug.html
|-- admin.html
|-- reset-password.html
|-- README.md
|-- PROJECT_HANDOFF.md
|-- MANUAL_USUARIO.md
|-- css/style.css
|-- js/
|   |-- admin.js
|   |-- config.js
|   |-- countdown.js
|   |-- contact.js
|   |-- guests.js
|   |-- home.js
|   |-- invitation.js
|   |-- messages.js
|   |-- password-reset.js
|   `-- supabaseClient.js
|-- sql/schema.sql
|-- assets/images/
`-- supabase/functions/
    |-- notify-contact/index.ts
    `-- create-event-user/index.ts
```

## Paginas

- `index.html`: portada de EvenTin, dividida en siete secciones comerciales y con acceso por codigo de evento.
- `contacto.html`: formulario publico independiente para solicitar informacion o crear un evento.
- `evento.html?evento=CODIGO_O_SLUG`: pagina publica de evento.
- `invitacion.html?evento=CODIGO_O_SLUG`: formulario publico legacy de confirmacion de asistencia. Muestra logo, `eventin_events.title` y fecha/hora real de `eventin_events.event_date`.
- `invitacion.html?token=TOKEN`: invitacion individual por invitado. No usa telefono en URL.
- `invitados.html?evento=EVENT_ID`: gestion privada de invitados del evento seleccionado.
- `debug.html`: pagina no enlazada con accesos rapidos a portada, admin, eventos e invitaciones de prueba.
- `admin.html`: panel privado con login Supabase Auth.
- `reset-password.html`: restauracion de clave mediante email de Supabase Auth.
- Todas las pantallas HTML salvo la portada usan el mismo pie de `evento.html`: `Creado con ♥ por alaraz1921` y `Descubre más en EvenTin`.
- `index.html` muestra solo `Creado con ♥ por alaraz1921`, enlazado a `https://www.alaraz1921.com/proyectos.html`.

## Roles

EvenTin usa dos roles en `eventin_profiles`:

- `admin`: administra todos los eventos, usuarios, respuestas, mensajes y contactos.
- `user`: usuario de evento. Solo accede al evento cuyo `event_code` coincide con su perfil.

Relacion usuario-evento:

```text
eventin_profiles.event_code = eventin_events.event_code
```

El codigo numerico de evento tiene 6 digitos, se genera automaticamente al crear evento y es de solo lectura en el panel.

## Cambios del 2026-06-09

- El email del usuario mostrado en la cabecera administrativa usa el color oscuro de titulo para mantener contraste.
- Los inserts del evento demo y sus ajustes en `schema.sql` usan `on conflict do nothing`: el esquema crea el demo si falta, pero ya no sobrescribe los cambios realizados desde administracion.
- Se corrigio la posicion del acceso por ID en la portada de escritorio para que permanezca dentro de la banda superior.
- Se reconstruyo la portada en siete secciones: presentacion, ventajas, estilos, demo, llamada a la accion, tipos de evento y cierre de contacto.
- Se incorporaron miniaturas propias para la presentacion, los cuatro estilos y el evento demo.
- Las miniaturas de la presentacion y de estilos usan PNG con fondo exterior transparente.
- La presentacion muestra cuatro funciones con iconos: Celebra, Comparte, Disfruta y Recuerda.
- Los tipos de evento usan iconos propios para comuniones, bodas, bautizos y otros eventos.
- La imagen del evento demo se muestra completa en escritorio sin recorte vertical.
- La cuarta muestra visual se presenta como `Personalizado`, aunque mantiene internamente la paleta `clasica`.
- La sección de ventajas destaca el envío de invitaciones digitales por WhatsApp o email.
- La segunda seccion muestra como titulo visible la frase SEO `Invitaciones digitales para comuniones, bodas y celebraciones`.
- Los iconos de tipos de evento se muestran grandes y sin circulo exterior, con nombres mas destacados.
- Las pastillas de estado de invitados en movil usan texto oscuro para mejorar su contraste.
- El formulario de contacto se movio a `contacto.html`; los botones de contacto y `Crear mi evento` enlazan a esa pagina.
- Los botones de evento demo enlazan a `evento.html?evento=primera-comunion-demo`.

## Cambios del 2026-06-08

Resumen:

- La portada tiene una banda superior fija con icono de inicio de sesion a la izquierda y acceso por codigo de evento a la derecha.
- La banda superior de portada es compacta y termina pocos pixeles por debajo de sus controles.
- La pagina publica del evento sustituye la pastilla `Admin` por el mismo icono de inicio de sesion.
- La pagina publica del evento muestra una cabecera transparente con logo EvenTin enlazado a portada a la izquierda e icono de inicio de sesion a la derecha.
- El pie de la pagina publica del evento muestra `Creado con ♥ por alaraz1921` y, debajo, `Descubre más en EvenTin`, ambos enlazados a la portada.
- Se unifico ese mismo pie en los HTML de EvenTin; la portada conserva solo el credito enlazado a la pagina general de proyectos.
- La pagina `reset-password.html` incorpora la cabecera con logo de EvenTin e icono de acceso.
- La configuracion de imagen principal y detalle muestra una papelera cuando existe una imagen. El borrado usa modal, limpia Storage y hace que la pagina vuelva a usar la imagen predeterminada.
- La portada incluye title, descripcion, metadatos Open Graph, un `h1` accesible orientado a busquedas y la imagen social `assets/images/og-image.jpg`.
- Se ajusto el control `datetime-local` del formulario de evento para evitar que Safari/iOS lo muestre mas ancho que el resto de campos.
- Se sustituyeron las paletas antiguas por `Clasica`, `Dulce`, `Brisa` y `Natura`. `Clasica` es el valor predeterminado y la base visual de administracion; el esquema convierte a `clasica` cualquier valor antiguo.
- Tras el cambio de paletas hay que ejecutar `EvenTin/sql/schema.sql` completo en Supabase para actualizar eventos existentes, el valor predeterminado y la restriccion de valores permitidos.
- El panel privado muestra el logo EvenTin tambien antes de iniciar sesion.
- El logo de la pantalla de inicio de sesion usa un tamano contenido para no desplazar el formulario.
- Los logos del acceso privado, cabecera del admin y gestion de invitados enlazan a la portada de EvenTin.
- La cabecera del panel admin queda fija durante el desplazamiento, con logo a la izquierda e icono de sesion a la derecha.
- El icono de sesion del admin abre un menu contextual con `Cerrar sesion`.
- Tanto el menu contextual como el enlace de texto del final solicitan confirmacion mediante modal antes de cerrar sesion.
- Los botones para copiar los enlaces publico y de invitacion usan icono de copiar.
- Se ajusto el control de fecha y hora para que no sobresalga respecto al resto de campos.
- La pagina de invitacion muestra la imagen de detalle entre el titulo del evento y el bloque de confirmacion.
- La RPC `eventin_get_guest_invitation(text)` devuelve tambien `settings.detail_image_url` para mostrar la imagen en invitaciones individuales por token.
- Tras estos cambios hay que ejecutar de nuevo `EvenTin/sql/schema.sql` completo en Supabase.

## Cambios del 2026-06-05

Commits relevantes del dia:

```text
be51789 Improve EvenTin admin event controls
556e26c Improve EvenTin event image framing on desktop
cf6b668 Use modals for EvenTin response admin actions
a4109c0 Open EvenTin debug links in new tabs
e6b9624 Add paged admin views for EvenTin responses and messages
802d7d5 Render EvenTin public messages as admin tables
a80c05f Add EvenTin guest invitation management
26225df Move EvenTin guest management to dedicated page
604d6cc Update EvenTin event footer credit
d1087a5 Refine EvenTin guest mobile view and generic responses
cb753ae Improve EvenTin admin list navigation
4fd79e1 Keep EvenTin admin event title visible
b314595 Fix EvenTin admin list views
bde7e93 Align EvenTin guest action icons
```

Resumen:

- Se ajusto el hero y la imagen de detalle para que en escritorio grande se vea mas imagen completa sin deformarla.
- Se anadieron vistas dedicadas en admin para `Respuestas Invitaciones` y `Mensajes publicos`, con carga incremental tipo `Cargar mas`.
- Las respuestas del panel permiten editar solo la asistencia y borrar mediante modal.
- Los mensajes publicos se listan por lineas y ya no tienen edicion.
- `debug.html` abre enlaces en pestana nueva.
- Se inicio la gestion de invitados con tabla `eventin_guests`, tokens individuales y enlaces `invitacion.html?token=TOKEN`.
- El panel admin enlaza a `invitados.html`, donde se puede crear, editar, borrar, copiar mensaje de invitacion y abrir WhatsApp para cada invitado.
- Alta, edicion y borrado de invitados se hacen mediante modales. Las acciones usan botones compactos de icono.
- La invitacion por token muestra saludo personalizado, marca apertura y guarda confirmacion/rechazo contra el invitado.
- Si una invitacion por token no tiene telefono en la ficha del invitado, la respuesta se guarda sin telefono.
- La invitacion generica intenta localizar invitado por telefono; si no existe, lo crea y vincula la respuesta.
- Si la invitacion generica localiza un invitado por telefono, no actualiza su nombre ni telefono; solo asistencia, adultos, ninos, estado y mensaje/respuesta.
- La gestion de invitados quedo en `invitados.html` con login propio de respaldo, filtro por nombre/telefono, orden por nombre/telefono/estado y paginacion de 10 invitados.
- En escritorio y movil se ajustaron las acciones de invitados como iconos compactos alineados: editar, copiar invitacion, WhatsApp y borrar.
- Las vistas completas de respuestas y mensajes publicos muestran estados de carga/error/no hay datos dentro de la tabla para evitar pantallas vacias.
- En respuestas y mensajes publicos las acciones usan iconos; editar respuesta solo cambia asistencia y borrar siempre usa modal de confirmacion.
- El titulo del evento activo (`event-user-title`) queda visible en el panel general tambien para admin.
- La optimizacion de imagenes del panel conserva el archivo original si ya pesa 500 KB o menos y es JPEG/PNG/WebP. Si necesita optimizar, prueba WebP y despues JPEG, porque algunos navegadores moviles no codifican WebP de forma fiable desde canvas. Busca primero un resultado de 500 KB o menos y solo usa el limite de 2.5 MB como fallback tecnico.
- Al subir una nueva imagen principal o de detalle, se borran las variantes antiguas del mismo nombre base con otras extensiones (`hero.webp`, `hero.jpg`, `hero.png`, etc.) para no ocupar espacio innecesario en Storage.
- Tras estos cambios hay que ejecutar de nuevo `EvenTin/sql/schema.sql` completo en Supabase.

## Cambios del 2026-06-04

Commits relevantes del dia:

```text
a9984d6 Add EvenTin password reset flow
047fc41 Update EvenTin event default copy and typography
4b54f01 Adjust EvenTin mobile layout and debug links
5eab85d Update EvenTin event admin header
5a7612d Fix EvenTin admin mobile header typography
75cf7ce Update EvenTin admin event link actions
f2e8a16 Respect empty event fields and update invitation header
0761067 Fix EvenTin invitation event header details
5285309 Use event title on EvenTin invitation page
```

Resumen:

- Se anadio el flujo de restauracion de clave en `reset-password.html` y `js/password-reset.js`.
- Se ajustaron tipografias de la pagina de evento: `Rouge Script` para titulos principales y `Caveat` para textos/titulos de presentacion y bloques solicitados.
- Se eliminaron eyebrows innecesarios en `evento.html` y se cambio el bloque de detalles a `Informacion del evento`.
- Se definieron textos por defecto al crear eventos nuevos: subtitulo, titulo de presentacion y texto de presentacion.
- Se creo `debug.html` con enlaces directos a portada, admin, eventos e invitaciones de prueba. No esta enlazado desde la web.
- Se actualizo el header del panel admin: logo transparente, email del usuario logado y titulo `Administracion de evento`.
- En usuarios de evento se oculta el selector de eventos y se muestra el nombre del evento con `Rouge Script`.
- Se movio el boton `Salir` al final del panel.
- Se sustituyo el boton grande `Ir a la pagina del evento` por botones `Ir` y `Copiar` junto a `Enlace publico` y `Enlace invitacion`.
- Se anadio `main_title` en `eventin_event_settings` como titulo principal configurable para la pagina publica del evento.
- Se cambio la logica de fallback para respetar campos vacios guardados por el administrador. Solo se usa fallback cuando el valor es `null` o `undefined`.
- La pagina de invitacion ahora muestra cabecera con logo, `eventin_events.title`, y fecha/hora real de `eventin_events.event_date`.
- El titulo de la invitacion respeta mayusculas/minusculas tal como esta guardado.
- Despues de estos cambios hay que ejecutar de nuevo `EvenTin/sql/schema.sql` completo en Supabase por la columna `main_title`.

## Cambios del 2026-06-03

Commits relevantes de cierre de dia:

```text
07fc2b6 Add secure EvenTin event user creation
c141177 Fix EvenTin storage image upload policies
8cad01c Use storage helper for EvenTin image policies
```

Resumen:

- Se sustituyo el alta de usuarios Auth desde frontend (`auth.signUp`) por la Edge Function `create-event-user`.
- Ya no es necesario permitir registros publicos en Supabase para crear usuarios de evento desde el panel.
- Se ajustaron las policies de Storage para subir imagenes al bucket `eventin-images`.
- Se creo la funcion publica `public.eventin_can_manage_event_image(text)` como helper `SECURITY DEFINER` para que Storage pueda validar si el usuario autenticado puede gestionar imagenes de `events/<event_code>/...`.
- Se anadio policy `select` sobre `storage.objects` para usuarios autenticados autorizados, porque la subida con `upsert: true` puede necesitar lectura del objeto existente ademas de `insert/update`.
- Despues de estos cambios hay que ejecutar de nuevo `EvenTin/sql/schema.sql` completo en Supabase.

## Base de Datos

Archivo principal:

```text
EvenTin/sql/schema.sql
```

Tablas principales:

- `public.eventin_event_types`
- `public.eventin_events`
- `public.eventin_event_settings`
- `public.eventin_profiles`
- `public.eventin_guests`
- `public.eventin_guest_responses`
- `public.eventin_public_messages`
- `public.eventin_contact_requests`

Esquema privado:

```text
eventin_private
```

Funciones internas sensibles se movieron a `eventin_private` para que no queden expuestas como RPC publicas:

- `eventin_private.is_admin()`
- `eventin_private.can_access_event(uuid)`
- `eventin_private.can_access_event_code(text)`
- `eventin_private.generate_event_code()`
- `eventin_private.submit_guest_response(...)`

RPC publica conservada para la invitacion:

```text
public.eventin_submit_guest_response(...)
```

Esta RPC es `SECURITY INVOKER`; llama internamente a `eventin_private.submit_guest_response(...)`.

RPC publicas para invitacion individual por token:

```text
public.eventin_get_guest_invitation(text)
public.eventin_submit_guest_token_response(text, boolean, integer, integer, text)
```

Son `SECURITY DEFINER` de forma intencionada para permitir el flujo publico por token sin exponer la tabla completa. Devuelven solo datos minimos del invitado y validan que el evento este activo.

### Invitados

`public.eventin_guests` contiene:

- `event_id`, `name`, `phone`, `email`, `adults_count`, `children_count`, `notes`.
- `invitation_token`: token aleatorio unico. Es lo unico que se usa en la URL publica.
- `invitation_status`: `pending`, `opened`, `confirmed`, `declined`.
- `opened_at`, `created_at`, `updated_at`.

`public.eventin_guest_responses` mantiene compatibilidad con respuestas antiguas y ahora tambien puede guardar:

- `guest_id`
- `adults_count`
- `children_count`

El campo `telefono` puede quedar vacio (`null`) cuando la respuesta viene de una invitacion individual por token y el invitado no tenia telefono en su ficha.

Reglas actuales de respuestas:

- Invitacion individual por token: busca el invitado por `invitation_token`, marca `opened_at` si procede y guarda/actualiza una respuesta asociada por `guest_id`.
- Si el invitado por token no tiene telefono, `eventin_guest_responses.telefono` queda `null`.
- Invitacion generica por `evento`: exige nombre y telefono, busca invitado por telefono dentro del evento y crea uno si no existe.
- Si la invitacion generica encuentra invitado, no sobreescribe `name` ni `phone` en `eventin_guests`; actualiza asistencia, adultos, ninos y estado.
- Las respuestas genericas se guardan con el nombre de la ficha del invitado si el telefono coincide con un invitado existente.

### Campos importantes de eventos

`public.eventin_events` contiene el nombre obligatorio y datos estructurales del evento:

- `title`: nombre interno/real del evento. Es obligatorio. En invitacion se muestra este valor.
- `event_date`: fecha/hora real. En invitacion se muestra este valor formateado.
- `location_name`, `maps_url`, `public_slug`, `event_code`, `event_type`.

`public.eventin_event_settings` contiene textos y visuales editables:

- `main_title`: titulo principal visible en `evento.html`. Puede estar vacio si el admin no quiere titulo en la pagina publica.
- `subtitle`, `display_date`, `display_time`, `presentation_title`, `presentation_text`.
- `hero_image_url`, `detail_image_url`, `palette_key`.

Valores por defecto al crear evento desde admin:

```text
main_title = title del evento
subtitle = Un dia para compartir
display_date = ''
display_time = ''
presentation_title = Un recuerdo para siempre
presentation_text = Hay momentos que quedan grabados en el corazon para toda la vida. Nos gustaria celebrarlo contigo y guardar juntos este hermoso recuerdo.
palette_key = clasica
location_name = Por confirmar
maps_url = https://www.google.com/maps
```

`fallbackEvent` en `EvenTin/js/config.js` se usa solo cuando no hay evento real o un campo viene `null/undefined`. Los campos vacios (`''`) se respetan como decision del administrador.

## Storage

Bucket:

```text
eventin-images
```

Es publico para servir imagenes por URL publica.

Rutas usadas:

```text
events/<event_code>/hero.webp
events/<event_code>/hero.jpg
events/<event_code>/hero.png
events/<event_code>/detail.webp
events/<event_code>/detail.jpg
events/<event_code>/detail.png
```

El panel optimiza imagenes en navegador antes de subir:

- Hero: max width 1600 px.
- Detail: max width 1200 px.
- Original max: 12 MB.
- Si el original ya pesa 500 KB o menos y es JPEG/PNG/WebP, se sube sin reprocesarlo.
- Optimizada objetivo: 500 KB o menos.
- Optimizada limite: menos de 2.5 MB.
- Formatos de salida: WebP cuando el navegador lo codifica bien; JPEG como alternativa; PNG solo si se conserva original pequeno.
- Al subir una nueva imagen se limpian las variantes antiguas con otra extension para el mismo `hero` o `detail`.
- Bucket limit: 3 MB.

Se elimino la policy amplia `Public can read event images` porque en buckets publicos no hace falta para acceder por URL y Supabase la marcaba como warning.

Policies actuales:

- `Users can read assigned event images`: permite `select` a usuarios autenticados autorizados.
- `Users can upload assigned event images`: permite `insert`.
- `Users can update assigned event images`: permite `update`.
- `Users can delete assigned event images`: permite `delete`.

Todas validan:

```text
bucket_id = 'eventin-images'
storage.foldername(name)[1] = 'events'
public.eventin_can_manage_event_image(storage.foldername(name)[2])
```

El helper `public.eventin_can_manage_event_image(text)` permite:

- cualquier perfil con `role = 'admin'`;
- perfiles `user` cuyo `event_code` coincida con la carpeta del objeto.

## Panel Admin

El panel `admin.html` tiene:

- Administracion de eventos.
- Administracion de usuarios.
- Mensajes de contacto.

Eventos:

- Crear, editar y borrar eventos.
- Cambiar tipo de evento.
- Ver codigo numerico de 6 digitos en solo lectura.
- Copiar e ir al enlace publico.
- Copiar e ir al enlace de invitacion.
- Subir imagen principal y detalle optimizadas.
- Cambiar paleta del evento.
- Editar `Titulo principal` (`main_title`), subtitulo, fecha/hora visible y textos de presentacion.
- Ver respuestas recibidas.
- Ver mensajes publicos.

Invitados:

- Se gestionan desde `invitados.html`, enlazado desde el panel de eventos.
- Tiene formulario de login propio si no detecta sesion activa.
- Permite crear, editar y borrar invitados mediante modales.
- Permite copiar el mensaje de invitacion individual y abrir WhatsApp si hay telefono.
- La lista se puede filtrar por nombre/telefono, ordenar por nombre/telefono/estado y pagina cada 10 invitados.

Usuarios:

- Crear usuario de evento.
- Editar perfil de usuario de evento.
- Borrar perfil/asignacion.
- El usuario Auth completo se borra desde Supabase si se quiere eliminar el acceso por completo.
- El alta Auth se hace desde la Edge Function `create-event-user`, no con registros publicos de Supabase.
- Si el panel muestra error al crear usuario Auth, comprobar que `create-event-user` esta desplegada en Supabase.

Contactos:

- Ver mensajes enviados desde `contacto.html`.
- Responder por email con `mailto:`.
- Borrar mensajes.

Restaurar clave:

- Desde el login de `admin.html` hay enlace a `reset-password.html`.
- Desde la seccion de usuarios del admin hay enlace a `reset-password.html`.
- Si se esta editando un usuario, el enlace lleva su email precargado.
- La pagina usa `resetPasswordForEmail(email)` para enviar el email y `updateUser({ password })` cuando el usuario abre el enlace de recuperacion.
- En Supabase Auth deben estar permitidas como redirect URLs:
  - `https://alaraz1921.com/EvenTin/reset-password.html`
  - `https://alaraz1921.github.io/Webs/EvenTin/reset-password.html`

## Formulario de Contacto

El formulario de `contacto.html` guarda en:

```text
public.eventin_contact_requests
```

Tambien intenta llamar a la Edge Function:

```text
notify-contact
```

Si falla el email, el mensaje sigue guardado en Supabase.

## Edge Function de Email

Archivo:

```text
EvenTin/supabase/functions/notify-contact/index.ts
```

Proveedor preparado:

```text
Resend
```

Secretos necesarios en Supabase:

```text
RESEND_API_KEY
CONTACT_TO_EMAIL
CONTACT_FROM_EMAIL
```

`CONTACT_FROM_EMAIL` es opcional para pruebas; si no se define, usa:

```text
EvenTin <onboarding@resend.dev>
```

## Edge Function de Usuarios

Archivo:

```text
EvenTin/supabase/functions/create-event-user/index.ts
```

Responsabilidad:

- Verificar que la sesion que llama pertenece a un perfil `admin`.
- Crear el usuario en Supabase Auth con Admin API.
- Crear el perfil `eventin_profiles` con rol `user` y `event_code`.

Usa los secretos automaticos de Supabase Edge Functions:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Deploy:

```powershell
cd V:\Proyectos\Git\Webs\EvenTin
supabase functions deploy create-event-user --project-ref tmnavlsptjhhdlypgtaa
```

Comandos habituales:

```powershell
cd V:\Proyectos\Git\Webs\EvenTin
supabase secrets set RESEND_API_KEY=TU_NUEVA_KEY CONTACT_TO_EMAIL=tu_email@gmail.com --project-ref tmnavlsptjhhdlypgtaa
supabase functions deploy notify-contact --project-ref tmnavlsptjhhdlypgtaa
supabase functions deploy create-event-user --project-ref tmnavlsptjhhdlypgtaa
```

Si no existe `supabase` en PowerShell, instalar Node.js LTS y usar:

```powershell
npx supabase login --token TU_TOKEN_SUPABASE
npx supabase functions deploy notify-contact --project-ref tmnavlsptjhhdlypgtaa
npx supabase functions deploy create-event-user --project-ref tmnavlsptjhhdlypgtaa
```

El warning `Docker is not running` no bloquea el deploy remoto de Edge Functions.

Si `supabase login` falla, crear token manual en:

```text
https://supabase.com/dashboard/account/tokens
```

Y usar:

```powershell
supabase login --token TU_TOKEN_SUPABASE
```

Importante: se pego una API key de Resend en el chat durante la configuracion. Esa key debe estar revocada en Resend y sustituida por una nueva.

## Seguridad Supabase

Warnings resueltos en `schema.sql`:

- `eventin_set_updated_at` sin `search_path`.
- Policy amplia de lectura sobre bucket publico `eventin-images`.
- Funciones `SECURITY DEFINER` expuestas en `public` como RPC.
- Subida de imagenes bloqueada por RLS en Storage: se corrigio con `public.eventin_can_manage_event_image(text)` y policies de `select/insert/update/delete`.

Warning restante de Auth:

```text
Leaked password protection is currently disabled.
```

Se activa desde:

```text
Supabase Dashboard -> Authentication -> Security -> Leaked password protection -> Enable
```

## Comandos de Validacion Usados

```powershell
node --check V:\Proyectos\Git\Webs\EvenTin\js\admin.js
node --check V:\Proyectos\Git\Webs\EvenTin\js\guests.js
node --check V:\Proyectos\Git\Webs\EvenTin\js\home.js
node --check V:\Proyectos\Git\Webs\EvenTin\js\invitation.js
git -C V:\Proyectos\Git\Webs diff --check
git -C V:\Proyectos\Git\Webs status --short
```

No se pudo validar la Edge Function con `deno check` porque Deno no estaba instalado en la maquina.

## Ultimos Commits Importantes

```text
5285309 Use event title on EvenTin invitation page
0761067 Fix EvenTin invitation event header details
f2e8a16 Respect empty event fields and update invitation header
75cf7ce Update EvenTin admin event link actions
5a7612d Fix EvenTin admin mobile header typography
5eab85d Update EvenTin event admin header
4b54f01 Adjust EvenTin mobile layout and debug links
047fc41 Update EvenTin event default copy and typography
a9984d6 Add EvenTin password reset flow
8cad01c Use storage helper for EvenTin image policies
c141177 Fix EvenTin storage image upload policies
07fc2b6 Add secure EvenTin event user creation
fff0dba Add contact admin view and email notification
69cb0d2 Remove broad public storage select policy
730b991 Restrict internal helper function execution
d11bde9 Move EvenTin helper functions to private schema
```

## Tareas Pendientes o A Comprobar

1. Ejecutar siempre el `EvenTin/sql/schema.sql` actualizado en Supabase tras cambios de schema.
2. Activar `Leaked password protection` en Supabase Auth.
3. Confirmar que `create-event-user` esta desplegada y permite crear usuarios desde el panel.
4. Confirmar que `notify-contact` tiene secretos correctos y envia emails.
5. Confirmar que la subida de imagenes funciona tras ejecutar el `schema.sql` actualizado.
6. Probar flujo completo:
   - crear evento;
   - subir imagen principal/detalle;
   - crear usuario de evento;
   - acceder como usuario;
   - enviar invitacion;
   - enviar mensaje publico;
   - enviar contacto desde `contacto.html`;
   - ver contacto en admin y recibir email.
7. Si se quiere enviar desde `contacto@alaraz1921.com`, verificar dominio/remitente en Resend y configurar `CONTACT_FROM_EMAIL`.

## Notas de Trabajo

- El proyecto no tiene build ni dependencias locales.
- Es HTML/CSS/JS vanilla con Supabase JS por CDN.
- Cada cambio confirmado durante este hilo se ha subido a GitHub.
- Mantener EvenTin separado logicamente del resto de `Webs`, aunque comparta repositorio.
