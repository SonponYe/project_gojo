-- Gojo · v2.0 addendum — RLS + realtime for the new tables.

alter table public.sos_alerts  enable row level security;
alter table public.saved_places enable row level security;

-- ---------------------------------------------------------------------------
-- sos_alerts
--   INSERT: any member, for their own family, as themselves.
--   SELECT: every member sees every alert for their family.
--   UPDATE: only the sender can resolve their own alert ("I'm OK").
-- ---------------------------------------------------------------------------
create policy sos_insert_own on public.sos_alerts
  for insert to authenticated
  with check (
    family_id = (select public.current_family_id())
    and sender_id = (select auth.uid())
  );

create policy sos_select_family on public.sos_alerts
  for select to authenticated
  using (family_id = (select public.current_family_id()));

create policy sos_update_own on public.sos_alerts
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- saved_places — fully private to their owner (place names are personal).
-- ---------------------------------------------------------------------------
create policy places_select_own on public.saved_places
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy places_insert_own on public.saved_places
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy places_update_own on public.saved_places
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy places_delete_own on public.saved_places
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- realtime — the pin pulses red for the whole family the moment an SOS fires.
-- ---------------------------------------------------------------------------
alter table public.sos_alerts replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sos_alerts'
  ) then
    alter publication supabase_realtime add table public.sos_alerts;
  end if;
end;
$$;
