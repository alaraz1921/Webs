begin;

insert into public.app_projects (slug, name, description)
values ('gincanas', 'EscapeTin - Gincanas', 'Editor de gincanas, pistas y misiones de EscapeTin.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

create or replace function public.can_manage_escapetin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.has_active_games_access(auth.uid())
        and (
            public.is_admin()
            or exists (
                select 1
                from public.project_members pm
                join public.app_projects ap on ap.id = pm.project_id
                where pm.user_id = auth.uid()
                  and ap.slug = 'gincanas'
                  and ap.is_active
                  and pm.role in ('owner', 'editor')
            )
        );
$$;

revoke all on function public.can_manage_escapetin() from public;
grant execute on function public.can_manage_escapetin() to authenticated;

commit;
