begin;

alter table public.trastero_carpetas
    add column if not exists public_token uuid not null default gen_random_uuid(),
    add column if not exists public_enabled boolean not null default true;

alter table public.trastero_items
    add column if not exists public_token uuid not null default gen_random_uuid(),
    add column if not exists public_enabled boolean not null default true;

create unique index if not exists trastero_carpetas_public_token_idx
    on public.trastero_carpetas(public_token);

create unique index if not exists trastero_items_public_token_idx
    on public.trastero_items(public_token);

create or replace function public.trastero_folder_path(folder_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
    with recursive folder_tree as (
        select id, parent_id, nombre, 0 as depth
        from public.trastero_carpetas
        where id = folder_id
        union all
        select parent.id, parent.parent_id, parent.nombre, folder_tree.depth + 1
        from public.trastero_carpetas parent
        join folder_tree on folder_tree.parent_id = parent.id
    )
    select coalesce(string_agg(nombre, ' / ' order by depth desc), '')
    from folder_tree;
$$;

create or replace function public.trastero_public_lookup(token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    folder_row public.trastero_carpetas%rowtype;
    item_row public.trastero_items%rowtype;
    result jsonb;
begin
    select *
    into folder_row
    from public.trastero_carpetas
    where public_token = token
    limit 1;

    if found then
        if not folder_row.public_enabled then
            return jsonb_build_object('available', false);
        end if;

        result := jsonb_build_object(
            'available', true,
            'type', 'carpeta',
            'id', folder_row.id,
            'owner_id', folder_row.user_id,
            'nombre', folder_row.nombre,
            'codigo', folder_row.codigo,
            'notas', folder_row.notas,
            'path', public.trastero_folder_path(folder_row.id),
            'folder_count', (select count(*) from public.trastero_carpetas where parent_id = folder_row.id and public_enabled),
            'item_count', (select count(*) from public.trastero_items where carpeta_id = folder_row.id and public_enabled),
            'created_at', folder_row.created_at,
            'updated_at', folder_row.updated_at
        );
        return result;
    end if;

    select *
    into item_row
    from public.trastero_items
    where public_token = token
    limit 1;

    if found then
        if not item_row.public_enabled then
            return jsonb_build_object('available', false);
        end if;

        result := jsonb_build_object(
            'available', true,
            'type', 'item',
            'id', item_row.id,
            'owner_id', item_row.user_id,
            'nombre', item_row.nombre,
            'codigo', item_row.codigo,
            'notas', item_row.notas,
            'cantidad', item_row.cantidad,
            'unidad', item_row.unidad,
            'path', public.trastero_folder_path(item_row.carpeta_id),
            'created_at', item_row.created_at,
            'updated_at', item_row.updated_at
        );
        return result;
    end if;

    return jsonb_build_object('available', false);
end;
$$;

grant execute on function public.trastero_folder_path(bigint) to anon, authenticated;
grant execute on function public.trastero_public_lookup(uuid) to anon, authenticated;

commit;
