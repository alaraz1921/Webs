# Motor de eventos familiares

Proyecto estatico preparado para publicarse dentro de GitHub Pages en:

```text
https://www.alaraz1921.com/EvenTin/
```

El nombre `EvenTin` se usa solo como directorio interno. La web no muestra esa marca para poder reutilizar la plataforma en comuniones, bautizos, bodas, cumpleanos u otras celebraciones.

## Estructura

```text
EvenTin/
|-- index.html
|-- evento.html
|-- invitacion.html
|-- admin.html
|-- reset-password.html
|-- css/style.css
|-- js/
|-- assets/images/
|-- assets/icons/
|-- sql/schema.sql
|-- supabase/functions/notify-contact/
|-- supabase/functions/create-event-user/
`-- README.md
```

## Configuracion

La configuracion publica esta en:

```text
js/config.js
```

Incluye:

- URL del proyecto Supabase independiente de EvenTin.
- `anon public key` del proyecto Supabase de EvenTin.
- `defaultEventId`.
- `defaultEventSlug`.
- `defaultEventCode`.
- Textos de respaldo por si la base de datos aun no esta creada.

No guardar nunca la `service_role key` ni claves privadas en este proyecto.
No reutilizar aqui la URL ni la `anon public key` del proyecto Supabase privado de `Webs`.

## Base de datos

1. Abrir el proyecto nuevo de Supabase llamado `EvenTin`.
2. Ir a `SQL Editor`.
3. Copiar y ejecutar el contenido de `sql/schema.sql`.
4. Copiar la URL y la `anon public key` de `Project Settings` -> `API`.
5. Pegar esos valores en `js/config.js`.

## Mensajes de contacto y aviso por email

El formulario de contacto de la portada guarda los mensajes en:

```text
public.eventin_contact_requests
```

El panel de administracion muestra esos mensajes en la seccion `Mensajes de contacto`.

Para recibir aviso por email, desplegar la Edge Function `notify-contact` y configurar secretos en Supabase. La funcion esta preparada para Resend:

```powershell
cd V:\Proyectos\Git\Webs\EvenTin
supabase secrets set RESEND_API_KEY=TU_RESEND_API_KEY CONTACT_TO_EMAIL=tu-email@ejemplo.com CONTACT_FROM_EMAIL="EvenTin <contacto@tu-dominio.com>" --project-ref tmnavlsptjhhdlypgtaa
supabase functions deploy notify-contact --project-ref tmnavlsptjhhdlypgtaa
```

`CONTACT_FROM_EMAIL` debe pertenecer a un dominio/remitente verificado en Resend. Si no se configura, la funcion usa `EvenTin <onboarding@resend.dev>`, valido solo para pruebas limitadas de Resend.

## Alta segura de usuarios

El panel de administracion crea usuarios Auth mediante la Edge Function `create-event-user`. No es necesario permitir registros publicos en Supabase.

Desplegar la funcion:

```powershell
cd V:\Proyectos\Git\Webs\EvenTin
supabase functions deploy create-event-user --project-ref tmnavlsptjhhdlypgtaa
```

La funcion usa los secretos automaticos de Supabase Edge Functions:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Roles

EvenTin usa dos roles en `eventin_profiles`:

- `admin`: puede crear, editar y borrar eventos; gestionar usuarios de evento; y ver/editar/borrar mensajes y respuestas de cualquier evento.
- `user`: pertenece a un evento por el campo `event_code`; puede ver y editar ese evento, sus mensajes y sus respuestas.

El enlace entre un usuario de evento y su evento es el codigo numerico de 6 digitos:

```text
eventin_profiles.event_code = eventin_events.event_code
```

## Crear el primer admin

1. Crear el usuario desde `Authentication` -> `Users` en Supabase.
2. Copiar su UUID.
3. Ejecutar este SQL cambiando los valores:

```sql
insert into public.eventin_profiles (id, email, display_name, role, event_code)
values (
    'UUID_DEL_USUARIO_AUTH',
    'admin@ejemplo.com',
    'Administrador',
    'admin',
    null
)
on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    role = excluded.role,
    event_code = excluded.event_code;
```

Una vez creado ese admin, los usuarios de evento se gestionan desde `admin.html`.

## Usuarios de evento

Desde el panel de administracion se puede crear un usuario de evento indicando:

- Nombre.
- Email.
- Contrasena.
- Codigo numerico de 6 digitos del evento.

La creacion de usuarios usa la Edge Function `create-event-user`, que verifica que la sesion actual sea de rol `admin` antes de usar la Admin API de Supabase. El borrado desde el panel elimina el perfil/asignacion de EvenTin; si quieres eliminar tambien el usuario Auth, hazlo desde Supabase.

## Paginas

- `index.html`: portada publica del servicio.
- `evento.html?evento=primera-comunion-demo`: pagina publica de un evento concreto.
- `evento.html?evento=100001`: pagina publica de un evento concreto por codigo de 6 digitos.
- `invitacion.html?evento=primera-comunion-demo`: confirmacion publica de asistencia por telefono.
- `admin.html`: panel privado con autenticacion Supabase.
- `reset-password.html`: solicita email de restauracion y permite guardar una nueva contrasena desde el enlace de Supabase.

Evento demo creado por `sql/schema.sql`:

- `primera-comunion-demo` / `100001`

## Notas de seguridad

- Los mensajes publicos usan RLS para insertar registros anonimos en `eventin_public_messages`.
- Las confirmaciones de asistencia se envian mediante las RPC `eventin_find_guest_by_phone` y `eventin_submit_guest_phone_response`; los usuarios anonimos no tienen permiso directo sobre las tablas de invitados o respuestas.
- Los admins tienen acceso global mediante RLS.
- Los usuarios de evento solo acceden a eventos cuyo codigo coincida con su `event_code`.
- La `service_role key` no debe estar nunca en GitHub Pages ni en JavaScript de frontend.

## Restaurar contrasena

El enlace `reset-password.html` usa Supabase Auth:

- `resetPasswordForEmail(email)` para enviar el email de restauracion.
- `updateUser({ password })` para guardar la nueva contrasena cuando el usuario abre el enlace de recuperacion.

En Supabase Auth debe estar permitido como redirect URL:

```text
https://alaraz1921.com/EvenTin/reset-password.html
https://alaraz1921.github.io/Webs/EvenTin/reset-password.html
```
