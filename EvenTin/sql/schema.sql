-- EvenTin: estructura base para eventos y usuarios.
-- Ejecutar desde Supabase SQL Editor. No guardar nunca service_role keys en frontend.

create extension if not exists pgcrypto;

create schema if not exists eventin_private;
revoke all on schema eventin_private from public;
grant usage on schema eventin_private to anon, authenticated;

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
    updated_at timestamptz not null default now(),
    unique (event_id, telefono)
);

create table if not exists public.eventin_guests (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventin_events(id) on delete cascade,
    name text not null,
    phone text,
    email text,
    adults_count integer not null default 1,
    children_count integer not null default 0,
    notes text,
    invitation_token text unique not null default encode(gen_random_bytes(24), 'hex'),
    invitation_status text not null default 'pending',
    opened_at timestamptz,
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
    uploaded_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.eventin_events add column if not exists public_slug text;
alter table public.eventin_events add column if not exists event_code text;
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

    alter table public.eventin_guests
    add constraint eventin_guests_status_check
    check (invitation_status in ('pending', 'opened', 'confirmed', 'declined'));
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
create index if not exists idx_eventin_guests_event_id on public.eventin_guests(event_id);
create index if not exists idx_eventin_guests_event_phone on public.eventin_guests(event_id, phone);
create unique index if not exists idx_eventin_guests_invitation_token on public.eventin_guests(invitation_token);
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
drop function if exists public.eventin_verify_collaborative_gallery_access(text, text) cascade;
drop function if exists public.eventin_get_guest_invitation(text) cascade;
drop function if exists public.eventin_submit_guest_token_response(text, boolean, integer, integer, text) cascade;
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
drop function if exists eventin_private.verify_collaborative_gallery_access(text, text) cascade;

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

create or replace function eventin_private.submit_guest_response(
    p_event_id uuid,
    p_nombre text,
    p_telefono text,
    p_asistencia boolean,
    p_mensaje text default null,
    p_adults_count integer default 1,
    p_children_count integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    guest_record public.eventin_guests%rowtype;
    response_id uuid;
    normalized_phone text;
begin
    if coalesce(trim(p_nombre), '') = '' then
        raise exception 'Nombre obligatorio';
    end if;

    normalized_phone := nullif(trim(coalesce(p_telefono, '')), '');

    if coalesce(trim(p_telefono), '') = '' then
        raise exception 'Telefono obligatorio';
    end if;

    if p_adults_count < 0 or p_children_count < 0 then
        raise exception 'Numero de invitados no valido';
    end if;

    if not exists (
        select 1
        from public.eventin_events
        where id = p_event_id
          and is_active = true
    ) then
        raise exception 'Evento no disponible';
    end if;

    select *
    into guest_record
    from public.eventin_guests
    where event_id = p_event_id
      and (
          phone = normalized_phone
          or nullif(regexp_replace(coalesce(phone, ''), '[^\d+]', '', 'g'), '') = normalized_phone
      )
    limit 1;

    if not found then
        insert into public.eventin_guests (
            event_id,
            name,
            phone,
            adults_count,
            children_count,
            invitation_status
        ) values (
            p_event_id,
            trim(p_nombre),
            normalized_phone,
            coalesce(p_adults_count, 0),
            coalesce(p_children_count, 0),
            case when p_asistencia then 'confirmed' else 'declined' end
        )
        returning * into guest_record;
    else
        update public.eventin_guests
        set adults_count = coalesce(p_adults_count, 0),
            children_count = coalesce(p_children_count, 0),
            invitation_status = case when p_asistencia then 'confirmed' else 'declined' end
        where id = guest_record.id
        returning * into guest_record;
    end if;

    insert into public.eventin_guest_responses (
        event_id,
        guest_id,
        nombre,
        telefono,
        asistencia,
        adults_count,
        children_count,
        mensaje
    ) values (
        p_event_id,
        guest_record.id,
        guest_record.name,
        normalized_phone,
        p_asistencia,
        coalesce(p_adults_count, 0),
        coalesce(p_children_count, 0),
        nullif(trim(coalesce(p_mensaje, '')), '')
    )
    on conflict (event_id, telefono) do update set
        guest_id = excluded.guest_id,
        asistencia = excluded.asistencia,
        adults_count = excluded.adults_count,
        children_count = excluded.children_count,
        mensaje = excluded.mensaje,
        updated_at = now()
    returning id into response_id;

    return response_id;
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

create or replace function public.eventin_submit_guest_response(
    p_event_id uuid,
    p_nombre text,
    p_telefono text,
    p_asistencia boolean,
    p_mensaje text default null,
    p_adults_count integer default 1,
    p_children_count integer default 0
)
returns uuid
language sql
security invoker
set search_path = public
as $$
    select eventin_private.submit_guest_response(
        p_event_id,
        p_nombre,
        p_telefono,
        p_asistencia,
        p_mensaje,
        p_adults_count,
        p_children_count
    );
$$;

grant execute on function public.eventin_submit_guest_response(uuid, text, text, boolean, text, integer, integer) to anon, authenticated;

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
        when e.is_active and coalesce(s.collaborative_enabled, false) then jsonb_build_object(
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
        return jsonb_build_object('enabled', false, 'token', null);
    end if;

    return jsonb_build_object(
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

    if not found then
        if p_enabled and clean_key is null then
            raise exception 'Indica una clave para activar la galeria';
        end if;

        insert into public.eventin_gallery_settings (
            event_id,
            collaborative_enabled,
            collaborative_key_hash
        ) values (
            p_event_id,
            coalesce(p_enabled, false),
            case when clean_key is null then null else extensions.crypt(clean_key, extensions.gen_salt('bf')) end
        )
        returning * into settings_record;
    else
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
    end if;

    return jsonb_build_object(
        'enabled', settings_record.collaborative_enabled,
        'token', settings_record.collaborative_token
    );
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
    where s.collaborative_enabled = true
      and e.is_active = true
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
revoke execute on function eventin_private.verify_collaborative_gallery_access(text, text) from public;
grant execute on function eventin_private.get_collaborative_gallery_link(uuid) to anon, authenticated;
grant execute on function eventin_private.get_gallery_admin_settings(uuid) to authenticated;
grant execute on function eventin_private.manage_collaborative_gallery(uuid, boolean, text) to authenticated;
grant execute on function eventin_private.verify_collaborative_gallery_access(text, text) to anon, authenticated, service_role;
revoke execute on function public.eventin_get_collaborative_gallery_link(uuid) from public;
revoke execute on function public.eventin_get_gallery_admin_settings(uuid) from public, anon;
revoke execute on function public.eventin_manage_collaborative_gallery(uuid, boolean, text) from public, anon;
revoke execute on function public.eventin_verify_collaborative_gallery_access(text, text) from public;
grant execute on function public.eventin_get_collaborative_gallery_link(uuid) to anon, authenticated;
grant execute on function public.eventin_get_gallery_admin_settings(uuid) to authenticated;
grant execute on function public.eventin_manage_collaborative_gallery(uuid, boolean, text) to authenticated;
grant execute on function public.eventin_verify_collaborative_gallery_access(text, text) to anon, authenticated, service_role;

create or replace function public.eventin_get_guest_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    payload jsonb;
    guest_record public.eventin_guests%rowtype;
begin
    select *
    into guest_record
    from public.eventin_guests
    where invitation_token = p_token;

    if not found then
        return null;
    end if;

    if not exists (
        select 1
        from public.eventin_events
        where id = guest_record.event_id
          and is_active = true
    ) then
        return null;
    end if;

    if guest_record.opened_at is null then
        update public.eventin_guests
        set opened_at = now(),
            invitation_status = case when invitation_status = 'pending' then 'opened' else invitation_status end
        where id = guest_record.id
        returning * into guest_record;
    end if;

    select jsonb_build_object(
        'guest', jsonb_build_object(
            'id', guest_record.id,
            'name', guest_record.name,
            'adults_count', guest_record.adults_count,
            'children_count', guest_record.children_count,
            'invitation_status', guest_record.invitation_status
        ),
        'event', jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'event_date', e.event_date,
            'public_slug', e.public_slug,
            'event_code', e.event_code
        ),
        'settings', jsonb_build_object(
            'display_date', s.display_date,
            'display_time', s.display_time,
            'detail_image_url', s.detail_image_url
        )
    )
    into payload
    from public.eventin_events e
    left join public.eventin_event_settings s on s.event_id = e.id
    where e.id = guest_record.event_id
      and e.is_active = true;

    return payload;
end;
$$;

create or replace function public.eventin_submit_guest_token_response(
    p_token text,
    p_asistencia boolean,
    p_adults_count integer,
    p_children_count integer,
    p_mensaje text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    guest_record public.eventin_guests%rowtype;
    response_id uuid;
    response_phone text;
begin
    select *
    into guest_record
    from public.eventin_guests
    where invitation_token = p_token;

    if not found then
        raise exception 'Invitacion no encontrada';
    end if;

    if not exists (
        select 1
        from public.eventin_events
        where id = guest_record.event_id
          and is_active = true
    ) then
        raise exception 'Evento no disponible';
    end if;

    if p_adults_count < 0 or p_children_count < 0 then
        raise exception 'Numero de invitados no valido';
    end if;

    update public.eventin_guests
    set invitation_status = case when p_asistencia then 'confirmed' else 'declined' end,
        adults_count = coalesce(p_adults_count, 0),
        children_count = coalesce(p_children_count, 0)
    where id = guest_record.id;

    response_phone := nullif(trim(coalesce(guest_record.phone, '')), '');

    update public.eventin_guest_responses
    set nombre = guest_record.name,
        telefono = response_phone,
        asistencia = p_asistencia,
        adults_count = coalesce(p_adults_count, 0),
        children_count = coalesce(p_children_count, 0),
        mensaje = nullif(trim(coalesce(p_mensaje, '')), ''),
        updated_at = now()
    where guest_id = guest_record.id
    returning id into response_id;

    if response_id is not null then
        return response_id;
    end if;

    insert into public.eventin_guest_responses (
        event_id,
        guest_id,
        nombre,
        telefono,
        asistencia,
        adults_count,
        children_count,
        mensaje
    ) values (
        guest_record.event_id,
        guest_record.id,
        guest_record.name,
        response_phone,
        p_asistencia,
        coalesce(p_adults_count, 0),
        coalesce(p_children_count, 0),
        nullif(trim(coalesce(p_mensaje, '')), '')
    )
    on conflict (event_id, telefono) do update set
        guest_id = excluded.guest_id,
        nombre = excluded.nombre,
        asistencia = excluded.asistencia,
        adults_count = excluded.adults_count,
        children_count = excluded.children_count,
        mensaje = excluded.mensaje,
        updated_at = now()
    returning id into response_id;

    return response_id;
end;
$$;

grant execute on function public.eventin_get_guest_invitation(text) to anon, authenticated;
grant execute on function public.eventin_submit_guest_token_response(text, boolean, integer, integer, text) to anon, authenticated;

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

revoke execute on function eventin_private.submit_guest_response(uuid, text, text, boolean, text, integer, integer) from public;
grant execute on function eventin_private.submit_guest_response(uuid, text, text, boolean, text, integer, integer) to anon, authenticated;

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
