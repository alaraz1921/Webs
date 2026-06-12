alter table public.profiles
    add column if not exists username text;

with username_candidates as (
    select
        id,
        lower(regexp_replace(
            coalesce(nullif(display_name, ''), split_part(email, '@', 1)),
            '[^a-zA-Z0-9_-]',
            '',
            'g'
        )) as candidate,
        row_number() over (
            partition by lower(regexp_replace(
                coalesce(nullif(display_name, ''), split_part(email, '@', 1)),
                '[^a-zA-Z0-9_-]',
                '',
                'g'
            ))
            order by created_at, id
        ) as candidate_position
    from public.profiles
)
update public.profiles profiles
set username = case
    when length(candidates.candidate) between 3 and 30
      and candidates.candidate_position = 1
        then candidates.candidate
    else left(coalesce(nullif(candidates.candidate, ''), 'user'), 21) || '_' || left(profiles.id::text, 8)
end
from username_candidates candidates
where profiles.id = candidates.id
  and (profiles.username is null or profiles.username = '');

alter table public.profiles
    alter column username set not null;

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username));

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
            case when app_projects.slug = 'bingo' then 'editor' else 'viewer' end
        from public.app_projects
        where app_projects.slug in ('bingo', 'infiltrado')
          and app_projects.is_active
        on conflict (project_id, user_id) do nothing;
    end if;

    return new;
end;
$$;

create or replace function public.resolve_games_login_email(p_identifier text)
returns text
language sql
security definer
set search_path = public
as $$
    select email
    from public.profiles
    where lower(username) = lower(trim(p_identifier))
    limit 1;
$$;

revoke all on function public.resolve_games_login_email(text) from public;
grant execute on function public.resolve_games_login_email(text) to anon, authenticated;
