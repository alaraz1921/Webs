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

grant execute on function public.validate_daily_access_code(text, text) to anon, authenticated;
