-- Gojo · v2.0 addendum schema
-- Adds: battery level + signal type on locations, a named-place label,
-- the sos_alerts table, and the saved_places table.

-- ---------------------------------------------------------------------------
-- locations, new columns (★ in the v2 schema figure)
-- ---------------------------------------------------------------------------
alter table public.locations
  add column if not exists battery_level real
    check (battery_level is null or battery_level between 0 and 1),
  add column if not exists signal_type text
    check (signal_type is null or signal_type in ('wifi', '4g', '3g', '2g', 'none', 'unknown')),
  -- Named place label ("Home", "Market") matched client-side, else null.
  add column if not exists place_name text
    check (place_name is null or char_length(place_name) <= 40);

comment on column public.locations.battery_level is 'v2, phone battery, 0.0-1.0, sent on every update.';
comment on column public.locations.signal_type  is 'v2, connectivity type at time of update.';
comment on column public.locations.place_name   is 'v2, matched saved-place name for this position, if any.';

-- ---------------------------------------------------------------------------
-- sos_alerts, one row per SOS event (v2.3)
-- ---------------------------------------------------------------------------
create table if not exists public.sos_alerts (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.users (id) on delete cascade,
  family_id   uuid not null references public.families (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  -- set when the sender taps "I'm OK", or 30 min after created_at (auto-clear).
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists sos_alerts_family_active_idx
  on public.sos_alerts (family_id, created_at desc)
  where resolved_at is null;

comment on table public.sos_alerts is 'v2, an "I need help" alert fanned out to the whole family via push.';

-- Active alerts = unresolved and less than 30 minutes old. The app reads this
-- view; a scheduled job (optional, see 20260902300000) hard-clears the rest.
create or replace view public.active_sos_alerts
with (security_invoker = true) as
  select *
    from public.sos_alerts
   where resolved_at is null
     and created_at > now() - interval '30 minutes';

comment on view public.active_sos_alerts is 'v2, unresolved SOS alerts under 30 minutes old.';

-- ---------------------------------------------------------------------------
-- saved_places, personal named locations (v2.4)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_places (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 40),
  lat        double precision not null,
  lng        double precision not null,
  radius_m   integer not null default 150 check (radius_m between 50 and 500),
  created_at timestamptz not null default now()
);

create index if not exists saved_places_user_idx on public.saved_places (user_id);

comment on table public.saved_places is 'v2, up to 10 personal named places per user. Names are private to their owner.';

-- Enforce the "max 10 per user" cap from the spec.
create or replace function public.saved_places_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_places where user_id = new.user_id) >= 10 then
    raise exception 'you can save at most 10 places' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_places_limit on public.saved_places;
create trigger saved_places_limit
  before insert on public.saved_places
  for each row execute function public.saved_places_enforce_limit();
