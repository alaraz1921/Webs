create or replace function public.validate_daily_access_code(
    p_game_slug text,
    p_access_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_expected_code integer;
    v_submitted_code integer;
begin
    if p_game_slug not in ('bingo_monitor', 'infiltrado') then
        return false;
    end if;

    if p_access_code is null or p_access_code !~ '^[0-9]{1,4}$' then
        return false;
    end if;

    v_submitted_code := p_access_code::integer;
    v_expected_code := extract(day from timezone('Europe/Madrid', now()))::integer + 1021;

    return v_submitted_code = v_expected_code;
end;
$$;

create or replace function public.get_daily_access_formula_note()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    return E'La clave para El Infiltrado y El Moninor de bingo es:\nDía del mes + 1021. \nEjemplo: si hoy es día 7, la clave es 1028.';
end;
$$;

grant execute on function public.validate_daily_access_code(text, text) to anon, authenticated;
grant execute on function public.get_daily_access_formula_note() to authenticated;
