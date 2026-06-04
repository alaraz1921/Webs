# Supabase

Este directorio contiene el esquema inicial para la base de datos de `Webs`.

EvenTin usa un proyecto Supabase independiente. Su estructura de datos esta en `EvenTin/sql/schema.sql`.

## Proyecto

```text
https://nxuqkvuvmllqihaefjky.supabase.co
```

La clave `anon public` esta en `assets/supabase-client.js`. No guardar nunca la `service_role key` en el repositorio ni en codigo de frontend.

## Aplicar la primera migracion

Opcion sencilla desde el panel de Supabase:

1. Abrir el proyecto en Supabase.
2. Ir a `SQL Editor`.
3. Crear una query nueva.
4. Copiar y ejecutar, en orden, el contenido de:
   - `migrations/20260601110000_initial_private_schema.sql`
   - `migrations/20260601113000_daily_access_codes.sql`
   - `migrations/20260604120000_webs_contact_messages.sql`
5. Comprobar que no hay errores en el resultado.

## Crear el primer usuario

1. Ir a `Authentication` -> `Users`.
2. Crear un usuario con email y contraseña.
3. Si debe ser administrador, ir a `Table Editor` -> `profiles` y cambiar su `role` a `admin`.

## Tablas iniciales

- `profiles`: perfil asociado a `auth.users`.
- `app_projects`: proyectos o secciones privadas.
- `project_members`: permisos de usuarios por proyecto.

Todas las tablas tienen RLS activado.

## Funciones RPC

- `validate_daily_access_code(game_slug, access_code)`: valida la clave diaria para `bingo_monitor` e `infiltrado`.
- `get_daily_access_formula_note()`: devuelve el recordatorio de la formula para mostrarlo en la zona privada.

## Contacto de Webs

El formulario de contacto de la portada usa el proyecto Supabase de `Webs` y guarda mensajes en:

```text
public.webs_contact_messages
```

Para enviar aviso por email, desplegar la Edge Function propia de Webs:

```powershell
cd V:\Proyectos\Git\Webs
supabase secrets set RESEND_API_KEY=TU_RESEND_API_KEY WEBS_CONTACT_TO_EMAIL=alaraz1921@gmail.com WEBS_CONTACT_FROM_EMAIL="Webs <contacto@tu-dominio.com>" --project-ref nxuqkvuvmllqihaefjky
supabase functions deploy notify-webs-contact --project-ref nxuqkvuvmllqihaefjky
```

`WEBS_CONTACT_FROM_EMAIL` debe pertenecer a un dominio/remitente verificado en Resend. Si no se configura, la funcion usa `Webs <onboarding@resend.dev>`, valido solo para pruebas limitadas de Resend.

## Restos de EvenTin en el proyecto Supabase de Webs

EvenTin debe usar su propio proyecto Supabase independiente. Si en el proyecto Supabase de `Webs` existen estas tablas y estan vacias, son restos de la implementacion inicial y se pueden borrar:

```text
eventin_events
eventin_event_settings
eventin_profiles
eventin_event_admins
eventin_guest_responses
eventin_public_messages
eventin_contact_requests
```

Si se llego a ejecutar una version anterior del esquema de EvenTin antes de prefijar tablas, tambien pueden existir estos restos sin prefijo:

```text
events
event_settings
event_admins
guest_responses
public_messages
```

No borrar `profiles`, `app_projects` ni `project_members`, porque pertenecen a la zona privada de `Webs`.

Antes de borrar, comprobar en Supabase que no contienen datos utiles y que ninguna pagina de `Webs` las consulta. La portada de `Webs` ya no usa tablas `eventin_*`.
