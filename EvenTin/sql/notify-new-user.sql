-- EvenTin: aviso no bloqueante cuando se crea un usuario en Supabase Auth.
-- Antes de ejecutar, crear en Supabase Vault los secretos indicados en
-- NOTIFY_NEW_USER_SETUP.md.

create extension if not exists pg_net with schema extensions;

create or replace function eventin_private.notify_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    function_url text;
    anon_key text;
    webhook_secret text;
    request_id bigint;
begin
    select decrypted_secret into function_url
    from vault.decrypted_secrets
    where name = 'eventin_notify_new_user_url'
    limit 1;

    select decrypted_secret into anon_key
    from vault.decrypted_secrets
    where name = 'eventin_notify_new_user_anon_key'
    limit 1;

    select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
    where name = 'eventin_notify_new_user_webhook_secret'
    limit 1;

    if nullif(trim(function_url), '') is null
       or nullif(trim(anon_key), '') is null
       or nullif(trim(webhook_secret), '') is null then
        raise warning 'notify-new-user skipped: configure the required Vault secrets';
        return new;
    end if;

    select net.http_post(
        url := function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key,
            'x-webhook-secret', webhook_secret
        ),
        body := jsonb_build_object(
            'id', new.id,
            'email', new.email,
            'created_at', new.created_at
        )
    ) into request_id;

    return new;
exception
    when others then
        -- El aviso nunca debe impedir que Supabase Auth cree al usuario.
        raise warning 'notify-new-user trigger failed: %', sqlerrm;
        return new;
end;
$$;

revoke all on function eventin_private.notify_new_auth_user() from public, anon, authenticated;

drop trigger if exists trg_notify_new_auth_user on auth.users;
create trigger trg_notify_new_auth_user
after insert on auth.users
for each row execute function eventin_private.notify_new_auth_user();
