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

- URL de Supabase.
- `anon public key`.
- `defaultEventId`.
- `defaultEventSlug`.
- `defaultEventCode`.
- Textos de respaldo por si la base de datos aun no esta creada.

No guardar nunca la `service_role key` ni claves privadas en este proyecto.

## Base de datos

1. Abrir el proyecto en Supabase.
2. Ir a `SQL Editor`.
3. Copiar y ejecutar el contenido de `sql/schema.sql`.
4. Crear usuarios desde `Authentication`.
5. Crear el perfil del usuario en `eventin_profiles`.
6. Relacionar el usuario con el evento en `eventin_event_admins`.

Ejemplo para asignar un administrador:

```sql
insert into public.eventin_profiles (id, display_name, role)
values ('UUID_DEL_USUARIO_AUTH', 'Administrador', 'admin')
on conflict (id) do update set display_name = excluded.display_name;

update public.eventin_profiles
set email = 'admin@ejemplo.com'
where id = 'UUID_DEL_USUARIO_AUTH';

insert into public.eventin_event_admins (event_id, user_id)
values ('11111111-1111-1111-1111-111111111111', 'UUID_DEL_USUARIO_AUTH')
on conflict (event_id, user_id) do nothing;
```

## Paginas

- `index.html`: portada publica del servicio.
- `index.html?evento=primera-comunion-demo`: pagina publica de un evento concreto.
- `index.html?evento=100001`: pagina publica de un evento concreto por ID de 6 digitos.
- `invitacion.html?evento=primera-comunion-demo`: confirmacion publica de asistencia por telefono.
- `admin.html`: panel privado con autenticacion Supabase.

Eventos demo creados por `sql/schema.sql`:

- `primera-comunion-demo` / `100001`
- `bautizo-sofia-demo` / `100002`
- `cumpleanos-martina-demo` / `100003`

## Notas de seguridad

- Los formularios publicos usan RLS para insertar mensajes y crear/actualizar respuestas.
- El visitante nunca sabe si su telefono creo una respuesta nueva o actualizo una existente.
- Los administradores solo pueden consultar eventos asignados mediante `eventin_event_admins`.
- La arquitectura ya separa `eventin_profiles`, `eventin_event_admins` y `eventin_events` para una futura pagina de superadministrador.
