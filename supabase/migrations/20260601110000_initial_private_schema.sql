create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    display_name text,
    role text not null default 'viewer' check (role in ('admin', 'member', 'viewer')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.app_projects (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.project_members (
    project_id uuid not null references public.app_projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
    created_at timestamptz not null default now(),
    primary key (project_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.app_projects enable row level security;
alter table public.project_members enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
    );
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "Admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Members can read active projects"
on public.app_projects
for select
to authenticated
using (
    is_active
    and exists (
        select 1
        from public.project_members
        where project_members.project_id = app_projects.id
          and project_members.user_id = auth.uid()
    )
);

create policy "Admins can manage projects"
on public.app_projects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users can read own project memberships"
on public.project_members
for select
to authenticated
using (user_id = auth.uid());

create policy "Admins can manage project memberships"
on public.project_members
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.app_projects (slug, name, description)
values ('privado', 'Zona privada', 'Primer espacio privado de alaraz1921.');
