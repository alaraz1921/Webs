begin;

create extension if not exists pgcrypto;

create or replace function public.escapetin_random_hex(p_bytes integer)
returns text
language plpgsql
set search_path = public, extensions
as $$
begin
  return encode(gen_random_bytes(p_bytes), 'hex');
end;
$$;

alter table if exists public.escapetin_challenges
  alter column qr_token set default public.escapetin_random_hex(12);

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
  token := public.escapetin_random_hex(24);
  pin := lpad((floor(random() * 10000))::int::text, 4, '0');
  insert into escapetin_teams (game_id, name, access_token, recovery_pin)
  values (g.id, trim(p_team_name), token, pin)
  returning * into t;
  return jsonb_build_object('game', escapetin_public_game_json(g), 'team_id', t.id, 'name', t.name, 'access_token', t.access_token, 'recovery_pin', t.recovery_pin, 'total_points', t.total_points);
exception
  when unique_violation then return jsonb_build_object('error', 'Ya existe un equipo con ese nombre en esta gincana.');
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
  new_code := 'ET' || upper(substr(public.escapetin_random_hex(5), 1, 8));
  insert into escapetin_games (title, description, cover_image_url, access_code, status, mode, show_ranking, allow_teams, starts_at, ends_at, time_limit_minutes, is_template, created_by)
  values (source_game.title || ' copia', source_game.description, source_game.cover_image_url, new_code, 'draft', source_game.mode, source_game.show_ranking, source_game.allow_teams, source_game.starts_at, source_game.ends_at, source_game.time_limit_minutes, source_game.is_template, auth.uid())
  returning * into new_game;
  insert into escapetin_challenges (game_id, title, description, image_url, challenge_type, question, correct_answer, keyword, points, order_index, hint_1, hint_2, hint_penalty, requires_admin_validation, is_active)
  select new_game.id, title, description, image_url, challenge_type, question, correct_answer, keyword, points, order_index, hint_1, hint_2, hint_penalty, requires_admin_validation, is_active
  from escapetin_challenges where game_id = source_game.id order by order_index;
  return jsonb_build_object('game_id', new_game.id, 'access_code', new_game.access_code);
end;
$$;

grant execute on function public.escapetin_random_hex(integer) to anon, authenticated;
grant execute on function public.escapetin_create_team(text, text) to anon, authenticated;
grant execute on function public.escapetin_duplicate_game(uuid) to authenticated;

commit;