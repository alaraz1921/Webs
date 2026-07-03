begin;

alter table public.escapetin_challenges
  add column if not exists option_a text,
  add column if not exists option_b text,
  add column if not exists option_c text,
  add column if not exists option_d text,
  add column if not exists correct_option text;

alter table public.escapetin_challenges drop constraint if exists escapetin_challenges_challenge_type_check;

update public.escapetin_challenges
set challenge_type = 'question',
    correct_answer = coalesce(correct_answer, keyword)
where challenge_type = 'keyword';

alter table public.escapetin_challenges
  add constraint escapetin_challenges_challenge_type_check
  check (challenge_type in ('question', 'multiple_choice', 'qr', 'manual', 'photo'));

alter table public.escapetin_challenges drop constraint if exists escapetin_challenges_correct_option_check;
alter table public.escapetin_challenges
  add constraint escapetin_challenges_correct_option_check
  check (correct_option is null or correct_option in ('a', 'b', 'c', 'd'));

create or replace function public.escapetin_list_game_teams(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
    from escapetin_teams
    where game_id = g.id
  ), '[]'::jsonb);
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
    and not exists (
        select 1 from escapetin_progress p
        where p.challenge_id = c.id and p.team_id = p_team_id
          and (
            p.is_correct
            or coalesce(p.answer, '') <> ''
            or exists (select 1 from escapetin_uploads u where u.progress_id = p.id)
          )
    )
  order by c.order_index, c.created_at
  limit 1;
$$;

