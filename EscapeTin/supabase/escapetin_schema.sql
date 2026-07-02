-- EscapeTin schema and RPC helpers
-- Apply this file in the Supabase SQL editor for the project used by alaraz1921.com.
-- All new database objects use the required escapetin_ prefix.

create extension if not exists pgcrypto;
create extension if not exists unaccent;
insert into public.app_projects (slug, name, description)
values ('gincanas', 'EscapeTin - Gincanas', 'Editor de gincanas, pistas y misiones de EscapeTin.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

create or replace function public.escapetin_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.can_manage_escapetin()
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
                  and ap.slug = 'gincanas'
                  and ap.is_active
                  and pm.role in ('owner', 'editor')
            )
        );
$$;

revoke all on function public.can_manage_escapetin() from public;
grant execute on function public.can_manage_escapetin() to authenticated;

create table if not exists public.escapetin_games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image_url text,
  access_code text unique not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'finished')),
  mode text not null default 'linear' check (mode in ('linear', 'free')),
  show_ranking boolean not null default true,
  allow_teams boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  time_limit_minutes integer,
  is_template boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.escapetin_challenges (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.escapetin_games(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  challenge_type text not null default 'question' check (challenge_type in ('question', 'keyword', 'qr', 'manual', 'photo')),
  question text,
  correct_answer text,
  keyword text,
  points integer not null default 10,
  order_index integer not null default 0,
  hint_1 text,
  hint_2 text,
  hint_penalty integer not null default 0,
  qr_token text unique default encode(gen_random_bytes(12), 'hex'),
  requires_admin_validation boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.escapetin_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.escapetin_games(id) on delete cascade,
  name text not null,
  access_token text unique not null,
  recovery_pin text,
  recovery_pin_hash text,
  total_points integer not null default 0,
  current_challenge_order integer not null default 0,
  started_at timestamptz default now(),
  finished_at timestamptz,
  created_at timestamptz default now(),
  unique (game_id, name)
);

create table if not exists public.escapetin_progress (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.escapetin_games(id) on delete cascade,
  team_id uuid not null references public.escapetin_teams(id) on delete cascade,
  challenge_id uuid not null references public.escapetin_challenges(id) on delete cascade,
  answer text,
  is_correct boolean not null default false,
  points_awarded integer not null default 0,
  hints_used integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique (team_id, challenge_id)
);

create table if not exists public.escapetin_uploads (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.escapetin_games(id) on delete cascade,
  team_id uuid not null references public.escapetin_teams(id) on delete cascade,
  challenge_id uuid not null references public.escapetin_challenges(id) on delete cascade,
  progress_id uuid references public.escapetin_progress(id) on delete cascade,
  file_url text not null,
  file_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create index if not exists escapetin_games_access_code_idx on public.escapetin_games (upper(access_code));
create index if not exists escapetin_challenges_game_order_idx on public.escapetin_challenges (game_id, order_index);
create index if not exists escapetin_teams_game_idx on public.escapetin_teams (game_id);
alter table public.escapetin_uploads add column if not exists progress_id uuid references public.escapetin_progress(id) on delete cascade;
create index if not exists escapetin_progress_team_idx on public.escapetin_progress (team_id);
create index if not exists escapetin_uploads_progress_idx on public.escapetin_uploads (progress_id);

drop trigger if exists escapetin_games_updated_at on public.escapetin_games;
create trigger escapetin_games_updated_at before update on public.escapetin_games for each row execute function public.escapetin_set_updated_at();
drop trigger if exists escapetin_challenges_updated_at on public.escapetin_challenges;
create trigger escapetin_challenges_updated_at before update on public.escapetin_challenges for each row execute function public.escapetin_set_updated_at();

alter table public.escapetin_games enable row level security;
alter table public.escapetin_challenges enable row level security;
alter table public.escapetin_teams enable row level security;
alter table public.escapetin_progress enable row level security;
alter table public.escapetin_uploads enable row level security;
-- Public bucket for participant photo challenges. Policies are intentionally scoped to this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('escapetin-uploads', 'escapetin-uploads', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists escapetin_uploads_storage_insert on storage.objects;
create policy escapetin_uploads_storage_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'escapetin-uploads');

drop policy if exists escapetin_uploads_storage_read on storage.objects;
create policy escapetin_uploads_storage_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'escapetin-uploads');

drop policy if exists escapetin_games_admin_all on public.escapetin_games;
create policy escapetin_games_admin_all on public.escapetin_games
  for all to authenticated
  using (public.can_manage_escapetin())
  with check (public.can_manage_escapetin() and created_by = auth.uid());

drop policy if exists escapetin_games_public_active on public.escapetin_games;
create policy escapetin_games_public_active on public.escapetin_games
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists escapetin_challenges_admin_all on public.escapetin_challenges;
create policy escapetin_challenges_admin_all on public.escapetin_challenges
  for all to authenticated
  using (public.can_manage_escapetin() and exists (select 1 from public.escapetin_games g where g.id = game_id))
  with check (public.can_manage_escapetin() and exists (select 1 from public.escapetin_games g where g.id = game_id));

drop policy if exists escapetin_challenges_public_active on public.escapetin_challenges;
create policy escapetin_challenges_public_active on public.escapetin_challenges
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.escapetin_games g where g.id = game_id and g.status = 'active'));

