-- EvenTin: estructura base para eventos y usuarios.
-- Ejecutar desde Supabase SQL Editor. No guardar nunca service_role keys en frontend.

create extension if not exists pgcrypto;

create schema if not exists eventin_private;
revoke all on schema eventin_private from public;
grant usage on schema eventin_private to anon, authenticated, service_role;

create table if not exists public.eventin_event_types (
    key text primary key,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.eventin_event_types (key, name) values
    ('communion', 'Comunion'),
    ('baptism', 'Bautizo'),
    ('wedding', 'Boda'),
    ('birthday', 'Cumpleanos'),
    ('celebration', 'Celebracion')
on conflict (key) do update set name = excluded.name;

create table if not exists public.eventin_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    public_slug text unique,
    event_code text unique check (event_code ~ '^[0-9]{6}$'),
    event_type text not null default 'communion' references public.eventin_event_types(key),
    event_date timestamptz not null,
    location_name text,
    maps_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_event_settings (
    event_id uuid primary key references public.eventin_events(id) on delete cascade,
    main_title text,
    subtitle text,
    display_date text,
    display_time text,
    presentation_title text,
    presentation_text text,
    hero_image_url text,
    detail_image_url text,
    palette_key text not null default 'clasica',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique,
    display_name text,
    role text not null default 'user',
    event_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop table if exists public.eventin_event_admins cascade;

create table if not exists public.eventin_guest_responses (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventin_events(id) on delete cascade,
    guest_id uuid,
    nombre text not null,
    telefono text,
    asistencia boolean not null,
    adults_count integer not null default 1,
    children_count integer not null default 0,
    mensaje text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_guests (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventin_events(id) on delete cascade,
    name text not null,
    phone1 text,
    phone2 text,
    phone3 text,
    phone4 text,
    adults_count integer not null default 1,
    children_count integer not null default 0,
    will_attend boolean,
    message text,
    invitation_status text not null default 'pending',
    viewed_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_public_messages (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventin_events(id) on delete cascade,
    author_name text not null,
    message text not null,
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_contact_requests (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    email text not null,
    asunto text not null,
    mensaje text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.eventin_gallery_settings (
    event_id uuid primary key references public.eventin_events(id) on delete cascade,
    collaborative_available boolean not null default false,
    collaborative_enabled boolean not null default false,
    collaborative_token text unique not null default encode(gen_random_bytes(24), 'hex'),
    collaborative_key_hash text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_gallery_images (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventin_events(id) on delete cascade,
    gallery_type text not null check (gallery_type in ('public', 'collaborative')),
    storage_path text unique not null,
    thumbnail_storage_path text unique,
    uploaded_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.eventin_events add column if not exists public_slug text;
alter table public.eventin_events add column if not exists event_code text;
alter table public.eventin_gallery_settings add column if not exists collaborative_available boolean not null default false;
alter table public.eventin_gallery_images add column if not exists thumbnail_storage_path text unique;
alter table public.eventin_events add column if not exists event_type text not null default 'communion';
alter table public.eventin_event_settings add column if not exists main_title text;
alter table public.eventin_event_settings add column if not exists palette_key text not null default 'clasica';
alter table public.eventin_event_settings alter column palette_key set default 'clasica';
update public.eventin_event_settings
set palette_key = 'clasica'
where palette_key is null
   or palette_key not in ('clasica', 'dulce', 'brisa', 'natura');
alter table public.eventin_event_settings drop constraint if exists eventin_event_settings_palette_key_check;
alter table public.eventin_event_settings
    add constraint eventin_event_settings_palette_key_check
    check (palette_key in ('clasica', 'dulce', 'brisa', 'natura'));
alter table public.eventin_profiles add column if not exists email text;
alter table public.eventin_profiles add column if not exists event_code text;
alter table public.eventin_guest_responses add column if not exists guest_id uuid;
alter table public.eventin_guest_responses add column if not exists adults_count integer not null default 1;
alter table public.eventin_guest_responses add column if not exists children_count integer not null default 0;
alter table public.eventin_guest_responses alter column telefono drop not null;
alter table public.eventin_guest_responses drop constraint if exists eventin_guest_responses_event_id_telefono_key;
alter table public.eventin_guests add column if not exists phone1 text;
alter table public.eventin_guests add column if not exists phone2 text;
alter table public.eventin_guests add column if not exists phone3 text;
alter table public.eventin_guests add column if not exists phone4 text;
alter table public.eventin_guests add column if not exists will_attend boolean;
alter table public.eventin_guests add column if not exists message text;
alter table public.eventin_guests add column if not exists viewed_at timestamptz;
alter table public.eventin_guests add column if not exists responded_at timestamptz;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'eventin_guests' and column_name = 'phone'
    ) then
        execute 'update public.eventin_guests set phone1 = coalesce(phone1, phone) where phone1 is null';
    end if;
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'eventin_guests' and column_name = 'notes'
    ) then
        execute 'update public.eventin_guests set message = coalesce(message, notes) where message is null';
    end if;
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'eventin_guests' and column_name = 'opened_at'
    ) then
        execute 'update public.eventin_guests set viewed_at = coalesce(viewed_at, opened_at) where viewed_at is null';
    end if;
end;
$$;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'eventin_guests' and column_name = 'invitation_token'
    ) then
        alter table public.eventin_guests alter column invitation_token drop default;
        alter table public.eventin_guests alter column invitation_token drop not null;
        update public.eventin_guests set invitation_token = null;
    end if;
end;
$$;

update public.eventin_profiles
set role = 'admin'
where role = 'superadmin';

update public.eventin_profiles
set role = 'user'
where role not in ('admin', 'user');

do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'eventin_profiles_role_check'
    ) then
        alter table public.eventin_profiles drop constraint eventin_profiles_role_check;
    end if;

    alter table public.eventin_profiles
    add constraint eventin_profiles_role_check
    check (role in ('admin', 'user'));
end;
$$;

do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'eventin_guests_status_check'
    ) then
        alter table public.eventin_guests drop constraint eventin_guests_status_check;
    end if;

    update public.eventin_guests
    set invitation_status = 'viewed'
    where invitation_status = 'opened';

    alter table public.eventin_guests
    add constraint eventin_guests_status_check
    check (invitation_status in ('pending', 'viewed', 'confirmed', 'declined'));
end;
$$;

do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'eventin_guests_counts_check'
    ) then
        alter table public.eventin_guests drop constraint eventin_guests_counts_check;
    end if;

    alter table public.eventin_guests
    add constraint eventin_guests_counts_check
    check (adults_count >= 0 and children_count >= 0);
end;
$$;

do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'eventin_guest_responses_counts_check'
    ) then
        alter table public.eventin_guest_responses drop constraint eventin_guest_responses_counts_check;
    end if;

    alter table public.eventin_guest_responses
    add constraint eventin_guest_responses_counts_check
    check (adults_count >= 0 and children_count >= 0);
