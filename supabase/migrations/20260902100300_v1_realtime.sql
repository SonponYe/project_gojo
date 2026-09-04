-- Gojo · v1.0 realtime
-- Map pins and chat update over Supabase Realtime, no polling.

-- REPLICA IDENTITY FULL so UPDATE events on locations carry the full new row
-- (locations is upserted in place on every GPS fix).
alter table public.locations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locations'
  ) then
    alter publication supabase_realtime add table public.locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
