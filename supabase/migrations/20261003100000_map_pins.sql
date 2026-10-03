-- Gojo · shared family map pins
--
-- Distinct from saved_places (which are private labels for YOUR OWN moving
-- pin). A map_pin is a standalone, family-visible marker dropped at a point —
-- "I was here", "meet me here" — independent of anyone's live position.

create table if not exists public.map_pins (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references public.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 40),
  lat        double precision not null,
  lng        double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists map_pins_family_idx on public.map_pins (family_id, created_at desc);

comment on table public.map_pins is 'Shared waypoints dropped by a family member, visible to the whole family.';

alter table public.map_pins enable row level security;

create policy map_pins_select_family on public.map_pins
  for select to authenticated
  using (family_id = (select public.current_family_id()));

create policy map_pins_insert_own on public.map_pins
  for insert to authenticated
  with check (
    family_id = (select public.current_family_id())
    and created_by = (select auth.uid())
  );

create policy map_pins_delete_own on public.map_pins
  for delete to authenticated
  using (created_by = (select auth.uid()));

alter table public.map_pins replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_pins'
  ) then
    alter publication supabase_realtime add table public.map_pins;
  end if;
end;
$$;
