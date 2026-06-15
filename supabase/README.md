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
   - `migrations/20260611120000_bingo_partidas.sql`
   - `migrations/20260611150000_infiltrado_supabase.sql`
   - `migrations/20260612100000_games_self_registration.sql`
   - `migrations/20260612120000_games_username_password_recovery.sql`
   - `migrations/20260612150000_notify_new_user.sql`
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

- `validate_daily_access_code(game_slug, access_code)`: valida la clave diaria de `infiltrado`.
- `get_daily_access_formula_note()`: devuelve el recordatorio de la formula para mostrarlo en la zona privada.

## Bingo

La migracion `20260611120000_bingo_partidas.sql`:

- Crea o actualiza el proyecto `bingo` en `app_projects`.
- Crea `bingo_partidas` con ids automaticos entre 100 y 999.
- Es idempotente: puede ejecutarse de nuevo si una ejecucion anterior quedo incompleta.
- Permite lectura publica para que el carton no necesite login.
- Restringe crear, iniciar y reiniciar partidas a administradores o miembros `owner`/`editor` de Bingo.

El formulario del Monitor acepta el correo o el nombre guardado en `profiles.username`. Siempre exige la contraseña real de Supabase Auth. Pueden acceder los administradores y los miembros `owner` o `editor` del proyecto.

Si Supabase muestra `relation "bingo_partidas" already exists`, actualizar el repositorio y volver a ejecutar el archivo completo. La version actual reutiliza la tabla existente y completa columnas, permisos y politicas sin borrarla.

## Infiltrado

La migracion `20260611150000_infiltrado_supabase.sql` crea el proyecto `infiltrado`, las tablas `infiltrado_palabras`, `infiltrado_partidas` e `infiltrado_jugadores`, y carga las categorias Lugares, Cosas y Profesiones.

La migracion `20260615120000_infiltrado_palabras_usadas.sql` crea `infiltrado_palabras_usadas`. Cada ronda registra su palabra para evitar repeticiones dentro de la partida temporal. Al eliminar la partida, su historial se borra automaticamente por cascada.

El formulario de Infiltrado acepta el correo o el nombre guardado en `profiles.username`. Siempre exige la contraseña real de Supabase Auth. Pueden acceder los administradores y los miembros asignados al proyecto.

## Registro compartido de Games

La migracion `20260612100000_games_self_registration.sql` amplia el alta de usuarios para que los registros solicitados desde `games.html` reciban automaticamente acceso al Monitor de Bingo y a Infiltrado.

Para que Supabase valide el correo:

1. Ir a `Authentication` -> `Providers` -> `Email`.
2. Mantener activada la opcion `Confirm email`.
3. Añadir `https://www.alaraz1921.com/games.html` a las URLs de redireccion permitidas si no esta incluida por la configuracion general del sitio.

El usuario no podra iniciar sesion hasta confirmar el enlace enviado por Supabase. La sesion compartida de Games caduca localmente a las 24 horas.

La migracion `20260612120000_games_username_password_recovery.sql`:

- Añade un nombre de usuario unico a `profiles`.
- Permite resolver el usuario durante el login de Games sin exponer la tabla completa.
- Prepara el flujo de restauracion de contraseña mediante Supabase Auth.

Para la restauracion, añadir tambien esta URL a las redirecciones permitidas:

```text
https://www.alaraz1921.com/games.html?recovery=1
```

Los correos se personalizan desde `Authentication` -> `Email Templates`:

- `Confirm signup` para el correo de alta.
- `Reset password` para el correo de restauracion.

Si las plantillas construyen enlaces personalizados y usan la redireccion facilitada por la web, revisar que empleen `{{ .RedirectTo }}`. Para produccion se recomienda configurar un SMTP propio; el servicio de prueba de Supabase tiene limites bajos de envio.

## Aviso de nuevos usuarios

La Edge Function `notify-new-user` y la migracion `20260612150000_notify_new_user.sql` envian un aviso administrativo mediante Resend después de insertar un usuario en `auth.users`.

- El trigger usa `pg_net`, por lo que el aviso se ejecuta de forma asincrona.
- Los errores quedan en logs y nunca bloquean el registro.
- La funcion usa `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL`, `FROM_EMAIL` y `NEW_USER_WEBHOOK_SECRET`.
- El trigger obtiene el secreto compartido desde Supabase Vault.
- La funcion no se invoca desde el frontend.

Las instrucciones completas para configurarla y desplegarla desde la web estan en:

```text
supabase/functions/notify-new-user/README.md
```

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