end;
$$;

do $$
begin
    if exists (
        select 1 from pg_constraint where conname = 'eventin_profiles_event_code_check'
    ) then
        alter table public.eventin_profiles drop constraint eventin_profiles_event_code_check;
    end if;

    alter table public.eventin_profiles
    add constraint eventin_profiles_event_code_check
    check (event_code is null or event_code ~ '^[0-9]{6}$');
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'eventin_guest_responses_guest_id_fkey'
    ) then
        alter table public.eventin_guest_responses
        add constraint eventin_guest_responses_guest_id_fkey
        foreign key (guest_id) references public.eventin_guests(id) on delete set null;
    end if;
end;
$$;

create index if not exists idx_eventin_events_public_slug on public.eventin_events(public_slug);
create index if not exists idx_eventin_events_event_code on public.eventin_events(event_code);
create index if not exists idx_eventin_events_event_type on public.eventin_events(event_type);
create unique index if not exists idx_eventin_profiles_email_unique on public.eventin_profiles(email) where email is not null;
create index if not exists idx_eventin_profiles_event_code on public.eventin_profiles(event_code);
create index if not exists idx_eventin_guest_responses_event_id on public.eventin_guest_responses(event_id);
create index if not exists idx_eventin_guest_responses_event_phone on public.eventin_guest_responses(event_id, telefono);
create index if not exists idx_eventin_guest_responses_guest_id on public.eventin_guest_responses(guest_id);
delete from public.eventin_guest_responses older
using public.eventin_guest_responses newer
where older.guest_id is not null
  and older.guest_id = newer.guest_id
  and (older.updated_at, older.id) < (newer.updated_at, newer.id);
create unique index if not exists idx_eventin_guest_responses_guest_unique on public.eventin_guest_responses(guest_id) where guest_id is not null;
create index if not exists idx_eventin_guests_event_id on public.eventin_guests(event_id);
create index if not exists idx_eventin_guests_event_phone1 on public.eventin_guests(event_id, phone1);
create index if not exists idx_eventin_guests_event_phone2 on public.eventin_guests(event_id, phone2);
create index if not exists idx_eventin_guests_event_phone3 on public.eventin_guests(event_id, phone3);
create index if not exists idx_eventin_guests_event_phone4 on public.eventin_guests(event_id, phone4);
drop index if exists public.idx_eventin_guests_invitation_token;
create index if not exists idx_eventin_public_messages_event_id on public.eventin_public_messages(event_id);
create index if not exists idx_eventin_contact_requests_created_at on public.eventin_contact_requests(created_at);
create index if not exists idx_eventin_gallery_images_event_type_created on public.eventin_gallery_images(event_id, gallery_type, created_at desc);

