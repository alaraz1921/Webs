begin;

create or replace function public.trastero_public_photos(entity_type text, entity_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'storage_path', storage_path,
                'thumbnail_path', thumbnail_path,
                'es_portada', es_portada
            )
            order by es_portada desc, created_at desc
        ),
        '[]'::jsonb
    )
    from public.trastero_fotos
    where tipo = entity_type
      and relacion_id = entity_id;
$$;

create or replace function public.trastero_public_folder_children(folder_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'folders',
        coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'type', 'carpeta',
                    'nombre', child.nombre,
                    'codigo', child.codigo,
                    'notas', child.notas,
                    'folder_count', (select count(*) from public.trastero_carpetas where parent_id = child.id and public_enabled),
                    'item_count', (select count(*) from public.trastero_items where carpeta_id = child.id and public_enabled),
                    'photos', public.trastero_public_photos('carpeta', child.id)
                )
                order by child.nombre
            )
            from public.trastero_carpetas child
            where child.parent_id = folder_id
              and child.public_enabled
        ), '[]'::jsonb),
        'items',
        coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'type', 'item',
                    'nombre', item.nombre,
                    'codigo', item.codigo,
                    'notas', item.notas,
                    'cantidad', item.cantidad,
                    'unidad', item.unidad,
                    'photos', public.trastero_public_photos('item', item.id)
                )
                order by item.nombre
            )
            from public.trastero_items item
            where item.carpeta_id = folder_id
              and item.public_enabled
        ), '[]'::jsonb)
    );
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
            'photos', public.trastero_public_photos('carpeta', folder_row.id),
            'children', public.trastero_public_folder_children(folder_row.id),
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
            'photos', public.trastero_public_photos('item', item_row.id),
            'created_at', item_row.created_at,
            'updated_at', item_row.updated_at
        );
        return result;
    end if;

    return jsonb_build_object('available', false);
end;
$$;

drop policy if exists "Public can read public Trastero photos" on storage.objects;
create policy "Public can read public Trastero photos"
on storage.objects
for select
to anon, authenticated
using (
    bucket_id = 'trastero-fotos'
    and exists (
        select 1
        from public.trastero_fotos photo
        where (photo.storage_path = storage.objects.name or photo.thumbnail_path = storage.objects.name)
          and (
              (
                  photo.tipo = 'carpeta'
                  and exists (
                      select 1
                      from public.trastero_carpetas folder
                      where folder.id = photo.relacion_id
                        and folder.public_enabled
                  )
              )
              or (
                  photo.tipo = 'item'
                  and exists (
                      select 1
                      from public.trastero_items item
                      where item.id = photo.relacion_id
                        and item.public_enabled
                  )
              )
          )
    )
);

grant execute on function public.trastero_public_photos(text, bigint) to anon, authenticated;
grant execute on function public.trastero_public_folder_children(bigint) to anon, authenticated;
grant execute on function public.trastero_public_lookup(uuid) to anon, authenticated;

commit;
