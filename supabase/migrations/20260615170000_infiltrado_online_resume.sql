create or replace function public.infiltrado_online_resume_host(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_partida_id uuid;
    v_token text;
begin
    if auth.uid() is null or not public.can_use_infiltrado() then
        return jsonb_build_object('ok', false, 'message', 'Debes iniciar sesión para recuperar la partida.');
    end if;

    select p.id, j.player_token
    into v_partida_id, v_token
    from public.infiltrado_partidas p
    join public.infiltrado_jugadores j on j.partida_id = p.id and j.es_anfitrion
    where p.codigo_publico = trim(p_codigo)
      and p.modo = 'online'
      and p.user_id = auth.uid();

    if not found then
        return jsonb_build_object('ok', false, 'message', 'No eres el anfitrión de esta partida.');
    end if;

    return jsonb_build_object(
        'ok', true,
        'partida_id', v_partida_id,
        'codigo_publico', trim(p_codigo),
        'player_token', v_token
    );
end;
$$;

revoke all on function public.infiltrado_online_resume_host(text) from public;
grant execute on function public.infiltrado_online_resume_host(text) to authenticated;
