alter table public.infiltrado_partidas
    add column if not exists finalizacion_online text;

create or replace function public.infiltrado_online_exists(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_estado text;
begin
    select estado_online into v_estado
    from public.infiltrado_partidas
    where codigo_publico = trim(p_codigo) and modo = 'online';

    if not found then
        return jsonb_build_object('ok', false, 'message', 'La partida no existe.');
    end if;

    if v_estado = 'started' then
        return jsonb_build_object('ok', false, 'message', 'La partida ya ha comenzado.');
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.infiltrado_online_state(p_codigo text, p_player_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_partida public.infiltrado_partidas%rowtype;
    v_jugador public.infiltrado_jugadores%rowtype;
    v_jugadores jsonb;
    v_resultado jsonb;
    v_infiltrados jsonb;
begin
    select * into v_partida
    from public.infiltrado_partidas
    where codigo_publico = trim(p_codigo) and modo = 'online';

    if not found then
        return jsonb_build_object('ok', false, 'message', 'La partida no existe.');
    end if;

    select * into v_jugador
    from public.infiltrado_jugadores
    where partida_id = v_partida.id and player_token = p_player_token;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'El acceso a esta partida ya no es valido.');
    end if;

    update public.infiltrado_jugadores
    set last_seen_at = now()
    where id = v_jugador.id and last_seen_at < now() - interval '20 seconds';

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', j.id,
        'nombre', j.nombre,
        'es_anfitrion', j.es_anfitrion,
        'last_seen_at', j.last_seen_at
    ) order by j.orden), '[]'::jsonb)
    into v_jugadores
    from public.infiltrado_jugadores j
    where j.partida_id = v_partida.id;

    if v_partida.estado_online = 'finished' then
        select coalesce(jsonb_agg(j.nombre order by j.orden), '[]'::jsonb)
        into v_infiltrados
        from public.infiltrado_jugadores j
        where j.partida_id = v_partida.id and j.infiltrado;

        select jsonb_build_object(
            'acierto', r.acierto,
            'seleccionados', to_jsonb(array_remove(array[j1.nombre, j2.nombre], null)),
            'infiltrados_reales', v_infiltrados
        )
        into v_resultado
        from public.infiltrado_resultados r
        left join public.infiltrado_jugadores j1 on j1.id = r.jugador_sospechoso_1
        left join public.infiltrado_jugadores j2 on j2.id = r.jugador_sospechoso_2
        where r.partida_id = v_partida.id
        order by r.created_at desc
        limit 1;
    end if;

    return jsonb_build_object(
        'ok', true,
        'partida_id', v_partida.id,
        'codigo_publico', v_partida.codigo_publico,
        'estado_online', v_partida.estado_online,
        'finalizacion_online', v_partida.finalizacion_online,
        'numero_infiltrados', v_partida.numero_infiltrados,
        'tipo_palabra', v_partida.tipo_palabra,
        'nombre_jugador', v_jugador.nombre,
        'jugador_nuevo_tras_final', coalesce(v_partida.ended_at is not null and v_jugador.created_at > v_partida.ended_at, false),
        'es_anfitrion', coalesce(
            v_jugador.es_anfitrion and auth.uid() = v_partida.user_id and public.can_use_infiltrado(),
            false
        ),
        'rol', case when v_partida.estado_online = 'started' and v_jugador.infiltrado then 'infiltrado'
                    when v_partida.estado_online = 'started' then 'normal'
                    else null end,
        'palabra_oculta', case when v_partida.estado_online = 'finished' or
                                    (v_partida.estado_online = 'started' and not v_jugador.infiltrado)
                               then v_partida.palabra_oculta else null end,
        'jugadores', v_jugadores,
        'resultado', v_resultado
    );
end;
$$;

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
    set estado_online = 'finished',
        finalizacion_online = 'resolved',
        fase = 'FINALIZADA',
        ended_at = now(),
        updated_at = now()
    where id = p_partida_id;

    return jsonb_build_object('ok', true, 'acierto', true);
end;
$$;

create or replace function public.infiltrado_online_end_round(
    p_partida_id uuid,
    p_player_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or not public.can_use_infiltrado() or not exists (
        select 1
        from public.infiltrado_partidas p
        join public.infiltrado_jugadores j on j.partida_id = p.id
        where p.id = p_partida_id
          and p.modo = 'online'
          and p.estado_online = 'started'
          and p.user_id = auth.uid()
          and j.player_token = p_player_token
          and j.es_anfitrion
    ) then
        return jsonb_build_object('ok', false, 'message', 'Solo el anfitrion puede terminar la ronda.');
    end if;

    delete from public.infiltrado_palabras_usadas where partida_id = p_partida_id;

    update public.infiltrado_partidas
    set estado_online = 'finished',
        finalizacion_online = 'host_ended',
        fase = 'FINALIZADA',
        ended_at = now(),
        updated_at = now()
    where id = p_partida_id;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.infiltrado_online_exists(text) from public;
revoke all on function public.infiltrado_online_state(text, text) from public;
revoke all on function public.infiltrado_online_finish(uuid, text, bigint, bigint) from public;
revoke all on function public.infiltrado_online_end_round(uuid, text) from public;

grant execute on function public.infiltrado_online_exists(text) to anon, authenticated;
grant execute on function public.infiltrado_online_state(text, text) to anon, authenticated;
grant execute on function public.infiltrado_online_finish(uuid, text, bigint, bigint) to authenticated;
grant execute on function public.infiltrado_online_end_round(uuid, text) to authenticated;
