begin;

create or replace function public.can_access_trastero()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
    or exists (
        select 1
        from public.profiles profile
        join public.project_members member on member.user_id = profile.id
        join public.app_projects project on project.id = member.project_id
        where profile.id = auth.uid()
          and profile.role = 'viewer'
          and project.slug = 'trastero'
          and project.is_active
          and member.role = 'editor'
    );
$$;

grant execute on function public.can_access_trastero() to authenticated;

create or replace function public.trastero_validate_folder()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if not public.can_access_trastero() then
        raise exception 'Acceso a Trastero no permitido';
    end if;

    if tg_op = 'INSERT' and new.user_id <> auth.uid() then
        raise exception 'user_id no permitido';
    end if;

    if tg_op = 'UPDATE' and new.user_id <> old.user_id then
        raise exception 'No se puede cambiar el propietario';
    end if;

    if new.parent_id is not null and not exists (
        select 1 from public.trastero_carpetas
        where id = new.parent_id
    ) then
        raise exception 'Carpeta padre no permitida';
    end if;

    return new;
end;
$$;

create or replace function public.trastero_validate_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if not public.can_access_trastero() then
        raise exception 'Acceso a Trastero no permitido';
    end if;

    if tg_op = 'INSERT' and new.user_id <> auth.uid() then
        raise exception 'user_id no permitido';
    end if;

    if tg_op = 'UPDATE' and new.user_id <> old.user_id then
        raise exception 'No se puede cambiar el propietario';
    end if;

    if new.carpeta_id is not null and not exists (
        select 1 from public.trastero_carpetas
        where id = new.carpeta_id
    ) then
        raise exception 'Carpeta no permitida';
    end if;

    return new;
end;
$$;

create or replace function public.trastero_validate_photo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if not public.can_access_trastero() then
        raise exception 'Acceso a Trastero no permitido';
    end if;

    if tg_op = 'INSERT' and new.user_id <> auth.uid() then
        raise exception 'user_id no permitido';
    end if;

    if tg_op = 'UPDATE' and new.user_id <> old.user_id then
        raise exception 'No se puede cambiar el propietario';
    end if;

    if new.tipo = 'carpeta' and not exists (
        select 1 from public.trastero_carpetas where id = new.relacion_id
    ) then
        raise exception 'Carpeta no permitida';
    end if;

    if new.tipo = 'item' and not exists (
        select 1 from public.trastero_items where id = new.relacion_id
    ) then
        raise exception 'Item no permitido';
    end if;

    return new;
end;
$$;

drop policy if exists "Trastero own folders" on public.trastero_carpetas;
create policy "Trastero own folders" on public.trastero_carpetas
for all to authenticated
using (public.can_access_trastero())
with check (public.can_access_trastero());

drop policy if exists "Trastero own items" on public.trastero_items;
create policy "Trastero own items" on public.trastero_items
for all to authenticated
using (public.can_access_trastero())
with check (public.can_access_trastero());

drop policy if exists "Trastero own photos" on public.trastero_fotos;
create policy "Trastero own photos" on public.trastero_fotos
for all to authenticated
using (public.can_access_trastero())
with check (public.can_access_trastero());

drop policy if exists "Trastero users read own photos" on storage.objects;
create policy "Trastero users read own photos" on storage.objects for select to authenticated
using (bucket_id = 'trastero-fotos' and public.can_access_trastero());

drop policy if exists "Trastero users upload own photos" on storage.objects;
create policy "Trastero users upload own photos" on storage.objects for insert to authenticated
with check (bucket_id = 'trastero-fotos' and public.can_access_trastero() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Trastero users update own photos" on storage.objects;
create policy "Trastero users update own photos" on storage.objects for update to authenticated
using (bucket_id = 'trastero-fotos' and public.can_access_trastero())
with check (bucket_id = 'trastero-fotos' and public.can_access_trastero());

drop policy if exists "Trastero users delete own photos" on storage.objects;
create policy "Trastero users delete own photos" on storage.objects for delete to authenticated
using (bucket_id = 'trastero-fotos' and public.can_access_trastero());

commit;