create or replace function public.eventin_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_event_types_updated_at on public.eventin_event_types;
create trigger trg_event_types_updated_at
before update on public.eventin_event_types
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_events_updated_at on public.eventin_events;
create trigger trg_events_updated_at
before update on public.eventin_events
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_event_settings_updated_at on public.eventin_event_settings;
create trigger trg_event_settings_updated_at
before update on public.eventin_event_settings
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.eventin_profiles;
create trigger trg_profiles_updated_at
before update on public.eventin_profiles
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_guest_responses_updated_at on public.eventin_guest_responses;
create trigger trg_guest_responses_updated_at
before update on public.eventin_guest_responses
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_guests_updated_at on public.eventin_guests;
create trigger trg_guests_updated_at
before update on public.eventin_guests
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_public_messages_updated_at on public.eventin_public_messages;
create trigger trg_public_messages_updated_at
before update on public.eventin_public_messages
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_gallery_settings_updated_at on public.eventin_gallery_settings;
create trigger trg_gallery_settings_updated_at
before update on public.eventin_gallery_settings
for each row execute function public.eventin_set_updated_at();

drop function if exists public.eventin_can_admin_event(uuid) cascade;
drop function if exists public.eventin_is_superadmin() cascade;
drop function if exists public.eventin_is_admin() cascade;
drop function if exists public.eventin_can_access_event(uuid) cascade;
drop function if exists public.eventin_can_access_event_code(text) cascade;
drop function if exists public.eventin_can_manage_event_image(text) cascade;
drop function if exists public.eventin_submit_guest_response(uuid, text, text, boolean, text) cascade;
drop function if exists public.eventin_submit_guest_response(uuid, text, text, boolean, text, integer, integer) cascade;
drop function if exists public.eventin_submit_public_message(uuid, text, text) cascade;
drop function if exists public.eventin_get_collaborative_gallery_link(uuid) cascade;
drop function if exists public.eventin_get_gallery_admin_settings(uuid) cascade;
drop function if exists public.eventin_manage_collaborative_gallery(uuid, boolean, text) cascade;
drop function if exists public.eventin_set_collaborative_gallery_available(uuid, boolean) cascade;
drop function if exists public.eventin_verify_collaborative_gallery_access(text, text) cascade;
drop function if exists public.eventin_get_guest_invitation(text) cascade;
drop function if exists public.eventin_submit_guest_token_response(text, boolean, integer, integer, text) cascade;
drop function if exists public.eventin_find_guest_by_phone(text, text) cascade;
drop function if exists public.eventin_submit_guest_phone_response(text, text, boolean, integer, integer, text) cascade;
drop function if exists public.eventin_generate_event_code() cascade;
drop function if exists eventin_private.is_admin() cascade;
drop function if exists eventin_private.can_access_event(uuid) cascade;
drop function if exists eventin_private.can_access_event_code(text) cascade;
drop function if exists eventin_private.generate_event_code() cascade;
drop function if exists eventin_private.submit_guest_response(uuid, text, text, boolean, text) cascade;
drop function if exists eventin_private.submit_guest_response(uuid, text, text, boolean, text, integer, integer) cascade;
drop function if exists eventin_private.submit_public_message(uuid, text, text) cascade;
drop function if exists eventin_private.get_collaborative_gallery_link(uuid) cascade;
drop function if exists eventin_private.get_gallery_admin_settings(uuid) cascade;
drop function if exists eventin_private.manage_collaborative_gallery(uuid, boolean, text) cascade;
drop function if exists eventin_private.set_collaborative_gallery_available(uuid, boolean) cascade;
drop function if exists eventin_private.verify_collaborative_gallery_access(text, text) cascade;
drop function if exists eventin_private.normalize_guest_phone(text) cascade;
drop function if exists eventin_private.find_guest_by_phone(text, text) cascade;
drop function if exists eventin_private.submit_guest_phone_response(text, text, boolean, integer, integer, text) cascade;
drop function if exists eventin_private.validate_guest_phones() cascade;
drop function if exists eventin_private.sync_guest_response() cascade;

create or replace function eventin_private.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.eventin_profiles
        where id = auth.uid()
          and role = 'admin'
    );
$$;

create or replace function eventin_private.can_access_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select eventin_private.is_admin()
        or exists (
            select 1
            from public.eventin_profiles
            join public.eventin_events on eventin_events.event_code = eventin_profiles.event_code
            where eventin_profiles.id = auth.uid()
              and eventin_profiles.role = 'user'
              and eventin_events.id = target_event_id
        );
$$;

