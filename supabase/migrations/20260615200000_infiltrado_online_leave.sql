create or replace function public.infiltrado_online_leave(
    p_partida_id uuid,
    p_player_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_jugador public.infiltrado_jugadores%rowtype;
    v_partida public.infiltrado_partidas%rowtype;
begin
    select * into v_jugador
    from public.infiltrado_jugadores
    where partida_id = p_partida_id and player_token = p_player_token;

    if not found then
        return jsonb_build_object('ok', false, 'message', 'El jugador ya no pertenece a esta partida.');
    end if;

    select * into v_partida
    from public.infiltrado_partidas
    where id = p_partida_id and modo = 'online';

    if not found then
        return jsonb_build_object('ok', false, 'message', 'La partida ya no existe.');
    end if;

    if v_jugador.es_anfitrion then
        if auth.uid() is null or auth.uid() <> v_partida.user_id or not public.can_use_infiltrado() then
            return jsonb_build_object('ok', false, 'message', 'Solo el anfitrion autenticado puede eliminar la partida.');
        end if;

        delete from public.infiltrado_partidas where id = p_partida_id;
        return jsonb_build_object('ok', true, 'partida_eliminada', true);
    end if;

    delete from public.infiltrado_jugadores where id = v_jugador.id;
    return jsonb_build_object('ok', true, 'partida_eliminada', false);
end;
$$;

revoke all on function public.infiltrado_online_leave(uuid, text) from public;
grant execute on function public.infiltrado_online_leave(uuid, text) to anon, authenticated;
