begin;

create or replace function public.trastero_is_public_photo_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.trastero_fotos photo
        where (photo.storage_path = object_name or photo.thumbnail_path = object_name)
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
    );
$$;

grant execute on function public.trastero_is_public_photo_path(text) to anon, authenticated;

drop policy if exists "Public can read public Trastero photos" on storage.objects;
create policy "Public can read public Trastero photos"
on storage.objects
for select
to anon, authenticated
using (
    bucket_id = 'trastero-fotos'
    and public.trastero_is_public_photo_path(name)
);

commit;
