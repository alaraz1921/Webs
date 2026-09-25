-- TrackTin: nombres exclusivos y RLS por usuario.
create extension if not exists pgcrypto;
create table if not exists public.tracktin_media (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 tmdb_id integer not null, media_type text not null check(media_type in ('movie','tv')),
 status text not null check(status in ('pending','watching','watched','up_to_date','completed','waiting_new_season','abandoned')) default 'pending',
 is_favorite boolean not null default false, personal_rating numeric(3,1) check(personal_rating between 0 and 10), personal_notes text,
 added_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, updated_at timestamptz not null default now(),
 unique(user_id,tmdb_id,media_type));
create table if not exists public.tracktin_episode_progress (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 tmdb_series_id integer not null, season_number integer not null check(season_number>=0), episode_number integer not null check(episode_number>0),
 watched boolean not null default true, watched_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,tmdb_series_id,season_number,episode_number));
create table if not exists public.tracktin_user_preferences (
 id uuid primary key default gen_random_uuid(), user_id uuid unique not null references auth.users(id) on delete cascade,
 default_view text default 'grid', show_spoilers boolean not null default false, preferred_language text not null default 'es-ES', preferred_region text not null default 'ES', theme text not null default 'dark', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists tracktin_media_user_idx on public.tracktin_media(user_id);
create index if not exists tracktin_media_lookup_idx on public.tracktin_media(user_id,media_type,status);
create index if not exists tracktin_episode_user_idx on public.tracktin_episode_progress(user_id,tmdb_series_id);
alter table public.tracktin_media enable row level security; alter table public.tracktin_episode_progress enable row level security; alter table public.tracktin_user_preferences enable row level security;
create policy tracktin_media_select on public.tracktin_media for select using(auth.uid()=user_id); create policy tracktin_media_insert on public.tracktin_media for insert with check(auth.uid()=user_id); create policy tracktin_media_update on public.tracktin_media for update using(auth.uid()=user_id) with check(auth.uid()=user_id); create policy tracktin_media_delete on public.tracktin_media for delete using(auth.uid()=user_id);
create policy tracktin_episode_select on public.tracktin_episode_progress for select using(auth.uid()=user_id); create policy tracktin_episode_insert on public.tracktin_episode_progress for insert with check(auth.uid()=user_id); create policy tracktin_episode_update on public.tracktin_episode_progress for update using(auth.uid()=user_id) with check(auth.uid()=user_id); create policy tracktin_episode_delete on public.tracktin_episode_progress for delete using(auth.uid()=user_id);
create policy tracktin_prefs_select on public.tracktin_user_preferences for select using(auth.uid()=user_id); create policy tracktin_prefs_insert on public.tracktin_user_preferences for insert with check(auth.uid()=user_id); create policy tracktin_prefs_update on public.tracktin_user_preferences for update using(auth.uid()=user_id) with check(auth.uid()=user_id); create policy tracktin_prefs_delete on public.tracktin_user_preferences for delete using(auth.uid()=user_id);
