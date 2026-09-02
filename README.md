# Gojo — Family Location & Safety App

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
| Live map | MapLibre GL (`@maplibre/maplibre-react-native` v11), free demo tiles by default |
| Background location | `expo-location` + `expo-task-manager` OS task, 60s / balanced accuracy, foreground-service banner, boot auto-resume |
| Realtime | Supabase Realtime channels for `locations`, `messages`, `sos_alerts` — no polling |
| Multi-tenant isolation | Every table family-scoped; Postgres RLS built on `current_family_id()`; `family_id` only mutable via audited `create_family` / `join_family` RPCs |
| Mutual visibility (Layer 4) | Enforced in the `locations` SELECT policy, not the UI |
| Awareness ping (Layer 2) | 6-hour repeating local notification, scheduled while sharing is on |
| SOS | `sos-alert` Edge Function records the row + fans Expo push to the family in one call (<2s); pin pulses red; auto-clears after 30 min |
| i18n | `i18n-js` + `expo-localization`; `en` full, `tw` covers the six key phrases with fallback |

## 1. Backend setup (Supabase)

You said you'd create the project and send its details. Once you have them:

1. Put the API values in `mobile/.env` (see below).
2. Apply the schema — either link the CLI and push:
   ```bash
   cd supabase
   supabase link --project-ref <PROJECT_REF>
   supabase db push
   supabase functions deploy sos-alert
   supabase functions deploy notify-message
   ```
   …or paste each file in `supabase/migrations/` (in filename order) into the
   Dashboard SQL editor, then create the two functions from
   `supabase/functions/`.
3. Confirm **Realtime** is enabled for `locations`, `messages`, `sos_alerts`
   (the `*_realtime.sql` migrations do this).
4. *(Optional)* enable chat push + SOS auto-clear — run
   `20260902300000_optional_scheduled_and_webhooks.sql` and set:
   ```sql
   alter database postgres set app.settings.functions_base_url =
     'https://<PROJECT_REF>.supabase.co/functions/v1';
   alter database postgres set app.settings.service_role_key = '<SERVICE_ROLE_KEY>';
   ```

### What I need from you
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- (optional) a MapLibre style URL if you don't want the demo tiles
- (optional) EAS project id for real push tokens

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

`npm run typecheck` — `tsc --noEmit`, currently clean.

## 3. Schema

`families` · `users` · `locations` · `messages` (v1) + `locations.battery_level`
/ `signal_type` / `place_name`, `sos_alerts`, `saved_places` (v2). Full DDL and
policies in `supabase/migrations/`. Regenerate `mobile/src/lib/database.types.ts`
with `supabase gen types typescript` after linking.

## Deliberately out of scope

Per the spec: no location history/playback, no arrival/departure alerts, no
admin roles or one-way watching, no ads/analytics, no speed/route tracking.
