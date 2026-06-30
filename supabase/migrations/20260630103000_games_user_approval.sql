begin;

alter table public.profiles
    add column if not exists approval_status text not null default 'temporal',
    add column if not exists trial_expires_at timestamptz not null default (now() + interval '48 hours'),
    add column if not exists validated_at timestamptz,
    add column if not exists validated_by uuid references auth.users(id) on delete set null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_approval_status_check'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles
            add constraint profiles_approval_status_check
            check (approval_status in ('temporal', 'validado', 'bloqueado'));
    end if;
end;
$$;

update public.profiles
set approval_status = 'validado',
    validated_at = coalesce(validated_at, now()),
    validated_by = coalesce(validated_by, id)
where role = 'admin'
  and approval_status <> 'validado';

create index if not exists profiles_approval_status_idx
on public.profiles (approval_status, trial_expires_at);

create or replace function public.has_active_games_access(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = coalesce(p_user_id, auth.uid())
          and (
              p.role = 'admin'
              or p.approval_status = 'validado'
              or (p.approval_status = 'temporal' and p.trial_expires_at > now())
          )
    );
$$;

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

    insert into public.profiles (
        id,
        email,
        display_name,
        username,
        approval_status,
        trial_expires_at
    )
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', requested_username),
        requested_username,
        'temporal',
        now() + interval '48 hours'
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
    select public.has_active_games_access(auth.uid())
        and (
            public.is_admin()
            or exists (
                select 1
                from public.project_members pm
                join public.app_projects ap on ap.id = pm.project_id
                where pm.user_id = auth.uid()
                  and ap.slug = 'bingo'
                  and ap.is_active
                  and pm.role in ('owner', 'editor', 'viewer')
            )
        );
$$;

create or replace function public.can_use_infiltrado()
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.has_active_games_access(auth.uid())
        and (
            public.is_admin()
            or exists (
                select 1
                from public.project_members pm
                join public.app_projects ap on ap.id = pm.project_id
                where pm.user_id = auth.uid()
                  and ap.slug = 'infiltrado'
                  and ap.is_active
                  and pm.role in ('owner', 'editor', 'viewer')
            )
        );
$$;

revoke all on function public.has_active_games_access(uuid) from public;
revoke all on function public.can_manage_bingo() from public;
revoke all on function public.can_use_infiltrado() from public;

grant execute on function public.has_active_games_access(uuid) to authenticated;
grant execute on function public.can_manage_bingo() to authenticated;
grant execute on function public.can_use_infiltrado() to authenticated;

commit;