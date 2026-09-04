-- Gojo · v1.0 Row Level Security
-- Core rule: a user can only ever touch rows belonging to their own family.
-- Safety Layer 4 (mutual visibility) is enforced here at the database level:
-- family members always see each other's locations symmetrically.

alter table public.families  enable row level security;
alter table public.users     enable row level security;
alter table public.locations enable row level security;
alter table public.messages  enable row level security;

-- ---------------------------------------------------------------------------
-- families, read your own family only. Writes go through SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
create policy families_select_own on public.families
  for select to authenticated
  using (id = (select public.current_family_id()));

-- ---------------------------------------------------------------------------
-- users, see yourself and everyone in your family.
-- ---------------------------------------------------------------------------
create policy users_select_self_or_family on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or family_id = (select public.current_family_id())
  );

create policy users_insert_self on public.users
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy users_delete_self on public.users
  for delete to authenticated
  using (id = (select auth.uid()));

-- Column-level guard: users may only edit these fields directly. family_id,
-- consent_accepted_at, id and created_at can only change via the onboarding
-- RPCs (which run as owner), so joining/leaving a family is always audited.
revoke update on public.users from authenticated;
grant update (name, avatar_url, email, is_sharing, push_token, language)
  on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- locations, Safety Layer 4: if you can see someone, they can see you.
-- Everyone in the family sees every (sharing) family member's location.
-- You can only write your own row.
-- ---------------------------------------------------------------------------
create policy locations_select_family on public.locations
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = locations.user_id
        and u.family_id = (select public.current_family_id())
    )
  );

create policy locations_insert_self on public.locations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy locations_update_self on public.locations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy locations_delete_self on public.locations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- messages, read/write only within your family; you can only send as yourself.
-- ---------------------------------------------------------------------------
create policy messages_select_family on public.messages
  for select to authenticated
  using (family_id = (select public.current_family_id()));

create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    family_id = (select public.current_family_id())
    and sender_id = (select auth.uid())
  );

create policy messages_delete_own on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));
