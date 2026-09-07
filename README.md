# Gojo, Family Location & Safety App

Always-on family location sharing, last-known-location when offline, and a
lightweight family group chat. Built from `Gojo_App_Description.docx` (v1) and
`Gojo_App_Description_v2.docx` (v2 addendum: battery, signal, SOS, named places,
Twi).

```
project_gojo/
├── mobile/       Expo (SDK 57) + expo-router + TypeScript app
├── supabase/     Postgres migrations, RLS, RPCs, Edge Functions
└── *.docx        Product description documents
```

## Architecture at a glance

| Concern | How |
| --- | --- |
| Live map | MapLibre GL (`@maplibre/maplibre-react-native` v11), OpenFreeMap street tiles by default (free, no key) |
| Background location | `expo-location` + `expo-task-manager` OS task, 60s / balanced accuracy, foreground-service banner, boot auto-resume |
| Realtime | Supabase Realtime channels for `locations`, `messages`, `sos_alerts`, no polling |
| Multi-tenant isolation | Every table family-scoped; Postgres RLS built on `current_family_id()`; `family_id` only mutable via audited `create_family` / `join_family` RPCs |
| Mutual visibility (Layer 4) | Enforced in the `locations` SELECT policy, not the UI |
| Awareness ping (Layer 2) | 6-hour repeating local notification, scheduled while sharing is on |
| SOS | `sos-alert` Edge Function records the row + fans Expo push to the family in one call (<2s); pin pulses red; auto-clears after 30 min |
| i18n | `i18n-js` + `expo-localization`; `en` full, `tw` covers the six key phrases with fallback |

## 1. Backend setup (Supabase)

**Project `qevscpmifoqkkfiysynx` (eu-west-1), all 7 migrations are already
applied** (schema, RLS, RPCs, realtime for `locations` / `messages` /
`sos_alerts`, plus the optional pg_cron SOS auto-clear + pg_net chat trigger).
`mobile/.env` holds the URL + anon key.

Re-applying is idempotent:
```bash
supabase link --project-ref qevscpmifoqkkfiysynx
supabase db push
```

### Edge Functions, deployed ✓
`sos-alert` and `notify-message` are live on `qevscpmifoqkkfiysynx` (both
`verify_jwt=false`; they check auth themselves). Redeploy after edits:
```bash
export SUPABASE_ACCESS_TOKEN=...           # from supabase/.env (gitignored)
npx supabase functions deploy sos-alert      --project-ref qevscpmifoqkkfiysynx --no-verify-jwt
npx supabase functions deploy notify-message --project-ref qevscpmifoqkkfiysynx --no-verify-jwt
```
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into the runtime.
The app also degrades gracefully without them: **SOS falls back to a direct
insert** (online family still get the realtime red alert; only closed-app push is
lost), and `notify-message` is only closed-app chat push.

To turn the chat webhook on, set (Dashboard → Database → Settings):
```sql
alter database postgres set app.settings.functions_base_url =
  'https://qevscpmifoqkkfiysynx.supabase.co/functions/v1';
alter database postgres set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
```

### Optional
- a MapLibre style URL (else OpenFreeMap) → `EXPO_PUBLIC_MAP_STYLE_URL`
- an EAS project id for real push tokens → `EXPO_PUBLIC_EAS_PROJECT_ID`

## 2. Mobile setup

```bash
cd mobile
cp .env.example .env      # fill in the Supabase values
npm install
```

MapLibre + background location + notifications all need **native code**, so this
does **not** run in Expo Go. Build a dev client:

```bash
npm run android      # expo run:android  (device or emulator)
npm run ios          # expo run:ios      (macOS)
```

Then `npm start` to iterate over the dev build.

`npm run typecheck`, `tsc --noEmit`, currently clean.

## 3. Schema

`families` · `users` · `locations` · `messages` (v1) + `locations.battery_level`
/ `signal_type` / `place_name`, `sos_alerts`, `saved_places` (v2). Full DDL and
policies in `supabase/migrations/`. Regenerate `mobile/src/lib/database.types.ts`
with `supabase gen types typescript` after linking.

## Deliberately out of scope

Per the spec: no location history/playback, no arrival/departure alerts, no
admin roles or one-way watching, no ads/analytics, no speed/route tracking.
