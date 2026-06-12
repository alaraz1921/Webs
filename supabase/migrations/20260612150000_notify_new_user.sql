create extension if not exists pg_net with schema extensions;

create or replace function public.notify_admin_on_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    webhook_secret text;
begin
    select decrypted_secret
    into webhook_secret
    from vault.decrypted_secrets
    where name = 'notify_new_user_webhook_secret'
    limit 1;

    if webhook_secret is null then
        raise warning 'notify-new-user skipped: Vault secret notify_new_user_webhook_secret is missing';
        return new;
    end if;

    -- pg_net encola la llamada HTTP: el registro no espera al envio del email.
    perform net.http_post(
        url := 'https://nxuqkvuvmllqihaefjky.supabase.co/functions/v1/notify-new-user',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', webhook_secret
        ),
        body := jsonb_build_object(
            'id', new.id,
            'email', new.email,
            'created_at', new.created_at,
            'project', 'Games'
        ),
        timeout_milliseconds := 5000
    );

    return new;
exception
    when others then
        -- El aviso nunca debe bloquear ni revertir la creacion del usuario.
        raise warning 'notify-new-user trigger failed: %', sqlerrm;
        return new;
end;
$$;

drop trigger if exists on_auth_user_notify_admin on auth.users;
create trigger on_auth_user_notify_admin
after insert on auth.users
for each row execute function public.notify_admin_on_new_auth_user();
