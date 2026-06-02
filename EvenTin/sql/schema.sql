-- EvenTin: motor reutilizable para eventos familiares.
-- Ejecutar desde Supabase SQL Editor. No guardar nunca service_role keys en frontend.

create extension if not exists pgcrypto;

create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    event_type text not null default 'celebration',
    event_date timestamptz not null,
    location_name text,
    maps_url text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.event_settings (
    event_id uuid primary key references public.events(id) on delete cascade,
    subtitle text,
    display_date text,
    display_time text,
    presentation_title text,
    presentation_text text,
    hero_image_url text,
    detail_image_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    role text not null default 'admin' check (role in ('admin', 'superadmin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.event_admins (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (event_id, user_id)
);

create table if not exists public.guest_responses (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    nombre text not null,
    telefono text not null,
    asistencia boolean not null,
    mensaje text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (event_id, telefono)
);

create table if not exists public.public_messages (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    author_name text not null,
    message text not null,
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_event_settings_event_id on public.event_settings(event_id);
create index if not exists idx_event_admins_event_id on public.event_admins(event_id);
create index if not exists idx_event_admins_user_id on public.event_admins(user_id);
create index if not exists idx_guest_responses_event_id on public.guest_responses(event_id);
create index if not exists idx_guest_responses_event_phone on public.guest_responses(event_id, telefono);
create index if not exists idx_public_messages_event_id on public.public_messages(event_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_event_settings_updated_at on public.event_settings;
create trigger trg_event_settings_updated_at
before update on public.event_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_event_admins_updated_at on public.event_admins;
create trigger trg_event_admins_updated_at
before update on public.event_admins
for each row execute function public.set_updated_at();

drop trigger if exists trg_guest_responses_updated_at on public.guest_responses;
create trigger trg_guest_responses_updated_at
before update on public.guest_responses
for each row execute function public.set_updated_at();

drop trigger if exists trg_public_messages_updated_at on public.public_messages;
create trigger trg_public_messages_updated_at
before update on public.public_messages
for each row execute function public.set_updated_at();

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'superadmin'
    );
$$;

create or replace function public.can_admin_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.is_superadmin()
        or exists (
            select 1
            from public.event_admins
            where event_id = target_event_id
              and user_id = auth.uid()
        );
$$;

alter table public.events enable row level security;
alter table public.event_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.event_admins enable row level security;
alter table public.guest_responses enable row level security;
alter table public.public_messages enable row level security;

drop policy if exists "Public can read active events" on public.events;
create policy "Public can read active events"
on public.events for select
using (is_active = true);

drop policy if exists "Admins can manage assigned events" on public.events;
create policy "Admins can manage assigned events"
on public.events for all
to authenticated
using (public.can_admin_event(id))
with check (public.can_admin_event(id));

drop policy if exists "Public can read active event settings" on public.event_settings;
create policy "Public can read active event settings"
on public.event_settings for select
using (
    exists (
        select 1 from public.events
        where events.id = event_settings.event_id
          and events.is_active = true
    )
);

drop policy if exists "Admins can manage assigned event settings" on public.event_settings;
create policy "Admins can manage assigned event settings"
on public.event_settings for all
to authenticated
using (public.can_admin_event(event_id))
with check (public.can_admin_event(event_id));

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_superadmin());

drop policy if exists "Superadmins can manage profiles" on public.profiles;
create policy "Superadmins can manage profiles"
on public.profiles for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists "Admins can read own assignments" on public.event_admins;
create policy "Admins can read own assignments"
on public.event_admins for select
to authenticated
using (user_id = auth.uid() or public.is_superadmin());

drop policy if exists "Superadmins can manage event admins" on public.event_admins;
create policy "Superadmins can manage event admins"
on public.event_admins for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists "Public can insert guest responses" on public.guest_responses;
create policy "Public can insert guest responses"
on public.guest_responses for insert
to anon
with check (
    nombre <> ''
    and telefono <> ''
    and exists (
        select 1 from public.events
        where events.id = guest_responses.event_id
          and events.is_active = true
    )
);

drop policy if exists "Public can update guest responses by event phone" on public.guest_responses;
create policy "Public can update guest responses by event phone"
on public.guest_responses for update
to anon
using (
    exists (
        select 1 from public.events
        where events.id = guest_responses.event_id
          and events.is_active = true
    )
)
with check (
    nombre <> ''
    and telefono <> ''
    and exists (
        select 1 from public.events
        where events.id = guest_responses.event_id
          and events.is_active = true
    )
);

drop policy if exists "Admins can read assigned guest responses" on public.guest_responses;
create policy "Admins can read assigned guest responses"
on public.guest_responses for select
to authenticated
using (public.can_admin_event(event_id));

drop policy if exists "Public can insert messages" on public.public_messages;
create policy "Public can insert messages"
on public.public_messages for insert
to anon
with check (
    author_name <> ''
    and message <> ''
    and exists (
        select 1 from public.events
        where events.id = public_messages.event_id
          and events.is_active = true
    )
);

drop policy if exists "Admins can read assigned messages" on public.public_messages;
create policy "Admins can read assigned messages"
on public.public_messages for select
to authenticated
using (public.can_admin_event(event_id));

drop policy if exists "Admins can manage assigned messages" on public.public_messages;
create policy "Admins can manage assigned messages"
on public.public_messages for update
to authenticated
using (public.can_admin_event(event_id))
with check (public.can_admin_event(event_id));

insert into public.events (
    id,
    title,
    event_type,
    event_date,
    location_name,
    maps_url
) values (
    '11111111-1111-1111-1111-111111111111',
    'Mi Primera Comunion',
    'communion',
    '2026-06-15 12:00:00+02',
    'Parroquia por confirmar',
    'https://www.google.com/maps'
) on conflict (id) do nothing;

insert into public.event_settings (
    event_id,
    subtitle,
    display_date,
    display_time,
    presentation_title,
    presentation_text
) values (
    '11111111-1111-1111-1111-111111111111',
    'Gracias por formar parte de este dia tan importante.',
    'Domingo, 15 de junio de 2026',
    '12:00',
    'Nos encantara compartir este dia contigo',
    'Un espacio sencillo para consultar la informacion del evento, confirmar asistencia y dejar mensajes bonitos.'
) on conflict (event_id) do nothing;