drop policy if exists escapetin_teams_admin_select on public.escapetin_teams;
create policy escapetin_teams_admin_select on public.escapetin_teams
  for select to authenticated
  using (public.can_manage_escapetin() and exists (select 1 from public.escapetin_games g where g.id = game_id));

drop policy if exists escapetin_progress_admin_select on public.escapetin_progress;
drop policy if exists escapetin_progress_admin_all on public.escapetin_progress;
create policy escapetin_progress_admin_all on public.escapetin_progress
  for all to authenticated
  using (public.can_manage_escapetin() and exists (select 1 from public.escapetin_games g where g.id = game_id))
  with check (public.can_manage_escapetin() and exists (select 1 from public.escapetin_games g where g.id = game_id));

drop policy if exists escapetin_uploads_admin_select on public.escapetin_uploads;
create policy escapetin_uploads_admin_select on public.escapetin_uploads
  for select to authenticated
  using (public.can_manage_escapetin() and exists (select 1 from public.escapetin_games g where g.id = game_id));

create or replace function public.escapetin_norm(value text)
returns text
language sql
stable
as $$
  select regexp_replace(lower(public.unaccent(coalesce(value, ''))), '\s+', ' ', 'g');
$$;

create or replace function public.escapetin_public_game_json(g public.escapetin_games)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'description', g.description,
    'cover_image_url', g.cover_image_url,
    'access_code', g.access_code,
    'show_ranking', g.show_ranking,
    'allow_teams', g.allow_teams,
    'mode', g.mode,
    'starts_at', g.starts_at,
    'ends_at', g.ends_at,
    'time_limit_minutes', g.time_limit_minutes
  );
$$;

