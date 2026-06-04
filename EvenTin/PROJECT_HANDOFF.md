# EvenTin Project Handoff

Ultima actualizacion: 2026-06-03

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
|-- evento.html
|-- invitacion.html
|-- admin.html
|-- reset-password.html
|-- README.md
|-- PROJECT_HANDOFF.md
|-- css/style.css
|-- js/
|   |-- admin.js
|   |-- config.js
|   |-- countdown.js
|   |-- home.js
|   |-- invitation.js
|   |-- messages.js
|   `-- supabaseClient.js
|-- sql/schema.sql
|-- assets/images/
`-- supabase/functions/
    |-- notify-contact/index.ts
    `-- create-event-user/index.ts
```

## Paginas

- `index.html`: portada de EvenTin, con acceso por codigo de evento y formulario de contacto.
- `evento.html?evento=CODIGO_O_SLUG`: pagina publica de evento.
- `invitacion.html?evento=CODIGO_O_SLUG`: formulario publico de confirmacion de asistencia.
- `admin.html`: panel privado con login Supabase Auth.
- `reset-password.html`: restauracion de contrasena mediante email de Supabase Auth.

## Roles

EvenTin usa dos roles en `eventin_profiles`:

- `admin`: administra todos los eventos, usuarios, respuestas, mensajes y contactos.
- `user`: usuario de evento. Solo accede al evento cuyo `event_code` coincide con su perfil.

Relacion usuario-evento:

```text
eventin_profiles.event_code = eventin_events.event_code
```

El codigo numerico de evento tiene 6 digitos, se genera automaticamente al crear evento y es de solo lectura en el panel.

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

## Storage

Bucket:

```text
eventin-images
```

Es publico para servir imagenes por URL publica.

Rutas usadas:

```text
events/<event_code>/hero.webp
events/<event_code>/detail.webp
```

El panel optimiza imagenes en navegador antes de subir:

- Hero: max width 1600 px.
- Detail: max width 1200 px.
- Original max: 12 MB.
- Optimizada objetivo: menos de 2.5 MB.
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
- Copiar enlace publico.
- Copiar enlace de invitacion.
- Subir imagen principal y detalle optimizadas.
- Cambiar paleta del evento.
- Ver respuestas recibidas.
- Ver mensajes publicos.

Usuarios:

- Crear usuario de evento.
- Editar perfil de usuario de evento.
- Borrar perfil/asignacion.
- El usuario Auth completo se borra desde Supabase si se quiere eliminar el acceso por completo.
- El alta Auth se hace desde la Edge Function `create-event-user`, no con registros publicos de Supabase.
- Si el panel muestra error al crear usuario Auth, comprobar que `create-event-user` esta desplegada en Supabase.

Contactos:

- Ver mensajes enviados desde la portada.
- Responder por email con `mailto:`.
- Borrar mensajes.

Restaurar contrasena:

- Desde el login de `admin.html` hay enlace a `reset-password.html`.
- Desde la seccion de usuarios del admin hay enlace a `reset-password.html`.
- Si se esta editando un usuario, el enlace lleva su email precargado.
- La pagina usa `resetPasswordForEmail(email)` para enviar el email y `updateUser({ password })` cuando el usuario abre el enlace de recuperacion.
- En Supabase Auth deben estar permitidas como redirect URLs:
  - `https://alaraz1921.com/EvenTin/reset-password.html`
  - `https://alaraz1921.github.io/Webs/EvenTin/reset-password.html`

## Formulario de Contacto

El formulario de portada guarda en:

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
node --check V:\Proyectos\Git\Webs\EvenTin\js\home.js
node --check V:\Proyectos\Git\Webs\EvenTin\js\invitation.js
git -C V:\Proyectos\Git\Webs diff --check
git -C V:\Proyectos\Git\Webs status --short
```

No se pudo validar la Edge Function con `deno check` porque Deno no estaba instalado en la maquina.

## Ultimos Commits Importantes

```text
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
   - enviar contacto desde portada;
   - ver contacto en admin y recibir email.
7. Si se quiere enviar desde `contacto@alaraz1921.com`, verificar dominio/remitente en Resend y configurar `CONTACT_FROM_EMAIL`.

## Notas de Trabajo

- El proyecto no tiene build ni dependencias locales.
- Es HTML/CSS/JS vanilla con Supabase JS por CDN.
- Cada cambio confirmado durante este hilo se ha subido a GitHub.
- Mantener EvenTin separado logicamente del resto de `Webs`, aunque comparta repositorio.
