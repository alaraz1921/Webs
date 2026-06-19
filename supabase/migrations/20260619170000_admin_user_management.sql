create or replace function public.admin_delete_registered_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null or not public.is_admin() then
        return jsonb_build_object('ok', false, 'message', 'Solo los administradores pueden borrar usuarios.');
    end if;

    if p_user_id = auth.uid() then
        return jsonb_build_object('ok', false, 'message', 'No puedes borrar tu propio usuario desde esta pantalla.');
    end if;

    delete from public.project_members where user_id = p_user_id;
    delete from public.profiles where id = p_user_id;
    delete from auth.users where id = p_user_id;

    return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_delete_registered_user(uuid) from public;
grant execute on function public.admin_delete_registered_user(uuid) to authenticated;
