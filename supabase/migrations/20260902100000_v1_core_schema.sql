-- Gojo · v1.0 core schema
-- Four core tables: families, users, locations, messages.
-- Multi-tenant: every row is scoped to a family_id. Isolation is enforced by
-- Row Level Security (see 20260902100200_v1_rls.sql), not the app layer.

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 80),
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

comment on table public.families is 'One row per family group (tenant).';
comment on column public.families.invite_code is 'Short human-typable code used to join. Unique; can be regenerated.';

-- ---------------------------------------------------------------------------
-- users  (users.id == auth.users.id)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  family_id           uuid references public.families (id) on delete set null,
  name                text not null default '' check (char_length(name) <= 80),
  avatar_url          text,
  email               text,
  -- master tracking toggle state. false => pin hidden from every family map.
  is_sharing          boolean not null default false,
  -- Expo push token for this user's current device.
  push_token          text,
  -- optional manual language override ('en' | 'tw'); null => follow device.
  language            text check (language in ('en', 'tw')),
  -- Safety Layer 1: explicit consent, logged with a timestamp.
  consent_accepted_at timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists users_family_id_idx on public.users (family_id);

comment on table public.users is 'App profile row, 1:1 with auth.users. Created automatically on sign-up.';
comment on column public.users.is_sharing is 'Master tracking toggle. When false the pin disappears from all family maps.';
comment on column public.users.consent_accepted_at is 'Safety Layer 1, when the user accepted the "your family can see your location" screen.';

-- ---------------------------------------------------------------------------
-- locations  (exactly one row per user, updated in place on every GPS fix)
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  user_id    uuid primary key references public.users (id) on delete cascade,
  latitude   double precision not null,
  longitude  double precision not null,
  accuracy   double precision,
  speed      double precision,
  updated_at timestamptz not null default now()
);

comment on table public.locations is 'Live position, one row per user, upserted in place. Row is deleted when the user stops sharing.';

-- ---------------------------------------------------------------------------
-- messages  (single flat family group chat)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  -- 'text' => plain message; 'location' => tappable map card (uses lat/lng).
  kind      text not null default 'text' check (kind in ('text', 'location')),
  body      text check (char_length(body) <= 2000),
  latitude  double precision,
  longitude double precision,
  sent_at   timestamptz not null default now(),
  constraint messages_shape check (
    (kind = 'text'     and body is not null) or
    (kind = 'location' and latitude is not null and longitude is not null)
  )
);

create index if not exists messages_family_sent_idx on public.messages (family_id, sent_at desc);

comment on table public.messages is 'Flat family group chat. No threads, no channels. kind=location carries a shareable map card.';
