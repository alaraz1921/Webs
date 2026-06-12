-- Supabase Auth debe mantener activada la confirmacion de correo:
-- Authentication > Providers > Email > Confirm email.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();

    if coalesce(new.raw_user_meta_data ->> 'registration_source', '') = 'games' then
        insert into public.project_members (project_id, user_id, role)
        select
            app_projects.id,
            new.id,
            case when app_projects.slug = 'bingo' then 'editor' else 'viewer' end
        from public.app_projects
        where app_projects.slug in ('bingo', 'infiltrado')
          and app_projects.is_active
        on conflict (project_id, user_id) do nothing;
    end if;

    return new;
end;
$$;