create or replace function public.escapetin_get_current_state(p_access_code text, p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams; c escapetin_challenges; total int; completed int; remaining jsonb; pending jsonb;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('error', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and access_token = p_access_token;
  if not found then return jsonb_build_object('error', 'Equipo no encontrado.'); end if;
  if g.starts_at is not null and now() < g.starts_at then return jsonb_build_object('game', escapetin_public_game_json(g), 'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points), 'message', 'La gincana aun no ha comenzado.'); end if;
  if g.ends_at is not null and now() > g.ends_at then return jsonb_build_object('game', escapetin_public_game_json(g), 'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points), 'message', 'La gincana ya ha finalizado.'); end if;
  if g.time_limit_minutes is not null and now() > t.started_at + make_interval(mins => g.time_limit_minutes) then return jsonb_build_object('game', escapetin_public_game_json(g), 'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points), 'message', 'El tiempo de este equipo ha terminado.'); end if;

  select jsonb_build_object('id', p.id, 'challenge_id', p.challenge_id, 'challenge_title', c3.title, 'created_at', p.created_at)
  into pending
  from escapetin_progress p
  join escapetin_challenges c3 on c3.id = p.challenge_id
  where p.team_id = t.id and not p.is_correct and p.completed_at is null
    and (coalesce(p.answer, '') <> '' or exists (select 1 from escapetin_uploads u where u.progress_id = p.id))
  order by p.created_at desc
  limit 1;

  select count(*) into total from escapetin_challenges where game_id = g.id and is_active;
  select count(*) into completed from escapetin_progress where team_id = t.id and is_correct;
  select coalesce(jsonb_agg(to_jsonb(x) - 'correct_answer' - 'keyword' - 'correct_option' order by x.order_index, x.created_at), '[]'::jsonb) into remaining
  from (
    select c2.* from escapetin_challenges c2
    where c2.game_id = g.id and c2.is_active
      and not exists (
          select 1 from escapetin_progress p
          where p.challenge_id = c2.id and p.team_id = t.id
            and (
              p.is_correct
              or coalesce(p.answer, '') <> ''
              or exists (select 1 from escapetin_uploads u where u.progress_id = p.id)
            )
      )
    order by c2.order_index, c2.created_at
  ) x;
  select * into c from escapetin_current_challenge(g.id, t.id, null);
  if completed >= total and total > 0 and t.finished_at is null then update escapetin_teams set finished_at = now() where id = t.id returning * into t; end if;
  return jsonb_build_object(
    'game', escapetin_public_game_json(g),
    'team', jsonb_build_object('id', t.id, 'name', t.name, 'total_points', t.total_points, 'finished_at', t.finished_at),
    'challenge', case when c.id is null then null else to_jsonb(c) - 'correct_answer' - 'keyword' - 'correct_option' end,
    'available_challenges', case when g.mode = 'free' then remaining else '[]'::jsonb end,
    'pending_progress', pending,
    'total_challenges', total,
    'completed_count', completed,
    'finished', completed >= total and total > 0
  );
end;
$$;

drop function if exists public.escapetin_submit_answer(text, text, text, text);
drop function if exists public.escapetin_submit_answer(text, text, text, text, uuid);
drop function if exists public.escapetin_submit_answer(text, text, text, text, uuid, text);
create or replace function public.escapetin_submit_answer(p_access_code text, p_access_token text, p_answer text default '', p_checkpoint text default '', p_challenge_id uuid default null, p_file_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare g escapetin_games; t escapetin_teams; c escapetin_challenges; p escapetin_progress; ok boolean := false; awarded int := 0; used_hints int := 0; selected text; stored_answer text;
begin
  select * into g from escapetin_games where upper(access_code) = upper(trim(p_access_code)) and status = 'active';
  if not found then return jsonb_build_object('correct', false, 'message', 'Gincana no encontrada.'); end if;
  select * into t from escapetin_teams where game_id = g.id and access_token = p_access_token;
  if not found then return jsonb_build_object('correct', false, 'message', 'Equipo no encontrado.'); end if;
  if g.ends_at is not null and now() > g.ends_at then return jsonb_build_object('correct', false, 'message', 'La gincana ya ha finalizado.'); end if;
  if g.time_limit_minutes is not null and now() > t.started_at + make_interval(mins => g.time_limit_minutes) then return jsonb_build_object('correct', false, 'message', 'El tiempo de este equipo ha terminado.'); end if;
  select * into c from escapetin_current_challenge(g.id, t.id, case when g.mode = 'free' then p_challenge_id else null end);
  if c.id is null then return jsonb_build_object('correct', true, 'message', 'Gincana completada.'); end if;

  selected := lower(trim(coalesce(p_answer, '')));
  stored_answer := case when c.challenge_type = 'qr' then trim(coalesce(p_checkpoint, '')) else p_answer end;
  ok := case c.challenge_type
    when 'question' then escapetin_norm(p_answer) = escapetin_norm(c.correct_answer)
    when 'multiple_choice' then selected = c.correct_option
    when 'qr' then trim(coalesce(p_checkpoint, '')) = c.qr_token
    when 'manual' then true
    when 'photo' then p_file_url is not null and p_file_url <> ''
    else false
  end;
  if not ok then return jsonb_build_object('correct', false, 'message', 'Respuesta incorrecta, intentalo de nuevo.'); end if;

  insert into escapetin_progress (game_id, team_id, challenge_id, answer, hints_used)
  values (g.id, t.id, c.id, stored_answer, 0)
  on conflict (team_id, challenge_id) do update set answer = excluded.answer
  returning * into p;

  if p_file_url is not null and p_file_url <> '' then
    insert into escapetin_uploads (game_id, team_id, challenge_id, progress_id, file_url, file_type)
    values (g.id, t.id, c.id, p.id, p_file_url, 'image')
    on conflict do nothing;
  end if;

  if c.challenge_type in ('manual', 'photo') or c.requires_admin_validation then
    return jsonb_build_object('correct', true, 'message', 'Prueba enviada. Queda pendiente de validacion del administrador.', 'pending', true, 'progress_id', p.id);
  end if;

  used_hints := coalesce(p.hints_used, 0);
  awarded := greatest(c.points - (used_hints * c.hint_penalty), 0);
  update escapetin_progress set is_correct = true, points_awarded = awarded, completed_at = now() where id = p.id;
  update escapetin_teams set total_points = total_points + awarded, current_challenge_order = c.order_index + 1 where id = t.id;
  return jsonb_build_object('correct', true, 'message', 'Prueba superada. A por la siguiente prueba', 'points_awarded', awarded);
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
  update escapetin_uploads set status = 'approved' where progress_id = p.id;
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
  new_code := 'ET' || upper(substr(public.escapetin_random_hex(5), 1, 8));
  insert into escapetin_games (title, description, cover_image_url, access_code, status, mode, show_ranking, allow_teams, starts_at, ends_at, time_limit_minutes, is_template, created_by)
  values (source_game.title || ' copia', source_game.description, source_game.cover_image_url, new_code, 'draft', source_game.mode, source_game.show_ranking, source_game.allow_teams, source_game.starts_at, source_game.ends_at, source_game.time_limit_minutes, source_game.is_template, auth.uid())
  returning * into new_game;
  insert into escapetin_challenges (game_id, title, description, image_url, challenge_type, question, correct_answer, keyword, option_a, option_b, option_c, option_d, correct_option, points, order_index, hint_1, hint_2, hint_penalty, requires_admin_validation, is_active)
  select new_game.id, title, description, image_url, challenge_type, question, correct_answer, keyword, option_a, option_b, option_c, option_d, correct_option, points, order_index, hint_1, hint_2, hint_penalty, requires_admin_validation, is_active
  from escapetin_challenges where game_id = source_game.id order by order_index;
  return jsonb_build_object('game_id', new_game.id, 'access_code', new_game.access_code);
end;
$$;
do $$
begin
  begin
    alter publication supabase_realtime add table public.escapetin_progress;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

grant execute on function public.escapetin_list_game_teams(text) to anon, authenticated;
grant execute on function public.escapetin_get_current_state(text, text) to anon, authenticated;
grant execute on function public.escapetin_submit_answer(text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.escapetin_duplicate_game(uuid) to authenticated;
grant execute on function public.escapetin_review_progress(uuid, boolean) to authenticated;

commit;