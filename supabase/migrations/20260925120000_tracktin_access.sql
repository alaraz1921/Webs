begin;

insert into public.app_projects (slug, name, description)
values ('tracktin', 'TrackTin', 'Seguimiento personal de peliculas, series y episodios.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

create or replace function public.can_use_tracktin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.is_admin()
        or exists (
            select 1
            from public.project_members pm
            join public.app_projects ap on ap.id = pm.project_id
            where pm.user_id = auth.uid()
              and ap.slug = 'tracktin'
              and ap.is_active
        );
$$;

revoke all on function public.can_use_tracktin() from public;
grant execute on function public.can_use_tracktin() to authenticated;

drop policy if exists tracktin_media_select on public.tracktin_media;
drop policy if exists tracktin_media_insert on public.tracktin_media;
drop policy if exists tracktin_media_update on public.tracktin_media;
drop policy if exists tracktin_media_delete on public.tracktin_media;
create policy tracktin_media_select on public.tracktin_media
for select to authenticated using (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_media_insert on public.tracktin_media
for insert to authenticated with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_media_update on public.tracktin_media
for update to authenticated using (auth.uid() = user_id and public.can_use_tracktin())
with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_media_delete on public.tracktin_media
for delete to authenticated using (auth.uid() = user_id and public.can_use_tracktin());

drop policy if exists tracktin_episode_select on public.tracktin_episode_progress;
drop policy if exists tracktin_episode_insert on public.tracktin_episode_progress;
drop policy if exists tracktin_episode_update on public.tracktin_episode_progress;
drop policy if exists tracktin_episode_delete on public.tracktin_episode_progress;
create policy tracktin_episode_select on public.tracktin_episode_progress
for select to authenticated using (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_episode_insert on public.tracktin_episode_progress
for insert to authenticated with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_episode_update on public.tracktin_episode_progress
for update to authenticated using (auth.uid() = user_id and public.can_use_tracktin())
with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_episode_delete on public.tracktin_episode_progress
for delete to authenticated using (auth.uid() = user_id and public.can_use_tracktin());

drop policy if exists tracktin_prefs_select on public.tracktin_user_preferences;
drop policy if exists tracktin_prefs_insert on public.tracktin_user_preferences;
drop policy if exists tracktin_prefs_update on public.tracktin_user_preferences;
drop policy if exists tracktin_prefs_delete on public.tracktin_user_preferences;
create policy tracktin_prefs_select on public.tracktin_user_preferences
for select to authenticated using (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_prefs_insert on public.tracktin_user_preferences
for insert to authenticated with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_prefs_update on public.tracktin_user_preferences
for update to authenticated using (auth.uid() = user_id and public.can_use_tracktin())
with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_prefs_delete on public.tracktin_user_preferences
for delete to authenticated using (auth.uid() = user_id and public.can_use_tracktin());

drop policy if exists tracktin_lists_select on public.tracktin_custom_lists;
drop policy if exists tracktin_lists_insert on public.tracktin_custom_lists;
drop policy if exists tracktin_lists_update on public.tracktin_custom_lists;
drop policy if exists tracktin_lists_delete on public.tracktin_custom_lists;
create policy tracktin_lists_select on public.tracktin_custom_lists
for select to authenticated using (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_lists_insert on public.tracktin_custom_lists
for insert to authenticated with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_lists_update on public.tracktin_custom_lists
for update to authenticated using (auth.uid() = user_id and public.can_use_tracktin())
with check (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_lists_delete on public.tracktin_custom_lists
for delete to authenticated using (auth.uid() = user_id and public.can_use_tracktin());

drop policy if exists tracktin_list_items_select on public.tracktin_custom_list_items;
drop policy if exists tracktin_list_items_insert on public.tracktin_custom_list_items;
drop policy if exists tracktin_list_items_update on public.tracktin_custom_list_items;
drop policy if exists tracktin_list_items_delete on public.tracktin_custom_list_items;
create policy tracktin_list_items_select on public.tracktin_custom_list_items
for select to authenticated using (auth.uid() = user_id and public.can_use_tracktin());
create policy tracktin_list_items_insert on public.tracktin_custom_list_items
for insert to authenticated with check (auth.uid() = user_id and public.can_use_tracktin() and exists (
    select 1 from public.tracktin_custom_lists l where l.id = list_id and l.user_id = auth.uid()
));
create policy tracktin_list_items_update on public.tracktin_custom_list_items
for update to authenticated using (auth.uid() = user_id and public.can_use_tracktin() and exists (
    select 1 from public.tracktin_custom_lists l where l.id = list_id and l.user_id = auth.uid()
)) with check (auth.uid() = user_id and public.can_use_tracktin() and exists (
    select 1 from public.tracktin_custom_lists l where l.id = list_id and l.user_id = auth.uid()
));
create policy tracktin_list_items_delete on public.tracktin_custom_list_items
for delete to authenticated using (auth.uid() = user_id and public.can_use_tracktin());

commit;
