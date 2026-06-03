-- EvenTin: estructura base para eventos y usuarios.
-- Ejecutar desde Supabase SQL Editor. No guardar nunca service_role keys en frontend.

create extension if not exists pgcrypto;

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
    subtitle text,
    display_date text,
    display_time text,
    presentation_title text,
    presentation_text text,
    hero_image_url text,
    detail_image_url text,
    palette_key text not null default 'earth',
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
    nombre text not null,
    telefono text not null,
    asistencia boolean not null,
    mensaje text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (event_id, telefono)
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

alter table public.eventin_events add column if not exists public_slug text;
alter table public.eventin_events add column if not exists event_code text;
alter table public.eventin_events add column if not exists event_type text not null default 'communion';
alter table public.eventin_event_settings add column if not exists palette_key text not null default 'earth';
alter table public.eventin_profiles add column if not exists email text;
alter table public.eventin_profiles add column if not exists event_code text;

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
        select 1 from pg_constraint where conname = 'eventin_profiles_event_code_check'
    ) then
        alter table public.eventin_profiles drop constraint eventin_profiles_event_code_check;
    end if;

    alter table public.eventin_profiles
    add constraint eventin_profiles_event_code_check
    check (event_code is null or event_code ~ '^[0-9]{6}$');
end;
$$;

create index if not exists idx_eventin_events_public_slug on public.eventin_events(public_slug);
create index if not exists idx_eventin_events_event_code on public.eventin_events(event_code);
create index if not exists idx_eventin_events_event_type on public.eventin_events(event_type);
create unique index if not exists idx_eventin_profiles_email_unique on public.eventin_profiles(email) where email is not null;
create index if not exists idx_eventin_profiles_event_code on public.eventin_profiles(event_code);
create index if not exists idx_eventin_guest_responses_event_id on public.eventin_guest_responses(event_id);
create index if not exists idx_eventin_guest_responses_event_phone on public.eventin_guest_responses(event_id, telefono);
create index if not exists idx_eventin_public_messages_event_id on public.eventin_public_messages(event_id);
create index if not exists idx_eventin_contact_requests_created_at on public.eventin_contact_requests(created_at);

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

drop trigger if exists trg_public_messages_updated_at on public.eventin_public_messages;
create trigger trg_public_messages_updated_at
before update on public.eventin_public_messages
for each row execute function public.eventin_set_updated_at();

drop function if exists public.eventin_can_admin_event(uuid) cascade;
drop function if exists public.eventin_is_superadmin() cascade;

create or replace function public.eventin_is_admin()
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

create or replace function public.eventin_can_access_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.eventin_is_admin()
        or exists (
            select 1
            from public.eventin_profiles
            join public.eventin_events on eventin_events.event_code = eventin_profiles.event_code
            where eventin_profiles.id = auth.uid()
              and eventin_profiles.role = 'user'
              and eventin_events.id = target_event_id
        );
$$;

