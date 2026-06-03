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
|-- css/style.css
|-- js/
|-- assets/images/
|-- assets/icons/
|-- sql/schema.sql
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

La creacion de usuarios usa Supabase Auth con la `anon public key`; por eso debe estar permitido el alta de usuarios en `Authentication` -> `Sign In / Providers`. El borrado desde el panel elimina el perfil/asignacion de EvenTin; si quieres eliminar tambien el usuario Auth, hazlo desde Supabase.

## Paginas

- `index.html`: portada publica del servicio.
- `evento.html?evento=primera-comunion-demo`: pagina publica de un evento concreto.
- `evento.html?evento=100001`: pagina publica de un evento concreto por codigo de 6 digitos.
- `invitacion.html?evento=primera-comunion-demo`: confirmacion publica de asistencia por telefono.
- `admin.html`: panel privado con autenticacion Supabase.

Evento demo creado por `sql/schema.sql`:

- `primera-comunion-demo` / `100001`

## Notas de seguridad

- Los mensajes publicos usan RLS para insertar registros anonimos en `eventin_public_messages`.
- Las confirmaciones de asistencia se envian mediante la RPC `eventin_submit_guest_response`; los usuarios anonimos no tienen permiso directo de insercion/actualizacion sobre `eventin_guest_responses`.
- Los admins tienen acceso global mediante RLS.
- Los usuarios de evento solo acceden a eventos cuyo codigo coincida con su `event_code`.
- La `service_role key` no debe estar nunca en GitHub Pages ni en JavaScript de frontend.