create or replace function eventin_private.can_access_event_code(target_event_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select eventin_private.is_admin()
        or exists (
            select 1
            from public.eventin_profiles
            where eventin_profiles.id = auth.uid()
              and eventin_profiles.role = 'user'
              and eventin_profiles.event_code = target_event_code
        );
$$;

create or replace function eventin_private.generate_event_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    candidate text;
begin
    loop
        candidate := lpad(floor(random() * 1000000)::int::text, 6, '0');

        if not exists (
            select 1
            from public.eventin_events
            where event_code = candidate
        ) then
            return candidate;
        end if;
    end loop;
end;
$$;

create or replace function eventin_private.submit_public_message(
    p_event_id uuid,
    p_author_name text,
    p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    message_id uuid;
begin
    if coalesce(trim(p_author_name), '') = '' then
        raise exception 'Nombre obligatorio';
    end if;

    if coalesce(trim(p_message), '') = '' then
        raise exception 'Mensaje obligatorio';
    end if;

    if not exists (
        select 1
        from public.eventin_events
        where id = p_event_id
          and is_active = true
    ) then
        raise exception 'Evento no disponible';
    end if;

    insert into public.eventin_public_messages (event_id, author_name, message)
    values (p_event_id, trim(p_author_name), trim(p_message))
    returning id into message_id;

    return message_id;
end;
$$;

create or replace function public.eventin_submit_public_message(
    p_event_id uuid,
    p_author_name text,
    p_message text
)
returns uuid
language sql
security invoker
set search_path = public
as $$
    select eventin_private.submit_public_message(p_event_id, p_author_name, p_message);
$$;

grant execute on function public.eventin_submit_public_message(uuid, text, text) to anon, authenticated;

create or replace function eventin_private.get_collaborative_gallery_link(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
    select case
        when e.is_active and coalesce(s.collaborative_available, false) and coalesce(s.collaborative_enabled, false) then jsonb_build_object(
            'enabled', true,
            'token', s.collaborative_token
        )
        else jsonb_build_object('enabled', false)
    end
    from public.eventin_events e
    left join public.eventin_gallery_settings s on s.event_id = e.id
    where e.id = p_event_id;
$$;

create or replace function eventin_private.get_gallery_admin_settings(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    settings_record public.eventin_gallery_settings%rowtype;
begin
    if auth.uid() is null or not eventin_private.can_access_event(p_event_id) then
        raise exception 'Acceso no permitido';
    end if;

    select * into settings_record
    from public.eventin_gallery_settings
    where event_id = p_event_id;

    if not found then
        return jsonb_build_object('available', false, 'enabled', false, 'token', null);
    end if;

    return jsonb_build_object(
        'available', settings_record.collaborative_available,
        'enabled', settings_record.collaborative_enabled,
        'token', settings_record.collaborative_token
    );
end;
$$;

create or replace function eventin_private.manage_collaborative_gallery(
    p_event_id uuid,
    p_enabled boolean,
    p_access_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    settings_record public.eventin_gallery_settings%rowtype;
    clean_key text;
begin
    if auth.uid() is null or not eventin_private.can_access_event(p_event_id) then
        raise exception 'Acceso no permitido';
    end if;

    clean_key := nullif(trim(coalesce(p_access_key, '')), '');

    select * into settings_record
    from public.eventin_gallery_settings
    where event_id = p_event_id;

    if not found or not settings_record.collaborative_available then
        raise exception 'La galeria colaborativa no esta habilitada para este evento';
    end if;

    if p_enabled and settings_record.collaborative_key_hash is null and clean_key is null then
        raise exception 'Indica una clave para activar la galeria';
    end if;

    update public.eventin_gallery_settings
    set collaborative_enabled = coalesce(p_enabled, false),
        collaborative_key_hash = case
            when clean_key is null then collaborative_key_hash
            else extensions.crypt(clean_key, extensions.gen_salt('bf'))
        end
    where event_id = p_event_id
    returning * into settings_record;

    return jsonb_build_object(
        'enabled', settings_record.collaborative_enabled,
        'token', settings_record.collaborative_token
    );
end;
$$;

create or replace function eventin_private.set_collaborative_gallery_available(
    p_event_id uuid,
    p_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or not eventin_private.is_admin() then
        raise exception 'Acceso no permitido';
    end if;

    insert into public.eventin_gallery_settings (
        event_id,
        collaborative_available
    ) values (
        p_event_id,
        coalesce(p_available, false)
    )
    on conflict (event_id) do update
    set collaborative_available = excluded.collaborative_available,
        collaborative_enabled = case
            when excluded.collaborative_available then public.eventin_gallery_settings.collaborative_enabled
            else false
        end;
end;
$$;

create or replace function eventin_private.verify_collaborative_gallery_access(
    p_token text,
    p_access_key text
)
returns uuid
language sql
security definer
set search_path = public
as $$
    select s.event_id
    from public.eventin_gallery_settings s
    join public.eventin_events e on e.id = s.event_id
    where e.is_active = true
      and s.collaborative_available = true
      and s.collaborative_token = trim(coalesce(p_token, ''))
      and s.collaborative_key_hash is not null
      and extensions.crypt(coalesce(p_access_key, ''), s.collaborative_key_hash) = s.collaborative_key_hash
    limit 1;
$$;

create or replace function public.eventin_get_collaborative_gallery_link(p_event_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
    select eventin_private.get_collaborative_gallery_link(p_event_id);
$$;

create or replace function public.eventin_get_gallery_admin_settings(p_event_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
    select eventin_private.get_gallery_admin_settings(p_event_id);
$$;

create or replace function public.eventin_manage_collaborative_gallery(
    p_event_id uuid,
    p_enabled boolean,
    p_access_key text default null
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
    select eventin_private.manage_collaborative_gallery(p_event_id, p_enabled, p_access_key);
$$;

create or replace function public.eventin_set_collaborative_gallery_available(
    p_event_id uuid,
    p_available boolean
)
returns void
language sql
security invoker
set search_path = public
as $$
    select eventin_private.set_collaborative_gallery_available(p_event_id, p_available);
$$;

create or replace function public.eventin_verify_collaborative_gallery_access(
    p_token text,
    p_access_key text
)
returns uuid
language sql
security invoker
set search_path = public
as $$
    select eventin_private.verify_collaborative_gallery_access(p_token, p_access_key);
$$;

revoke execute on function eventin_private.get_collaborative_gallery_link(uuid) from public;
revoke execute on function eventin_private.get_gallery_admin_settings(uuid) from public, anon;
revoke execute on function eventin_private.manage_collaborative_gallery(uuid, boolean, text) from public, anon;
revoke execute on function eventin_private.set_collaborative_gallery_available(uuid, boolean) from public, anon, authenticated;
revoke execute on function eventin_private.verify_collaborative_gallery_access(text, text) from public;
grant execute on function eventin_private.get_collaborative_gallery_link(uuid) to anon, authenticated;
grant execute on function eventin_private.get_gallery_admin_settings(uuid) to authenticated;
grant execute on function eventin_private.manage_collaborative_gallery(uuid, boolean, text) to authenticated;
grant execute on function eventin_private.set_collaborative_gallery_available(uuid, boolean) to authenticated;
grant execute on function eventin_private.verify_collaborative_gallery_access(text, text) to anon, authenticated, service_role;
revoke execute on function public.eventin_get_collaborative_gallery_link(uuid) from public;
revoke execute on function public.eventin_get_gallery_admin_settings(uuid) from public, anon;
revoke execute on function public.eventin_manage_collaborative_gallery(uuid, boolean, text) from public, anon;
revoke execute on function public.eventin_set_collaborative_gallery_available(uuid, boolean) from public, anon;
revoke execute on function public.eventin_verify_collaborative_gallery_access(text, text) from public;
grant execute on function public.eventin_get_collaborative_gallery_link(uuid) to anon, authenticated;
grant execute on function public.eventin_get_gallery_admin_settings(uuid) to authenticated;
grant execute on function public.eventin_manage_collaborative_gallery(uuid, boolean, text) to authenticated;
grant execute on function public.eventin_set_collaborative_gallery_available(uuid, boolean) to authenticated;
grant execute on function public.eventin_verify_collaborative_gallery_access(text, text) to anon, authenticated, service_role;

create or replace function eventin_private.normalize_guest_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
    digits text;
begin
    digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
    if digits like '0034%' then
        digits := substr(digits, 5);
    elsif length(digits) > 9 and digits like '34%' then
        digits := substr(digits, 3);
    end if;
    return nullif(digits, '');
end;
$$;

create or replace function eventin_private.validate_guest_phones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    phones text[];
begin
    perform pg_advisory_xact_lock(hashtextextended(new.event_id::text, 0));
    new.phone1 := eventin_private.normalize_guest_phone(new.phone1);
    new.phone2 := eventin_private.normalize_guest_phone(new.phone2);
    new.phone3 := eventin_private.normalize_guest_phone(new.phone3);
    new.phone4 := eventin_private.normalize_guest_phone(new.phone4);
    phones := array_remove(array[new.phone1, new.phone2, new.phone3, new.phone4], null);

    if cardinality(phones) <> (select count(distinct phone) from unnest(phones) as phone) then
        raise exception 'Un telefono no puede repetirse en el mismo invitado';
    end if;

    if exists (
        select 1
        from public.eventin_guests g
        where g.event_id = new.event_id
          and g.id is distinct from new.id
          and array_remove(array[g.phone1, g.phone2, g.phone3, g.phone4], null) && phones
    ) then
        raise exception 'El telefono ya pertenece a otro invitado de este evento';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_validate_guest_phones on public.eventin_guests;
create trigger trg_validate_guest_phones
before insert or update of event_id, phone1, phone2, phone3, phone4 on public.eventin_guests
for each row execute function eventin_private.validate_guest_phones();

create or replace function eventin_private.sync_guest_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    response_id uuid;
    response_phone text;
begin
    if new.will_attend is null then
        delete from public.eventin_guest_responses where guest_id = new.id;
        return new;
    end if;

    response_phone := coalesce(new.phone1, new.phone2, new.phone3, new.phone4);
    update public.eventin_guest_responses
    set event_id = new.event_id,
        nombre = new.name,
        telefono = response_phone,
        asistencia = new.will_attend,
        adults_count = new.adults_count,
        children_count = new.children_count,
        mensaje = new.message,
        updated_at = now()
    where guest_id = new.id
    returning id into response_id;

    if response_id is null then
        insert into public.eventin_guest_responses (
            event_id, guest_id, nombre, telefono, asistencia, adults_count, children_count, mensaje
        ) values (
            new.event_id, new.id, new.name, response_phone, new.will_attend,
            new.adults_count, new.children_count, new.message
        );
    end if;
    return new;
end;
$$;

update public.eventin_guests guest
set will_attend = response.asistencia,
    adults_count = response.adults_count,
    children_count = response.children_count,
    message = coalesce(guest.message, response.mensaje),
    responded_at = coalesce(guest.responded_at, response.updated_at),
    invitation_status = case when response.asistencia then 'confirmed' else 'declined' end
from (
    select distinct on (guest_id)
        guest_id, asistencia, adults_count, children_count, mensaje, updated_at
    from public.eventin_guest_responses
    where guest_id is not null
    order by guest_id, updated_at desc
) response
where guest.id = response.guest_id;

update public.eventin_guests
set phone1 = phone1,
    phone2 = phone2,
    phone3 = phone3,
    phone4 = phone4;

drop trigger if exists trg_sync_guest_response on public.eventin_guests;
create trigger trg_sync_guest_response
after insert or update of event_id, name, phone1, phone2, phone3, phone4, adults_count, children_count, will_attend, message
on public.eventin_guests
for each row execute function eventin_private.sync_guest_response();

create or replace function eventin_private.find_guest_by_phone(p_event_key text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_phone text;
    guest_record public.eventin_guests%rowtype;
    event_record public.eventin_events%rowtype;
    settings_record public.eventin_event_settings%rowtype;
begin
    normalized_phone := eventin_private.normalize_guest_phone(p_phone);
    if normalized_phone is null then
        return null;
    end if;

    select * into event_record
    from public.eventin_events
    where is_active = true
      and (public_slug = trim(p_event_key) or event_code = trim(p_event_key))
    limit 1;
    if not found then
        return null;
    end if;

    select * into guest_record
    from public.eventin_guests
    where event_id = event_record.id
      and normalized_phone = any(array[phone1, phone2, phone3, phone4])
    limit 1;
    if not found then
        return null;
    end if;

    update public.eventin_guests
    set viewed_at = coalesce(viewed_at, now()),
        invitation_status = case when invitation_status = 'pending' then 'viewed' else invitation_status end
    where id = guest_record.id
    returning * into guest_record;

    select * into settings_record
    from public.eventin_event_settings
    where event_id = event_record.id;

    return jsonb_build_object(
        'guest', jsonb_build_object(
            'name', guest_record.name,
            'adults_count', guest_record.adults_count,
            'children_count', guest_record.children_count,
            'will_attend', guest_record.will_attend,
            'message', guest_record.message,
            'invitation_status', guest_record.invitation_status
        ),
        'event', jsonb_build_object(
            'id', event_record.id,
            'title', event_record.title,
            'event_date', event_record.event_date,
            'public_slug', event_record.public_slug,
            'event_code', event_record.event_code
        ),
        'settings', jsonb_build_object(
            'detail_image_url', settings_record.detail_image_url
        )
    );
end;
$$;

create or replace function eventin_private.submit_guest_phone_response(
    p_event_key text,
    p_phone text,
    p_will_attend boolean,
    p_adults_count integer,
    p_children_count integer,
    p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_phone text;
    guest_record public.eventin_guests%rowtype;
    event_id_value uuid;
    response_id uuid;
begin
    normalized_phone := eventin_private.normalize_guest_phone(p_phone);
    if normalized_phone is null or p_adults_count < 0 or p_children_count < 0 then
        raise exception 'Datos de respuesta no validos';
    end if;

    select id into event_id_value
    from public.eventin_events
    where is_active = true
      and (public_slug = trim(p_event_key) or event_code = trim(p_event_key))
    limit 1;

    select * into guest_record
    from public.eventin_guests
    where event_id = event_id_value
      and normalized_phone = any(array[phone1, phone2, phone3, phone4])
    limit 1;
    if not found then
        raise exception 'Invitacion no encontrada';
    end if;

    update public.eventin_guests
    set adults_count = coalesce(p_adults_count, 0),
        children_count = coalesce(p_children_count, 0),
        will_attend = p_will_attend,
        message = nullif(trim(coalesce(p_message, '')), ''),
        invitation_status = case when p_will_attend then 'confirmed' else 'declined' end,
        responded_at = now()
    where id = guest_record.id
    returning * into guest_record;

    select id into response_id
    from public.eventin_guest_responses
    where guest_id = guest_record.id;
    return response_id;
end;
$$;

create or replace function public.eventin_find_guest_by_phone(p_event_key text, p_phone text)
returns jsonb
language sql
security invoker
set search_path = public
as $$ select eventin_private.find_guest_by_phone(p_event_key, p_phone); $$;

create or replace function public.eventin_submit_guest_phone_response(
    p_event_key text,
    p_phone text,
    p_will_attend boolean,
    p_adults_count integer,
    p_children_count integer,
    p_message text default null
)
returns uuid
language sql
security invoker
set search_path = public
as $$
    select eventin_private.submit_guest_phone_response(
        p_event_key, p_phone, p_will_attend, p_adults_count, p_children_count, p_message
    );
$$;

revoke execute on function eventin_private.normalize_guest_phone(text) from public;
revoke execute on function eventin_private.validate_guest_phones() from public;
revoke execute on function eventin_private.sync_guest_response() from public;
revoke execute on function eventin_private.find_guest_by_phone(text, text) from public;
revoke execute on function eventin_private.submit_guest_phone_response(text, text, boolean, integer, integer, text) from public;
revoke execute on function public.eventin_find_guest_by_phone(text, text) from public;
revoke execute on function public.eventin_submit_guest_phone_response(text, text, boolean, integer, integer, text) from public;
grant execute on function eventin_private.find_guest_by_phone(text, text) to anon, authenticated;
grant execute on function eventin_private.submit_guest_phone_response(text, text, boolean, integer, integer, text) to anon, authenticated;
grant execute on function public.eventin_find_guest_by_phone(text, text) to anon, authenticated;
grant execute on function public.eventin_submit_guest_phone_response(text, text, boolean, integer, integer, text) to anon, authenticated;

create or replace function public.eventin_can_manage_event_image(target_event_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.eventin_profiles
        where id = auth.uid()
          and role = 'admin'
    )
    or exists (
        select 1
        from public.eventin_profiles
        where id = auth.uid()
          and role = 'user'
          and event_code = target_event_code
    );
$$;

grant execute on function public.eventin_can_manage_event_image(text) to authenticated;

revoke execute on function public.eventin_set_updated_at() from public, anon, authenticated;

revoke execute on function eventin_private.is_admin() from public;
grant execute on function eventin_private.is_admin() to authenticated;

revoke execute on function eventin_private.can_access_event(uuid) from public;
grant execute on function eventin_private.can_access_event(uuid) to authenticated;

revoke execute on function eventin_private.can_access_event_code(text) from public;
grant execute on function eventin_private.can_access_event_code(text) to authenticated;

revoke execute on function eventin_private.generate_event_code() from public, anon, authenticated;

revoke execute on function eventin_private.submit_public_message(uuid, text, text) from public;
grant execute on function eventin_private.submit_public_message(uuid, text, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'eventin-images',
    'eventin-images',
    true,
    3145728,
    array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'eventin-gallery',
    'eventin-gallery',
    false,
    512000,
    array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.eventin_event_types enable row level security;
alter table public.eventin_events enable row level security;
alter table public.eventin_event_settings enable row level security;
alter table public.eventin_profiles enable row level security;
alter table public.eventin_guests enable row level security;
alter table public.eventin_guest_responses enable row level security;
alter table public.eventin_public_messages enable row level security;
alter table public.eventin_contact_requests enable row level security;
alter table public.eventin_gallery_settings enable row level security;
alter table public.eventin_gallery_images enable row level security;

drop policy if exists "Public can read event types" on public.eventin_event_types;
create policy "Public can read event types"
on public.eventin_event_types for select
using (true);

drop policy if exists "Admins can manage event types" on public.eventin_event_types;
create policy "Admins can manage event types"
on public.eventin_event_types for all
to authenticated
using (eventin_private.is_admin())
with check (eventin_private.is_admin());

drop policy if exists "Public can read active events" on public.eventin_events;
create policy "Public can read active events"
on public.eventin_events for select
using (is_active = true);

drop policy if exists "Admins can manage events" on public.eventin_events;
create policy "Admins can manage events"
on public.eventin_events for all
to authenticated
using (eventin_private.is_admin())
with check (eventin_private.is_admin());

drop policy if exists "Users can read assigned events" on public.eventin_events;
create policy "Users can read assigned events"
on public.eventin_events for select
to authenticated
using (eventin_private.can_access_event(id));

drop policy if exists "Users can update assigned events" on public.eventin_events;
create policy "Users can update assigned events"
on public.eventin_events for update
to authenticated
using (eventin_private.can_access_event(id))
with check (eventin_private.can_access_event(id));

drop policy if exists "Public can read active event settings" on public.eventin_event_settings;
create policy "Public can read active event settings"
on public.eventin_event_settings for select
using (
    exists (
        select 1 from public.eventin_events
        where eventin_events.id = eventin_event_settings.event_id
          and eventin_events.is_active = true
    )
);

drop policy if exists "Users can manage assigned event settings" on public.eventin_event_settings;
create policy "Users can manage assigned event settings"
on public.eventin_event_settings for all
to authenticated
using (eventin_private.can_access_event(event_id))
with check (eventin_private.can_access_event(event_id));

drop policy if exists "Users can read own profile" on public.eventin_profiles;
create policy "Users can read own profile"
on public.eventin_profiles for select
to authenticated
using (id = auth.uid() or eventin_private.is_admin());

drop policy if exists "Admins can manage profiles" on public.eventin_profiles;
create policy "Admins can manage profiles"
on public.eventin_profiles for all
to authenticated
using (eventin_private.is_admin())
with check (eventin_private.is_admin());

drop policy if exists "Users can manage assigned guest responses" on public.eventin_guest_responses;
create policy "Users can manage assigned guest responses"
on public.eventin_guest_responses for all
to authenticated
using (eventin_private.can_access_event(event_id))
with check (eventin_private.can_access_event(event_id));

drop policy if exists "Users can manage assigned guests" on public.eventin_guests;
create policy "Users can manage assigned guests"
on public.eventin_guests for all
to authenticated
using (eventin_private.can_access_event(event_id))
with check (eventin_private.can_access_event(event_id));

drop policy if exists "Public can insert guest responses" on public.eventin_guest_responses;
drop policy if exists "Public can update guest responses by event phone" on public.eventin_guest_responses;

drop policy if exists "Public can insert messages" on public.eventin_public_messages;
create policy "Public can insert messages"
on public.eventin_public_messages for insert
to anon
with check (
    author_name <> ''
    and message <> ''
    and exists (
        select 1 from public.eventin_events
        where eventin_events.id = eventin_public_messages.event_id
          and eventin_events.is_active = true
    )
);

drop policy if exists "Users can manage assigned messages" on public.eventin_public_messages;
create policy "Users can manage assigned messages"
on public.eventin_public_messages for all
to authenticated
using (eventin_private.can_access_event(event_id))
with check (eventin_private.can_access_event(event_id));

drop policy if exists "Public can insert contact requests" on public.eventin_contact_requests;
create policy "Public can insert contact requests"
on public.eventin_contact_requests for insert
with check (
    nombre <> ''
    and email <> ''
    and asunto <> ''
    and mensaje <> ''
);

drop policy if exists "Admins can read contact requests" on public.eventin_contact_requests;
create policy "Admins can read contact requests"
on public.eventin_contact_requests for select
to authenticated
using (eventin_private.is_admin());

drop policy if exists "Admins can delete contact requests" on public.eventin_contact_requests;
create policy "Admins can delete contact requests"
on public.eventin_contact_requests for delete
to authenticated
using (eventin_private.is_admin());

drop policy if exists "Public can read event images" on storage.objects;

drop policy if exists "Users can read assigned event images" on storage.objects;
create policy "Users can read assigned event images"
on storage.objects for select
to authenticated
using (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_manage_event_image((storage.foldername(name))[2])
);

drop policy if exists "Users can upload assigned event images" on storage.objects;
create policy "Users can upload assigned event images"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_manage_event_image((storage.foldername(name))[2])
);

drop policy if exists "Users can update assigned event images" on storage.objects;
create policy "Users can update assigned event images"
on storage.objects for update
to authenticated
using (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_manage_event_image((storage.foldername(name))[2])
)
with check (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_manage_event_image((storage.foldername(name))[2])
);

drop policy if exists "Users can delete assigned event images" on storage.objects;
create policy "Users can delete assigned event images"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_manage_event_image((storage.foldername(name))[2])
);

update public.eventin_events
set public_slug = 'evento-' || substring(id::text from 1 for 8)
where public_slug is null or public_slug = '';

update public.eventin_events
set event_code = eventin_private.generate_event_code()
where event_code is null or event_code = '';

alter table public.eventin_events alter column public_slug set not null;
alter table public.eventin_events alter column event_code set not null;

insert into public.eventin_events (
    id,
    title,
    public_slug,
    event_code,
    event_type,
    event_date,
    location_name,
    maps_url
) values (
    '11111111-1111-1111-1111-111111111111',
    'Mi Primera Comunion',
    'primera-comunion-demo',
    '100001',
    'communion',
    '2027-05-15 14:00:00+02',
    'Por confirmar',
    'https://www.google.com/maps'
) on conflict do nothing;

insert into public.eventin_event_settings (
    event_id,
    main_title,
    subtitle,
    display_date,
    display_time,
    presentation_title,
    presentation_text,
    palette_key
) values (
    '11111111-1111-1111-1111-111111111111',
    'Mi Primera Comunion',
    'Un día para compartir',
    'Sabado, 15 de mayo de 2027',
    '14:00',
    'Un recuerdo para siempre',
    'Hay momentos que quedan grabados en el corazón para toda la vida. Nos gustaría celebrarlo contigo y guardar juntos este hermoso recuerdo.',
    'clasica'
) on conflict do nothing;
