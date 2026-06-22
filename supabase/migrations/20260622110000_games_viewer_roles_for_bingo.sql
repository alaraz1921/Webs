begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_username text;
    is_games_registration boolean;
begin
    is_games_registration := coalesce(new.raw_user_meta_data ->> 'registration_source', '') = 'games';
    requested_username := lower(trim(coalesce(
        new.raw_user_meta_data ->> 'username',
        new.raw_user_meta_data ->> 'display_name',
        split_part(new.email, '@', 1)
    )));

    if requested_username !~ '^[a-z0-9_-]{3,30}$' then
        if is_games_registration then
            raise exception 'invalid username';
        end if;
        requested_username := left(regexp_replace(requested_username, '[^a-z0-9_-]', '', 'g'), 21)
            || '_' || left(new.id::text, 8);
    end if;

    if exists (
        select 1 from public.profiles
        where lower(username) = requested_username
          and id <> new.id
    ) then
        if is_games_registration then
            raise exception 'username already exists';
        end if;
        requested_username := left(requested_username, 21) || '_' || left(new.id::text, 8);
    end if;

    insert into public.profiles (id, email, display_name, username)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', requested_username),
        requested_username
    )
    on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        username = excluded.username,
        updated_at = now();

    if is_games_registration then
        insert into public.project_members (project_id, user_id, role)
        select
            app_projects.id,
            new.id,
            'viewer'
        from public.app_projects
        where app_projects.slug in ('bingo', 'infiltrado')
          and app_projects.is_active
        on conflict (project_id, user_id) do nothing;
    end if;

    return new;
end;
$$;

create or replace function public.can_manage_bingo()
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.is_admin()
        or exists (
            select 1
            from public.project_members pm
            join public.app_projects ap on ap.id = pm.project_id
            where pm.user_id = auth.uid()
              and ap.slug = 'bingo'
              and ap.is_active
              and pm.role in ('owner', 'editor', 'viewer')
        );
$$;

commit;
