# notify-new-user

Envía un aviso al administrador cuando se inserta un usuario en `auth.users`.

La llamada se realiza de forma asíncrona desde PostgreSQL mediante `pg_net`. Un fallo de la Edge Function o de Resend no impide el registro ni el correo normal de confirmación de Supabase Auth.

## 1. Crear la Edge Function desde la web

1. Abrir el proyecto Supabase de Webs: `nxuqkvuvmllqihaefjky`.
2. Ir a `Edge Functions`.
3. Pulsar `Deploy a new function` -> `Via Editor`.
4. Usar el nombre `notify-new-user`.
5. Sustituir el contenido del editor por `supabase/functions/notify-new-user/index.ts`.
6. Desactivar la verificación JWT para esta función. La función valida en su lugar el encabezado privado `x-webhook-secret`.
7. Pulsar `Deploy function`.

## 2. Configurar secrets de la Edge Function

En `Edge Functions` -> `Secrets`, crear:

```text
RESEND_API_KEY=re_...
ADMIN_NOTIFICATION_EMAIL=alaraz1921@gmail.com
FROM_EMAIL=Alaraz1921 <correo@dominio-verificado.com>
NEW_USER_WEBHOOK_SECRET=UN_VALOR_ALEATORIO_LARGO
```

- `FROM_EMAIL` debe usar un dominio/remitente autorizado en Resend.
- `NEW_USER_WEBHOOK_SECRET` debe ser largo, aleatorio y distinto de otras claves.
- Los secrets se aplican inmediatamente; no es necesario redesplegar la función.

## 3. Guardar el secreto compartido en Vault

En `SQL Editor`, ejecutar una sola vez usando exactamente el mismo valor configurado en `NEW_USER_WEBHOOK_SECRET`:

```sql
select vault.create_secret(
    'UN_VALOR_ALEATORIO_LARGO',
    'notify_new_user_webhook_secret',
    'Autoriza el trigger de auth.users para invocar notify-new-user'
);
```

No crear varias entradas Vault con el mismo nombre.

## 4. Crear el trigger

En `SQL Editor`, copiar y ejecutar:

```text
supabase/migrations/20260612150000_notify_new_user.sql
```

La migración:

- Activa `pg_net`.
- Crea `public.notify_admin_on_new_auth_user()`.
- Crea el trigger `on_auth_user_notify_admin` después de insertar en `auth.users`.
- Envía `id`, `email`, `created_at` y `Games`.
- Captura errores para no bloquear registros.

## 5. Probar

1. Registrar una cuenta nueva desde `games.html` usando un correo que no exista.
2. Confirmar que el usuario recibe el email normal de confirmación de Supabase.
3. Confirmar que `alaraz1921@gmail.com` recibe el aviso administrativo.
4. Revisar `Edge Functions` -> `notify-new-user` -> `Logs` si el aviso no llega.
5. Revisar respuestas de `pg_net` desde `SQL Editor`:

```sql
select *
from net._http_response
order by created desc
limit 10;
```

La API key de Resend y el secreto del webhook nunca deben añadirse al frontend ni al repositorio.
