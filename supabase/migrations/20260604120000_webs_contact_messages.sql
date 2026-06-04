create table if not exists public.webs_contact_messages (
    id uuid primary key default gen_random_uuid(),
    nombre text not null,
    email text not null,
    asunto text not null,
    mensaje text not null,
    page_url text,
    created_at timestamptz not null default now()
);

create index if not exists idx_webs_contact_messages_created_at
on public.webs_contact_messages(created_at desc);

alter table public.webs_contact_messages enable row level security;

drop policy if exists "Public can insert webs contact messages" on public.webs_contact_messages;
create policy "Public can insert webs contact messages"
on public.webs_contact_messages
for insert
to anon
with check (
    length(trim(nombre)) > 0
    and length(trim(email)) > 0
    and length(trim(asunto)) > 0
    and length(trim(mensaje)) > 0
);

drop policy if exists "Admins can read webs contact messages" on public.webs_contact_messages;
create policy "Admins can read webs contact messages"
on public.webs_contact_messages
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can delete webs contact messages" on public.webs_contact_messages;
create policy "Admins can delete webs contact messages"
on public.webs_contact_messages
for delete
to authenticated
using (public.is_admin());
