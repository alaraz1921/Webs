-- TrackTin: metadatos opcionales para estadísticas.
-- Ejecutar después de tracktin_schema.sql y tracktin_lists.sql.

alter table public.tracktin_media
  add column if not exists runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0);
alter table public.tracktin_media
  add column if not exists genres text[] not null default '{}';
alter table public.tracktin_episode_progress
  add column if not exists runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0);

notify pgrst, 'reload schema';
