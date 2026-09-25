-- TrackTin: listas personalizadas y permisos para el proyecto Supabase compartido.
-- Ejecutar después de tracktin_schema.sql. Este script es seguro para ejecutar más de una vez.

alter table public.tracktin_media add column if not exists title text;
alter table public.tracktin_media add column if not exists poster_path text;

create table if not exists public.tracktin_custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.tracktin_custom_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.tracktin_custom_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie','tv')),
  title text,
  poster_path text,
  created_at timestamptz not null default now(),
  unique(list_id, tmdb_id, media_type)
);

create index if not exists tracktin_custom_lists_user_idx
  on public.tracktin_custom_lists(user_id);
create index if not exists tracktin_custom_items_list_idx
  on public.tracktin_custom_list_items(list_id, user_id);
create index if not exists tracktin_custom_items_media_idx
  on public.tracktin_custom_list_items(user_id, tmdb_id, media_type);

alter table public.tracktin_custom_lists enable row level security;
alter table public.tracktin_custom_list_items enable row level security;

drop policy if exists tracktin_lists_select on public.tracktin_custom_lists;
drop policy if exists tracktin_lists_insert on public.tracktin_custom_lists;
drop policy if exists tracktin_lists_update on public.tracktin_custom_lists;
drop policy if exists tracktin_lists_delete on public.tracktin_custom_lists;
create policy tracktin_lists_select on public.tracktin_custom_lists
  for select to authenticated using (auth.uid() = user_id);
create policy tracktin_lists_insert on public.tracktin_custom_lists
  for insert to authenticated with check (auth.uid() = user_id);
create policy tracktin_lists_update on public.tracktin_custom_lists
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tracktin_lists_delete on public.tracktin_custom_lists
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists tracktin_list_items_select on public.tracktin_custom_list_items;
drop policy if exists tracktin_list_items_insert on public.tracktin_custom_list_items;
drop policy if exists tracktin_list_items_update on public.tracktin_custom_list_items;
drop policy if exists tracktin_list_items_delete on public.tracktin_custom_list_items;
create policy tracktin_list_items_select on public.tracktin_custom_list_items
  for select to authenticated using (auth.uid() = user_id);
create policy tracktin_list_items_insert on public.tracktin_custom_list_items
  for insert to authenticated
  with check (auth.uid() = user_id and exists (
    select 1 from public.tracktin_custom_lists l
    where l.id = list_id and l.user_id = auth.uid()
  ));
create policy tracktin_list_items_update on public.tracktin_custom_list_items
  for update to authenticated
  using (auth.uid() = user_id and exists (
    select 1 from public.tracktin_custom_lists l
    where l.id = list_id and l.user_id = auth.uid()
  ))
  with check (auth.uid() = user_id and exists (
    select 1 from public.tracktin_custom_lists l
    where l.id = list_id and l.user_id = auth.uid()
  ));
create policy tracktin_list_items_delete on public.tracktin_custom_list_items
  for delete to authenticated using (auth.uid() = user_id);

grant usage on schema public to authenticated;
revoke all on table public.tracktin_custom_lists, public.tracktin_custom_list_items
  from anon, authenticated;
grant select, insert, update, delete on table
  public.tracktin_custom_lists, public.tracktin_custom_list_items
  to authenticated;

-- Mantener explícitos los permisos de las tablas existentes de TrackTin.
revoke all on table
  public.tracktin_media,
  public.tracktin_episode_progress,
  public.tracktin_user_preferences
from anon, authenticated;
grant select, insert, update, delete on table
  public.tracktin_media,
  public.tracktin_episode_progress,
  public.tracktin_user_preferences
to authenticated;

notify pgrst, 'reload schema';
