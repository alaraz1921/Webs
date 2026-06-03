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
`-- supabase/functions/notify-contact/index.ts
```

## Paginas

- `index.html`: portada de EvenTin, con acceso por codigo de evento y formulario de contacto.
- `evento.html?evento=CODIGO_O_SLUG`: pagina publica de evento.
- `invitacion.html?evento=CODIGO_O_SLUG`: formulario publico de confirmacion de asistencia.
- `admin.html`: panel privado con login Supabase Auth.

## Roles

EvenTin usa dos roles en `eventin_profiles`:

- `admin`: administra todos los eventos, usuarios, respuestas, mensajes y contactos.
- `user`: usuario de evento. Solo accede al evento cuyo `event_code` coincide con su perfil.

Relacion usuario-evento:

```text
eventin_profiles.event_code = eventin_events.event_code
```

El codigo numerico de evento tiene 6 digitos, se genera automaticamente al crear evento y es de solo lectura en el panel.

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

Contactos:

- Ver mensajes enviados desde la portada.
- Responder por email con `mailto:`.
- Borrar mensajes.

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

Comandos habituales:

```powershell
cd V:\Proyectos\Git\Webs\EvenTin
supabase secrets set RESEND_API_KEY=TU_NUEVA_KEY CONTACT_TO_EMAIL=tu_email@gmail.com --project-ref tmnavlsptjhhdlypgtaa
supabase functions deploy notify-contact --project-ref tmnavlsptjhhdlypgtaa
```

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
fff0dba Add contact admin view and email notification
69cb0d2 Remove broad public storage select policy
730b991 Restrict internal helper function execution
d11bde9 Move EvenTin helper functions to private schema
```

## Tareas Pendientes o A Comprobar

1. Ejecutar siempre el `EvenTin/sql/schema.sql` actualizado en Supabase tras cambios de schema.
2. Activar `Leaked password protection` en Supabase Auth.
3. Confirmar que `notify-contact` tiene secretos correctos y envia emails.
4. Probar flujo completo:
   - crear evento;
   - subir imagen principal/detalle;
   - crear usuario de evento;
   - acceder como usuario;
   - enviar invitacion;
   - enviar mensaje publico;
   - enviar contacto desde portada;
   - ver contacto en admin y recibir email.
5. Si se quiere enviar desde `contacto@alaraz1921.com`, verificar dominio/remitente en Resend y configurar `CONTACT_FROM_EMAIL`.

## Notas de Trabajo

- El proyecto no tiene build ni dependencias locales.
- Es HTML/CSS/JS vanilla con Supabase JS por CDN.
- Cada cambio confirmado durante este hilo se ha subido a GitHub.
- Mantener EvenTin separado logicamente del resto de `Webs`, aunque comparta repositorio.
