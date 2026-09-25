begin;

alter table public.escapetin_progress
  add column if not exists wrong_attempts integer not null default 0;

create table if not exists public.escapetin_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.escapetin_games(id) on delete cascade,
  team_id uuid references public.escapetin_teams(id) on delete cascade,
  challenge_id uuid references public.escapetin_challenges(id) on delete cascade,
  progress_id uuid references public.escapetin_progress(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists escapetin_admin_notifications_user_unread_idx
on public.escapetin_admin_notifications (admin_user_id, read_at, created_at desc);

alter table public.escapetin_admin_notifications enable row level security;

drop policy if exists escapetin_admin_notifications_own_select on public.escapetin_admin_notifications;
create policy escapetin_admin_notifications_own_select
on public.escapetin_admin_notifications
for select to authenticated
using (admin_user_id = auth.uid());

drop policy if exists escapetin_admin_notifications_own_update on public.escapetin_admin_notifications;
create policy escapetin_admin_notifications_own_update
on public.escapetin_admin_notifications
for update to authenticated
using (admin_user_id = auth.uid())
with check (admin_user_id = auth.uid());

drop policy if exists escapetin_games_admin_all on public.escapetin_games;
create policy escapetin_games_admin_all on public.escapetin_games
  for all to authenticated
  using (public.can_manage_escapetin() and created_by = auth.uid())
  with check (public.can_manage_escapetin() and created_by = auth.uid());

drop policy if exists escapetin_games_public_active on public.escapetin_games;
create policy escapetin_games_public_active on public.escapetin_games
  for select to anon
  using (status = 'active');

drop policy if exists escapetin_challenges_admin_all on public.escapetin_challenges;
create policy escapetin_challenges_admin_all on public.escapetin_challenges
  for all to authenticated
  using (
    public.can_manage_escapetin()
    and exists (
      select 1 from public.escapetin_games g
      where g.id = game_id and g.created_by = auth.uid()
    )
  )
  with check (
    public.can_manage_escapetin()
    and exists (
      select 1 from public.escapetin_games g
      where g.id = game_id and g.created_by = auth.uid()
    )
  );

drop policy if exists escapetin_challenges_public_active on public.escapetin_challenges;
create policy escapetin_challenges_public_active on public.escapetin_challenges
  for select to anon
  using (is_active and exists (select 1 from public.escapetin_games g where g.id = game_id and g.status = 'active'));

drop policy if exists escapetin_teams_admin_select on public.escapetin_teams;
create policy escapetin_teams_admin_select on public.escapetin_teams
  for select to authenticated
  using (
    public.can_manage_escapetin()
    and exists (
      select 1 from public.escapetin_games g
      where g.id = game_id and g.created_by = auth.uid()
    )
  );

drop policy if exists escapetin_progress_admin_all on public.escapetin_progress;
create policy escapetin_progress_admin_all on public.escapetin_progress
  for all to authenticated
  using (
    public.can_manage_escapetin()
    and exists (
      select 1 from public.escapetin_games g
      where g.id = game_id and g.created_by = auth.uid()
    )
  )
  with check (
    public.can_manage_escapetin()
    and exists (
      select 1 from public.escapetin_games g
      where g.id = game_id and g.created_by = auth.uid()
    )
  );

drop policy if exists escapetin_uploads_admin_select on public.escapetin_uploads;
create policy escapetin_uploads_admin_select on public.escapetin_uploads
  for select to authenticated
  using (
    public.can_manage_escapetin()
    and exists (
      select 1 from public.escapetin_games g
      where g.id = game_id and g.created_by = auth.uid()
    )
  );

drop function if exists public.escapetin_submit_answer(text, text, text, text);
drop function if exists public.escapetin_submit_answer(text, text, text, text, uuid);
drop function if exists public.escapetin_submit_answer(text, text, text, text, uuid, text);
create or replace function public.escapetin_submit_answer(p_access_code text, p_access_token text, p_answer text default '', p_checkpoint text default '', p_challenge_id uuid default null, p_file_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g escapetin_games;
  t escapetin_teams;
  c escapetin_challenges;
  p escapetin_progress;
  ok boolean := false;
  awarded int := 0;
  used_hints int := 0;
  used_wrong_attempts int := 0;
  option_error_penalty int := 0;
  selected text;
  stored_answer text;
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

  if not ok then
    if c.challenge_type = 'multiple_choice' then
      insert into escapetin_progress (game_id, team_id, challenge_id, wrong_attempts)
      values (g.id, t.id, c.id, 1)
      on conflict (team_id, challenge_id)
      do update set wrong_attempts = escapetin_progress.wrong_attempts + 1, answer = null
      returning * into p;
      return jsonb_build_object(
        'correct', false,
        'message', 'Respuesta incorrecta, intentalo de nuevo.',
        'wrong_attempts', p.wrong_attempts,
        'error_penalty', floor(c.points * 0.25)::int
      );
    end if;
    return jsonb_build_object('correct', false, 'message', 'Respuesta incorrecta, intentalo de nuevo.');
  end if;

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
    if g.created_by is not null then
      insert into escapetin_admin_notifications (admin_user_id, game_id, team_id, challenge_id, progress_id, title, message)
      values (
        g.created_by,
        g.id,
        t.id,
        c.id,
        p.id,
        'Prueba pendiente de revision',
        'El equipo "' || t.name || '" ha enviado la prueba "' || c.title || '" de "' || g.title || '".'
      );
    end if;
    return jsonb_build_object('correct', true, 'message', 'Prueba enviada. Queda pendiente de validacion del administrador.', 'pending', true, 'progress_id', p.id);
  end if;

  used_hints := coalesce(p.hints_used, 0);
  used_wrong_attempts := case when c.challenge_type = 'multiple_choice' then coalesce(p.wrong_attempts, 0) else 0 end;
  option_error_penalty := case when c.challenge_type = 'multiple_choice' then floor(c.points * 0.25)::int * used_wrong_attempts else 0 end;
  awarded := greatest(c.points - option_error_penalty - (used_hints * c.hint_penalty), 0);
  update escapetin_progress set is_correct = true, points_awarded = awarded, completed_at = now() where id = p.id;
  update escapetin_teams set total_points = total_points + awarded, current_challenge_order = c.order_index + 1 where id = t.id;
  return jsonb_build_object('correct', true, 'message', 'Prueba superada. A por la siguiente prueba', 'points_awarded', awarded, 'wrong_attempts', used_wrong_attempts);
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
  select * into g from escapetin_games where id = p.game_id and created_by = auth.uid();
  if not found then return jsonb_build_object('error', 'No autorizado.'); end if;
  select * into c from escapetin_challenges where id = p.challenge_id;

  if not p_approved then
    update escapetin_uploads set status = 'rejected' where progress_id = p.id;
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
  select * into source_game from escapetin_games where id = p_game_id and created_by = auth.uid();
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
    alter publication supabase_realtime add table public.escapetin_admin_notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

grant execute on function public.escapetin_submit_answer(text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.escapetin_duplicate_game(uuid) to authenticated;
grant execute on function public.escapetin_review_progress(uuid, boolean) to authenticated;

commit;