create or replace function public.eventin_can_access_event_code(target_event_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.eventin_is_admin()
        or exists (
            select 1
            from public.eventin_profiles
            where eventin_profiles.id = auth.uid()
              and eventin_profiles.role = 'user'
              and eventin_profiles.event_code = target_event_code
        );
$$;

create or replace function public.eventin_generate_event_code()
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

create or replace function public.eventin_submit_guest_response(
    p_event_id uuid,
    p_nombre text,
    p_telefono text,
    p_asistencia boolean,
    p_mensaje text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    response_id uuid;
begin
    if coalesce(trim(p_nombre), '') = '' then
        raise exception 'Nombre obligatorio';
    end if;

    if coalesce(trim(p_telefono), '') = '' then
        raise exception 'Telefono obligatorio';
    end if;

    if not exists (
        select 1
        from public.eventin_events
        where id = p_event_id
          and is_active = true
    ) then
        raise exception 'Evento no disponible';
    end if;

    insert into public.eventin_guest_responses (
        event_id,
        nombre,
        telefono,
        asistencia,
        mensaje
    ) values (
        p_event_id,
        trim(p_nombre),
        trim(p_telefono),
        p_asistencia,
        nullif(trim(coalesce(p_mensaje, '')), '')
    )
    on conflict (event_id, telefono) do update set
        nombre = excluded.nombre,
        asistencia = excluded.asistencia,
        mensaje = excluded.mensaje,
        updated_at = now()
    returning id into response_id;

    return response_id;
end;
$$;

grant execute on function public.eventin_submit_guest_response(uuid, text, text, boolean, text) to anon;

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

alter table public.eventin_event_types enable row level security;
alter table public.eventin_events enable row level security;
alter table public.eventin_event_settings enable row level security;
alter table public.eventin_profiles enable row level security;
alter table public.eventin_guest_responses enable row level security;
alter table public.eventin_public_messages enable row level security;
alter table public.eventin_contact_requests enable row level security;

drop policy if exists "Public can read event types" on public.eventin_event_types;
create policy "Public can read event types"
on public.eventin_event_types for select
using (true);

drop policy if exists "Admins can manage event types" on public.eventin_event_types;
create policy "Admins can manage event types"
on public.eventin_event_types for all
to authenticated
using (public.eventin_is_admin())
with check (public.eventin_is_admin());

drop policy if exists "Public can read active events" on public.eventin_events;
create policy "Public can read active events"
on public.eventin_events for select
using (is_active = true);

drop policy if exists "Admins can manage events" on public.eventin_events;
create policy "Admins can manage events"
on public.eventin_events for all
to authenticated
using (public.eventin_is_admin())
with check (public.eventin_is_admin());

drop policy if exists "Users can read assigned events" on public.eventin_events;
create policy "Users can read assigned events"
on public.eventin_events for select
to authenticated
using (public.eventin_can_access_event(id));

drop policy if exists "Users can update assigned events" on public.eventin_events;
create policy "Users can update assigned events"
on public.eventin_events for update
to authenticated
using (public.eventin_can_access_event(id))
with check (public.eventin_can_access_event(id));

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
using (public.eventin_can_access_event(event_id))
with check (public.eventin_can_access_event(event_id));

drop policy if exists "Users can read own profile" on public.eventin_profiles;
create policy "Users can read own profile"
on public.eventin_profiles for select
to authenticated
using (id = auth.uid() or public.eventin_is_admin());

drop policy if exists "Admins can manage profiles" on public.eventin_profiles;
create policy "Admins can manage profiles"
on public.eventin_profiles for all
to authenticated
using (public.eventin_is_admin())
with check (public.eventin_is_admin());

drop policy if exists "Users can manage assigned guest responses" on public.eventin_guest_responses;
create policy "Users can manage assigned guest responses"
on public.eventin_guest_responses for all
to authenticated
using (public.eventin_can_access_event(event_id))
with check (public.eventin_can_access_event(event_id));

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
using (public.eventin_can_access_event(event_id))
with check (public.eventin_can_access_event(event_id));

drop policy if exists "Public can insert contact requests" on public.eventin_contact_requests;
create policy "Public can insert contact requests"
on public.eventin_contact_requests for insert
to anon
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
using (public.eventin_is_admin());

drop policy if exists "Public can read event images" on storage.objects;
create policy "Public can read event images"
on storage.objects for select
using (bucket_id = 'eventin-images');

drop policy if exists "Users can upload assigned event images" on storage.objects;
create policy "Users can upload assigned event images"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_access_event_code((storage.foldername(name))[2])
);

drop policy if exists "Users can update assigned event images" on storage.objects;
create policy "Users can update assigned event images"
on storage.objects for update
to authenticated
using (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_access_event_code((storage.foldername(name))[2])
)
with check (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_access_event_code((storage.foldername(name))[2])
);

drop policy if exists "Users can delete assigned event images" on storage.objects;
create policy "Users can delete assigned event images"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'eventin-images'
    and (storage.foldername(name))[1] = 'events'
    and public.eventin_can_access_event_code((storage.foldername(name))[2])
);

update public.eventin_events
set public_slug = 'evento-' || substring(id::text from 1 for 8)
where public_slug is null or public_slug = '';

update public.eventin_events
set event_code = public.eventin_generate_event_code()
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
) on conflict (id) do update set
    title = excluded.title,
    public_slug = excluded.public_slug,
    event_code = excluded.event_code,
    event_type = excluded.event_type,
    event_date = excluded.event_date,
    location_name = excluded.location_name,
    maps_url = excluded.maps_url;

insert into public.eventin_event_settings (
    event_id,
    subtitle,
    display_date,
    display_time,
    presentation_title,
    presentation_text,
    palette_key
) values (
    '11111111-1111-1111-1111-111111111111',
    'Gracias por formar parte de este dia tan importante.',
    'Sabado, 15 de mayo de 2027',
    '14:00',
    'Nos encantara compartir este dia contigo',
    'Un espacio sencillo para consultar la informacion del evento, confirmar asistencia y dejar mensajes bonitos.',
    'earth'
) on conflict (event_id) do update set
    subtitle = excluded.subtitle,
    display_date = excluded.display_date,
    display_time = excluded.display_time,
    presentation_title = excluded.presentation_title,
    presentation_text = excluded.presentation_text,
    palette_key = excluded.palette_key;
