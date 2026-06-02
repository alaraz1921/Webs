-- EvenTin: motor reutilizable para eventos familiares.
-- Ejecutar desde Supabase SQL Editor. No guardar nunca service_role keys en frontend.

create extension if not exists pgcrypto;

create table if not exists public.eventin_event_types (
    key text primary key,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    public_slug text not null unique,
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
    role text not null default 'admin' check (role in ('admin', 'superadmin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.eventin_event_admins (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventin_events(id) on delete cascade,
    user_id uuid not null references public.eventin_profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (event_id, user_id)
);

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

alter table public.eventin_events add column if not exists public_slug text;
alter table public.eventin_event_settings add column if not exists palette_key text not null default 'earth';
alter table public.eventin_profiles add column if not exists email text;

create index if not exists idx_eventin_event_settings_event_id on public.eventin_event_settings(event_id);
create index if not exists idx_eventin_events_public_slug on public.eventin_events(public_slug);
create index if not exists idx_eventin_events_event_type on public.eventin_events(event_type);
create unique index if not exists idx_eventin_profiles_email_unique on public.eventin_profiles(email) where email is not null;
create index if not exists idx_eventin_event_admins_event_id on public.eventin_event_admins(event_id);
create index if not exists idx_eventin_event_admins_user_id on public.eventin_event_admins(user_id);
create index if not exists idx_eventin_guest_responses_event_id on public.eventin_guest_responses(event_id);
create index if not exists idx_eventin_guest_responses_event_phone on public.eventin_guest_responses(event_id, telefono);
create index if not exists idx_eventin_public_messages_event_id on public.eventin_public_messages(event_id);

create or replace function public.eventin_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.eventin_events;
create trigger trg_events_updated_at
before update on public.eventin_events
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_event_types_updated_at on public.eventin_event_types;
create trigger trg_event_types_updated_at
before update on public.eventin_event_types
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_event_settings_updated_at on public.eventin_event_settings;
create trigger trg_event_settings_updated_at
before update on public.eventin_event_settings
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.eventin_profiles;
create trigger trg_profiles_updated_at
before update on public.eventin_profiles
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_event_admins_updated_at on public.eventin_event_admins;
create trigger trg_event_admins_updated_at
before update on public.eventin_event_admins
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_guest_responses_updated_at on public.eventin_guest_responses;
create trigger trg_guest_responses_updated_at
before update on public.eventin_guest_responses
for each row execute function public.eventin_set_updated_at();

drop trigger if exists trg_public_messages_updated_at on public.eventin_public_messages;
create trigger trg_public_messages_updated_at
before update on public.eventin_public_messages
for each row execute function public.eventin_set_updated_at();

create or replace function public.eventin_is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.eventin_profiles
        where id = auth.uid()
          and role = 'superadmin'
    );
$$;

create or replace function public.eventin_can_admin_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.eventin_is_superadmin()
        or exists (
            select 1
            from public.eventin_event_admins
            where event_id = target_event_id
              and user_id = auth.uid()
        );
$$;

alter table public.eventin_events enable row level security;
alter table public.eventin_event_types enable row level security;
alter table public.eventin_event_settings enable row level security;
alter table public.eventin_profiles enable row level security;
alter table public.eventin_event_admins enable row level security;
alter table public.eventin_guest_responses enable row level security;
alter table public.eventin_public_messages enable row level security;

drop policy if exists "Public can read event types" on public.eventin_event_types;
create policy "Public can read event types"
on public.eventin_event_types for select
using (true);

drop policy if exists "Superadmins can manage event types" on public.eventin_event_types;
create policy "Superadmins can manage event types"
on public.eventin_event_types for all
to authenticated
using (public.eventin_is_superadmin())
with check (public.eventin_is_superadmin());

drop policy if exists "Public can read active events" on public.eventin_events;
create policy "Public can read active events"
on public.eventin_events for select
using (is_active = true);

drop policy if exists "Admins can manage assigned events" on public.eventin_events;
create policy "Admins can manage assigned events"
on public.eventin_events for all
to authenticated
using (public.eventin_can_admin_event(id))
with check (public.eventin_can_admin_event(id));

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

drop policy if exists "Admins can manage assigned event settings" on public.eventin_event_settings;
create policy "Admins can manage assigned event settings"
on public.eventin_event_settings for all
to authenticated
using (public.eventin_can_admin_event(event_id))
with check (public.eventin_can_admin_event(event_id));

drop policy if exists "Users can read own profile" on public.eventin_profiles;
create policy "Users can read own profile"
on public.eventin_profiles for select
to authenticated
using (id = auth.uid() or public.eventin_is_superadmin());

drop policy if exists "Superadmins can manage eventin_profiles" on public.eventin_profiles;
create policy "Superadmins can manage eventin_profiles"
on public.eventin_profiles for all
to authenticated
using (public.eventin_is_superadmin())
with check (public.eventin_is_superadmin());

drop policy if exists "Admins can read own assignments" on public.eventin_event_admins;
create policy "Admins can read own assignments"
on public.eventin_event_admins for select
to authenticated
using (user_id = auth.uid() or public.eventin_is_superadmin());

drop policy if exists "Superadmins can manage event admins" on public.eventin_event_admins;
create policy "Superadmins can manage event admins"
on public.eventin_event_admins for all
to authenticated
using (public.eventin_is_superadmin())
with check (public.eventin_is_superadmin());

drop policy if exists "Public can insert guest responses" on public.eventin_guest_responses;
create policy "Public can insert guest responses"
on public.eventin_guest_responses for insert
to anon
with check (
    nombre <> ''
    and telefono <> ''
    and exists (
        select 1 from public.eventin_events
        where eventin_events.id = eventin_guest_responses.event_id
          and eventin_events.is_active = true
    )
);

drop policy if exists "Public can update guest responses by event phone" on public.eventin_guest_responses;
create policy "Public can update guest responses by event phone"
on public.eventin_guest_responses for update
to anon
using (
    exists (
        select 1 from public.eventin_events
        where eventin_events.id = eventin_guest_responses.event_id
          and eventin_events.is_active = true
    )
)
with check (
    nombre <> ''
    and telefono <> ''
    and exists (
        select 1 from public.eventin_events
        where eventin_events.id = eventin_guest_responses.event_id
          and eventin_events.is_active = true
    )
);

drop policy if exists "Admins can read assigned guest responses" on public.eventin_guest_responses;
create policy "Admins can read assigned guest responses"
on public.eventin_guest_responses for select
to authenticated
using (public.eventin_can_admin_event(event_id));

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

drop policy if exists "Admins can read assigned messages" on public.eventin_public_messages;
create policy "Admins can read assigned messages"
on public.eventin_public_messages for select
to authenticated
using (public.eventin_can_admin_event(event_id));

drop policy if exists "Admins can manage assigned messages" on public.eventin_public_messages;
create policy "Admins can manage assigned messages"
on public.eventin_public_messages for update
to authenticated
using (public.eventin_can_admin_event(event_id))
with check (public.eventin_can_admin_event(event_id));

alter table public.eventin_events add column if not exists public_slug text;
alter table public.eventin_event_settings add column if not exists palette_key text not null default 'earth';
alter table public.eventin_profiles add column if not exists email text;

update public.eventin_events
set public_slug = 'evento-' || substring(id::text from 1 for 8)
where public_slug is null or public_slug = '';

alter table public.eventin_events alter column public_slug set not null;
create unique index if not exists idx_eventin_events_public_slug_unique on public.eventin_events(public_slug);

insert into public.eventin_event_types (key, name) values
    ('communion', 'Comunion'),
    ('baptism', 'Bautizo'),
    ('wedding', 'Boda'),
    ('birthday', 'Cumpleanos'),
    ('celebration', 'Celebracion')
on conflict (key) do update set name = excluded.name;

insert into public.eventin_events (
    id,
    title,
    public_slug,
    event_type,
    event_date,
    location_name,
    maps_url
) values (
    '11111111-1111-1111-1111-111111111111',
    'Mi Primera Comunion',
    'primera-comunion-demo',
    'communion',
    '2027-05-15 14:00:00+02',
    'Por confirmar',
    'https://www.google.com/maps'
) on conflict (id) do nothing;

insert into public.eventin_event_settings (
    event_id,
    subtitle,
    display_date,
    display_time,
    presentation_title,
    presentation_text
) values (
    '11111111-1111-1111-1111-111111111111',
    'Gracias por formar parte de este dia tan importante.',
    'Sábado, 15 de mayo de 2027',
    '14:00',
    'Nos encantara compartir este dia contigo',
    'Un espacio sencillo para consultar la informacion del evento, confirmar asistencia y dejar mensajes bonitos.'
) on conflict (event_id) do nothing;

update public.eventin_events
set public_slug = 'primera-comunion-demo'
where id = '11111111-1111-1111-1111-111111111111';

update public.eventin_event_settings
set palette_key = 'earth'
where event_id = '11111111-1111-1111-1111-111111111111';

insert into public.eventin_events (
    id,
    title,
    public_slug,
    event_type,
    event_date,
    location_name,
    maps_url
) values
    (
        '22222222-2222-2222-2222-222222222222',
        'Bautizo de Sofia',
        'bautizo-sofia-demo',
        'baptism',
        '2027-06-20 12:30:00+02',
        'Iglesia por confirmar',
        'https://www.google.com/maps'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Cumpleanos de Martina',
        'cumpleanos-martina-demo',
        'birthday',
        '2027-09-05 18:00:00+02',
        'Jardin familiar',
        'https://www.google.com/maps'
    )
on conflict (id) do update set
    title = excluded.title,
    public_slug = excluded.public_slug,
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
) values
    (
        '22222222-2222-2222-2222-222222222222',
        'Nos hara mucha ilusion compartir este dia contigo.',
        'Domingo, 20 de junio de 2027',
        '12:30',
        'Celebramos un dia muy especial',
        'Aqui encontraras los detalles del bautizo y podras dejar tu mensaje.',
        'pastel'
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'Una tarde para celebrar, reir y brindar juntos.',
        'Domingo, 5 de septiembre de 2027',
        '18:00',
        'Te esperamos para celebrar',
        'Consulta la informacion de la fiesta y deja un mensaje bonito.',
        'marine'
    )
on conflict (event_id) do update set
    subtitle = excluded.subtitle,
    display_date = excluded.display_date,
    display_time = excluded.display_time,
    presentation_title = excluded.presentation_title,
    presentation_text = excluded.presentation_text,
    palette_key = excluded.palette_key;