create or replace function public.escapetin_get_public_game(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada o no activa.'); end if;
  if g.starts_at is not null and now() < g.starts_at then return escapetin_public_game_json(g) || jsonb_build_object('locked', true, 'message', 'La gincana aun no ha comenzado.'); end if;
  if g.ends_at is not null and now() > g.ends_at then return escapetin_public_game_json(g) || jsonb_build_object('locked', true, 'message', 'La gincana ya ha finalizado.'); end if;
  return escapetin_public_game_json(g);
end;
$$;

create or replace function public.escapetin_create_team(p_access_code text, p_team_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams; token text; pin text;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada o no activa.'); end if;
  if length(trim(p_team_name)) < 2 then return jsonb_build_object('error', 'El nombre del equipo es demasiado corto.'); end if;
  token := encode(gen_random_bytes(24), 'hex');
  pin := lpad((floor(random() * 10000))::int::text, 4, '0');
  insert into escapetin_teams (game_id, name, access_token, recovery_pin)
  values (g.id, trim(p_team_name), token, pin)
  returning * into t;
  return jsonb_build_object('game', escapetin_public_game_json(g), 'team_id', t.id, 'name', t.name, 'access_token', t.access_token, 'recovery_pin', t.recovery_pin, 'total_points', t.total_points);
exception
  when unique_violation then return jsonb_build_object('error', 'Ya existe un equipo con ese nombre en esta gincana.');
end;
$$;

create or replace function public.escapetin_get_team_by_token(p_access_code text, p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and access_token = p_access_token;
  if not found then return jsonb_build_object('error', 'Equipo no encontrado.'); end if;
  return jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points, 'finished_at', t.finished_at);
end;
$$;

create or replace function public.escapetin_recover_team(p_access_code text, p_team_name text, p_recovery_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and escapetin_norm(name) = escapetin_norm(p_team_name) and recovery_pin = trim(p_recovery_pin);
  if not found then return jsonb_build_object('error', 'No se pudo recuperar la partida. Revisa nombre y PIN.'); end if;
  return jsonb_build_object('id', t.id, 'name', t.name, 'access_token', t.access_token, 'total_points', t.total_points);
end;
$$;

drop function if exists public.escapetin_current_challenge(uuid, uuid);
create or replace function public.escapetin_current_challenge(p_game_id uuid, p_team_id uuid, p_challenge_id uuid default null)
returns escapetin_challenges
language sql
stable
as $$
  select c.* from escapetin_challenges c
  where c.game_id = p_game_id and c.is_active
    and (p_challenge_id is null or c.id = p_challenge_id)
    and not exists (select 1 from escapetin_progress p where p.challenge_id = c.id and p.team_id = p_team_id and p.is_correct)
  order by c.order_index, c.created_at
  limit 1;
$$;

create or replace function public.escapetin_get_current_state(p_access_code text, p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams; c escapetin_challenges; total int; completed int; remaining jsonb;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and access_token = p_access_token;
  if not found then return jsonb_build_object('error', 'Equipo no encontrado.'); end if;
  if g.starts_at is not null and now() < g.starts_at then return jsonb_build_object('game', escapetin_public_game_json(g), 'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points), 'message', 'La gincana aun no ha comenzado.'); end if;
  if g.ends_at is not null and now() > g.ends_at then return jsonb_build_object('game', escapetin_public_game_json(g), 'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points), 'message', 'La gincana ya ha finalizado.'); end if;
  if g.time_limit_minutes is not null and now() > t.started_at + make_interval(mins => g.time_limit_minutes) then return jsonb_build_object('game', escapetin_public_game_json(g), 'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points), 'message', 'El tiempo de este equipo ha terminado.'); end if;

  select count(*) into total from escapetin_challenges where game_id = g.id and is_active;
  select count(*) into completed from escapetin_progress where team_id = t.id and is_correct;
  select coalesce(jsonb_agg(to_jsonb(x) - 'correct_answer' - 'keyword' order by x.order_index, x.created_at), '[]'::jsonb) into remaining
  from (
    select c2.* from escapetin_challenges c2
    where c2.game_id = g.id and c2.is_active
      and not exists (select 1 from escapetin_progress p where p.challenge_id = c2.id and p.team_id = t.id and p.is_correct)
    order by c2.order_index, c2.created_at
  ) x;
  select * into c from escapetin_current_challenge(g.id, t.id, null);
  if completed >= total and total > 0 and t.finished_at is null then update escapetin_teams set finished_at = now() where id = t.id returning * into t; end if;
  return jsonb_build_object(
    'game', escapetin_public_game_json(g),
    'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points, 'finished_at', t.finished_at),
    'challenge', case when c.id is null then null else to_jsonb(c) - 'correct_answer' - 'keyword' end,
    'available_challenges', case when g.mode = 'free' then remaining else '[]'::jsonb end,
    'total_challenges', total,
    'completed_count', completed,
    'finished', completed >= total and total > 0
  );
end;
$$;

drop function if exists public.escapetin_use_hint(text, text);
create or replace function public.escapetin_use_hint(p_access_code text, p_access_token text, p_challenge_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams; c escapetin_challenges; p escapetin_progress; next_count int; hint_text text;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and access_token = p_access_token;
  if not found then return jsonb_build_object('error', 'Equipo no encontrado.'); end if;
  select * into c from escapetin_current_challenge(g.id, t.id, case when g.mode = 'free' then p_challenge_id else null end);
  if c.id is null then return jsonb_build_object('error', 'No hay prueba actual.'); end if;
  insert into escapetin_progress (game_id, team_id, challenge_id, hints_used)
  values (g.id, t.id, c.id, 0)
  on conflict (team_id, challenge_id) do nothing;
  select * into p from escapetin_progress where team_id = t.id and challenge_id = c.id;
  next_count := least(coalesce(p.hints_used, 0) + 1, 2);
  hint_text := case when next_count = 1 then c.hint_1 when next_count = 2 then c.hint_2 else null end;
  if hint_text is null or hint_text = '' then return jsonb_build_object('error', 'No hay mas pistas disponibles.'); end if;
  update escapetin_progress set hints_used = next_count where id = p.id;
  return jsonb_build_object('hints_used', next_count, 'hint', hint_text, 'penalty', c.hint_penalty);
end;
$$;

drop function if exists public.escapetin_submit_answer(text, text, text, text);
drop function if exists public.escapetin_submit_answer(text, text, text, text, uuid);
create or replace function public.escapetin_submit_answer(p_access_code text, p_access_token text, p_answer text default '', p_checkpoint text default '', p_challenge_id uuid default null, p_file_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams; c escapetin_challenges; p escapetin_progress; ok boolean := false; awarded int := 0; used_hints int := 0;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('correct', false, 'message', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and access_token = p_access_token;
  if not found then return jsonb_build_object('correct', false, 'message', 'Equipo no encontrado.'); end if;
  if g.ends_at is not null and now() > g.ends_at then return jsonb_build_object('correct', false, 'message', 'La gincana ya ha finalizado.'); end if;
  if g.time_limit_minutes is not null and now() > t.started_at + make_interval(mins => g.time_limit_minutes) then return jsonb_build_object('correct', false, 'message', 'El tiempo de este equipo ha terminado.'); end if;
  select * into c from escapetin_current_challenge(g.id, t.id, case when g.mode = 'free' then p_challenge_id else null end);
  if c.id is null then return jsonb_build_object('correct', true, 'message', 'Gincana completada.'); end if;

  ok := case c.challenge_type
    when 'question' then escapetin_norm(p_answer) = escapetin_norm(c.correct_answer)
    when 'keyword' then escapetin_norm(p_answer) = escapetin_norm(c.keyword)
    when 'qr' then trim(coalesce(p_checkpoint, '')) = c.qr_token
    when 'manual' then true
    when 'photo' then true
    else false
  end;
  if not ok then return jsonb_build_object('correct', false, 'message', 'Respuesta incorrecta, intentalo de nuevo.'); end if;

  insert into escapetin_progress (game_id, team_id, challenge_id, answer, hints_used)
  values (g.id, t.id, c.id, p_answer, 0)
  on conflict (team_id, challenge_id) do update set answer = excluded.answer
  returning * into p;

  if c.challenge_type in ('manual', 'photo') or c.requires_admin_validation then
    return jsonb_build_object('correct', true, 'message', 'Prueba enviada. Queda pendiente de revision del administrador.', 'pending', true);
  end if;

  used_hints := coalesce(p.hints_used, 0);
  awarded := greatest(c.points - (used_hints * c.hint_penalty), 0);
  update escapetin_progress set is_correct = true, points_awarded = awarded, completed_at = now() where id = p.id;
  update escapetin_teams set total_points = total_points + awarded, current_challenge_order = c.order_index + 1 where id = t.id;
  return jsonb_build_object('correct', true, 'message', 'Prueba superada', 'points_awarded', awarded);
end;
$$;

create or replace function public.escapetin_get_ranking(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status in ('active', 'finished');
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  if not g.show_ranking then return jsonb_build_object('error', 'El ranking no esta disponible para esta gincana.'); end if;
  return jsonb_build_object(
    'game', escapetin_public_game_json(g),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'total_points', total_points, 'finished_at', finished_at, 'elapsed_seconds', extract(epoch from coalesce(finished_at, now()) - started_at)::int) order by total_points desc, (coalesce(finished_at, now()) - started_at) asc, finished_at asc nulls last)
      from escapetin_teams where game_id = g.id
    ), '[]'::jsonb)
  );
end;
$$;



create or replace function public.escapetin_review_progress(p_progress_id uuid, p_approved boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare p escapetin_progress; c escapetin_challenges; g escapetin_games; awarded int := 0;
begin
  select * into p from escapetin_progress where id = p_progress_id;
  if not found then return jsonb_build_object('error', 'Progreso no encontrado.'); end if;
  if not public.can_manage_escapetin() then return jsonb_build_object('error', 'No autorizado.'); end if;
  select * into g from escapetin_games where id = p.game_id;
  if not found then return jsonb_build_object('error', 'No autorizado.'); end if;
  select * into c from escapetin_challenges where id = p.challenge_id;

  if not p_approved then
    delete from escapetin_progress where id = p.id;
    return jsonb_build_object('status', 'rejected');
  end if;

  if p.is_correct then return jsonb_build_object('status', 'already_approved'); end if;
  awarded := greatest(c.points - (coalesce(p.hints_used, 0) * c.hint_penalty), 0);
  update escapetin_progress set is_correct = true, points_awarded = awarded, completed_at = now() where id = p.id;
  update escapetin_teams set total_points = total_points + awarded, current_challenge_order = greatest(current_challenge_order, c.order_index + 1) where id = p.team_id;
  return jsonb_build_object('status', 'approved', 'points_awarded', awarded);
end;
$$;
create or replace function public.escapetin_duplicate_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare source_game escapetin_games; new_game escapetin_games; new_code text;
begin
  if not public.can_manage_escapetin() then return jsonb_build_object('error', 'No autorizado.'); end if;
  select * into source_game from escapetin_games where id = p_game_id;
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  new_code := 'ET' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
  insert into escapetin_games (title, description, cover_image_url, access_code, status, mode, show_ranking, allow_teams, starts_at, ends_at, time_limit_minutes, is_template, created_by)
  values (source_game.title || ' copia', source_game.description, source_game.cover_image_url, new_code, 'draft', source_game.mode, source_game.show_ranking, source_game.allow_teams, source_game.starts_at, source_game.ends_at, source_game.time_limit_minutes, source_game.is_template, auth.uid())
  returning * into new_game;
  insert into escapetin_challenges (game_id, title, description, image_url, challenge_type, question, correct_answer, keyword, points, order_index, hint_1, hint_2, hint_penalty, requires_admin_validation, is_active)
  select new_game.id, title, description, image_url, challenge_type, question, correct_answer, keyword, points, order_index, hint_1, hint_2, hint_penalty, requires_admin_validation, is_active
  from escapetin_challenges where game_id = source_game.id order by order_index;
  return jsonb_build_object('game_id', new_game.id, 'access_code', new_game.access_code);
end;
$$;
grant execute on function public.escapetin_get_public_game(text) to anon, authenticated;
grant execute on function public.escapetin_create_team(text, text) to anon, authenticated;
grant execute on function public.escapetin_get_team_by_token(text, text) to anon, authenticated;
grant execute on function public.escapetin_recover_team(text, text, text) to anon, authenticated;
grant execute on function public.escapetin_get_current_state(text, text) to anon, authenticated;
grant execute on function public.escapetin_use_hint(text, text, uuid) to anon, authenticated;
grant execute on function public.escapetin_submit_answer(text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.escapetin_get_ranking(text) to anon, authenticated;
grant execute on function public.escapetin_duplicate_game(uuid) to authenticated;
grant execute on function public.escapetin_review_progress(uuid, boolean) to authenticated;
