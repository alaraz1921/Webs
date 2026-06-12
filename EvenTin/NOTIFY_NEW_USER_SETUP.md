# Aviso por email al registrar un usuario

La Edge Function `notify-new-user` envía un aviso mediante Resend después de
insertar un usuario en `auth.users`. La llamada es asíncrona y cualquier error
queda registrado sin impedir el alta ni el email normal de confirmación de
Supabase Auth.

El flujo actual del panel de EvenTin crea usuarios con `email_confirm: true`,
por lo que esos usuarios se autoconfirman y no reciben email de confirmación.
Esta funcionalidad no modifica ese comportamiento ni el de futuros registros
que sí utilicen la confirmación normal de Supabase Auth.

## 1. Configurar secretos de la Edge Function

Desde PowerShell, dentro de `V:\Proyectos\Git\Webs\EvenTin`:

```powershell
supabase login
supabase secrets set RESEND_API_KEY=TU_RESEND_API_KEY ADMIN_NOTIFICATION_EMAIL=alaraz1921@gmail.com FROM_EMAIL="EvenTin <contacto@tu-dominio-verificado.com>" NEW_USER_WEBHOOK_SECRET=UNA_CLAVE_ALEATORIA_LARGA --project-ref tmnavlsptjhhdlypgtaa
```

`FROM_EMAIL` debe usar un remitente o dominio verificado en Resend. No guardes
ninguna de estas claves en JavaScript público.

## 2. Desplegar la Edge Function

```powershell
supabase functions deploy notify-new-user --project-ref tmnavlsptjhhdlypgtaa
```

La función mantiene la verificación JWT predeterminada. No usar
`--no-verify-jwt`.

## 3. Crear secretos en Supabase Vault

En `Supabase Dashboard -> SQL Editor`, sustituye los valores y ejecuta una vez:

```sql
select vault.create_secret(
  'https://tmnavlsptjhhdlypgtaa.supabase.co/functions/v1/notify-new-user',
  'eventin_notify_new_user_url'
);

select vault.create_secret(
  'TU_ANON_PUBLIC_KEY_EVENTIN',
  'eventin_notify_new_user_anon_key'
);

select vault.create_secret(
  'LA_MISMA_CLAVE_ALEATORIA_LARGA_DE_NEW_USER_WEBHOOK_SECRET',
  'eventin_notify_new_user_webhook_secret'
);
```

El secreto compartido de Vault debe coincidir exactamente con
`NEW_USER_WEBHOOK_SECRET` de la Edge Function.

## 4. Crear el trigger

En `Supabase Dashboard -> SQL Editor`, ejecuta:

```text
sql/notify-new-user.sql
```

Este SQL habilita `pg_net`, crea la función no bloqueante y añade el trigger
`AFTER INSERT` sobre `auth.users`.

## 5. Probar

1. Crea un usuario nuevo desde el panel de EvenTin o desde Supabase Auth.
2. Confirma que el usuario se crea normalmente.
3. Comprueba la recepción del email en `alaraz1921@gmail.com`.
4. Revisa los logs en `Supabase Dashboard -> Edge Functions -> notify-new-user -> Logs`.
5. Para inspeccionar entregas HTTP recientes de `pg_net`, ejecuta:

```sql
select *
from net._http_response
order by created desc
limit 20;
```

El aviso incluye email, fecha y hora, proyecto `Games` e ID del usuario. Los
fallos del aviso se registran en logs y nunca cancelan el registro.
