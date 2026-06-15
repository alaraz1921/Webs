create or replace function public.infiltrado_online_finish(
    p_partida_id uuid,
    p_player_token text,
    p_sospechoso_1 bigint,
    p_sospechoso_2 bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_partida public.infiltrado_partidas%rowtype;
    v_reales bigint[];
    v_seleccionados bigint[];
    v_acierto boolean;
begin
    select * into v_partida
    from public.infiltrado_partidas
    where id = p_partida_id and modo = 'online' and user_id = auth.uid() and estado_online = 'started';

    if not found or not public.can_use_infiltrado() or not exists (
        select 1 from public.infiltrado_jugadores
        where partida_id = p_partida_id and player_token = p_player_token and es_anfitrion
    ) then
        return jsonb_build_object('ok', false, 'message', 'Solo el anfitrion puede resolver la partida.');
    end if;

    if (v_partida.numero_infiltrados = 2 and (p_sospechoso_2 is null or p_sospechoso_1 = p_sospechoso_2))
       or (v_partida.numero_infiltrados = 1 and p_sospechoso_2 is not null) then
        return jsonb_build_object('ok', false, 'message', 'Selecciona una persona distinta por cada infiltrado.');
    end if;

    if not exists (
        select 1 from public.infiltrado_jugadores where id = p_sospechoso_1 and partida_id = p_partida_id
    ) or (p_sospechoso_2 is not null and not exists (
        select 1 from public.infiltrado_jugadores where id = p_sospechoso_2 and partida_id = p_partida_id
    )) then
        return jsonb_build_object('ok', false, 'message', 'La seleccion no pertenece a esta partida.');
    end if;

    select array_agg(id order by id) into v_reales
    from public.infiltrado_jugadores
    where partida_id = p_partida_id and infiltrado;

    select array_agg(valor order by valor) into v_seleccionados
    from unnest(array_remove(array[p_sospechoso_1, p_sospechoso_2], null)) as valor;

    v_acierto := v_reales = v_seleccionados;

    if not v_acierto then
        return jsonb_build_object('ok', true, 'acierto', false);
    end if;

    insert into public.infiltrado_resultados (
        partida_id, jugador_sospechoso_1, jugador_sospechoso_2, acierto
    )
    values (p_partida_id, p_sospechoso_1, p_sospechoso_2, true);

    delete from public.infiltrado_palabras_usadas where partida_id = p_partida_id;

    update public.infiltrado_partidas
    set estado_online = 'finished', fase = 'FINALIZADA', ended_at = now(), updated_at = now()
    where id = p_partida_id;

    return jsonb_build_object('ok', true, 'acierto', true);
end;
$$;

revoke all on function public.infiltrado_online_finish(uuid, text, bigint, bigint) from public;
grant execute on function public.infiltrado_online_finish(uuid, text, bigint, bigint) to authenticated;
