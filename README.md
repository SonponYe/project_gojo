# Gojo — Family Location & Safety App

Always-on family location sharing, last-known location when offline, and a
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
| Live map | MapLibre GL (`@maplibre/maplibre-react-native` v11), OpenFreeMap "liberty" street tiles by default (free, no key) |
| Location freshness | `expo-location` + `expo-task-manager` OS task ≈ every 5 min, **plus** an in-app heartbeat (`useLiveTracking`) that pushes a fix on app open, on foreground, the instant connectivity returns, and every 2 min while open. Manual **Refresh** button on the map. Green pin ≤ 7 min old, amber ≤ 60 min, grey after. |
| Offline viewer | `useFamilyMap` hydrates from an AsyncStorage snapshot first, then overlays the live fetch — the map is never blank; a "Showing last known positions" chip appears when serving cache. |
| Realtime | Supabase Realtime channels for `locations`, `messages`, `sos_alerts` — no polling |
| Multi-tenant isolation | Every table family-scoped; Postgres RLS built on `current_family_id()`; `family_id` only mutable via audited `create_family` / `join_family` RPCs |
| Mutual visibility (Layer 4) | Enforced in the `locations` SELECT policy, not the UI |
| Awareness ping (Layer 2) | 6-hour repeating **local** notification, scheduled while sharing is on (no FCM needed) |
| SOS | Sendable **only as yourself** (own pin card). `sos-alert` Edge Function records the row + fans an Expo push to the family (<2s) with a **"Directions" quick action**; pin pulses red family-wide; auto-clears after 30 min. Falls back to a direct insert if the function/network is down. |
| Chat notifications | On send, the app invokes `notify-message` → WhatsApp-style push to the rest of the family (title = sender, body = message). Muted for whoever is on the chat screen. |
| Invite | Profile shows a **QR** + **Share invite link** (`gojo://join-family?code=…`); the code prefills onboarding even after a sign-in detour. |
| i18n | `i18n-js` + `expo-localization`; `en` full, `tw` covers the six key phrases with fallback |

## 1. Backend (Supabase)

**Project `qevscpmifoqkkfiysynx` (eu-west-1)** — all migrations applied (schema,
RLS, RPCs, realtime for `locations` / `messages` / `sos_alerts`, optional
pg_cron SOS auto-clear + pg_net chat trigger). `mobile/.env` holds the URL +
anon key; `supabase/.env` (gitignored) holds the CLI access token.

Re-applying migrations is idempotent:
```bash
npx supabase link --project-ref qevscpmifoqkkfiysynx
npx supabase db push
```

### Edge Functions — deployed ✓
`sos-alert` and `notify-message` are live (`verify_jwt=false`; they authenticate
the caller themselves). Redeploy after edits:
```bash
export SUPABASE_ACCESS_TOKEN=...   # from supabase/.env
npx supabase functions deploy sos-alert      --project-ref qevscpmifoqkkfiysynx --no-verify-jwt
npx supabase functions deploy notify-message --project-ref qevscpmifoqkkfiysynx --no-verify-jwt
```
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into the runtime.

## 2. Mobile — run in development

```bash
cd mobile
cp .env.example .env      # Supabase URL + anon key
npm install
npm run typecheck         # tsc --noEmit, kept clean
```

MapLibre, background location, notifications and QR all need **native code** —
this does **not** run in Expo Go. Either a local dev client (`npm run android` /
`npm run ios`, needs the platform SDK) or an EAS build (below).

`npm run web` works as a limited preview: auth, onboarding, realtime chat,
profile, saved places. The map falls back to a list (MapLibre is native-only).

## 3. Build an installable app (EAS)

App id **`com.gojo.app`** (Android + iOS). EAS project: `@sonpon_ye_shua/gojo`.
Profiles in `mobile/eas.json` — `development` (dev client APK), `preview`
(installable APK), `production` (AAB). Supabase public env is inlined there, so:

```bash
npx eas-cli build -p android --profile preview
```

returns a downloadable **`.apk`**. Every family device needs this build. On many
Android OEMs, also set **Settings → Apps → Gojo → Battery → Unrestricted** or the
OS freezes the background task.

**iOS** needs an Apple Developer account ($99/yr) → `--profile production` +
`eas submit` → TestFlight.

### Push notifications need FCM (Android) — not yet set up

SOS-to-a-closed-app and chat notifications ride Expo Push → **FCM**. Until it's
configured, `users.push_token` stays null and those pushes silently no-op
(realtime still delivers to any open app; the 6-hour ping and the
"Location sharing active" banner are local and unaffected).

1. Firebase Console → new project → add an **Android app** with package
   `com.gojo.app` → download **`google-services.json`** to `mobile/`
   (`android.googleServicesFile` already points at it; safe to commit).
2. Firebase → Project settings → **Service accounts** → **Generate new private
   key** (this JSON *is* secret — do not commit).
3. `cd mobile && npx eas-cli credentials` → Android → profile `preview` →
   Google Service Account → upload the key from step 2.
4. Rebuild. Sign in on each device; `users.push_token` should populate.

iOS push (APNs) is handled automatically by EAS once an Apple account exists.

## 4. Schema

`families` · `users` · `locations` · `messages` (v1) + `locations.battery_level`
/ `signal_type` / `place_name`, `sos_alerts` (+ `active_sos_alerts` view),
`saved_places`. Full DDL + policies in `supabase/migrations/`. Regenerate
`mobile/src/lib/database.types.ts` with `supabase gen types typescript`.

## Deliberately out of scope

Per the spec: no location history/playback, no arrival/departure alerts, no
admin roles or one-way watching, no ads/analytics, no speed/route tracking.

## Not done yet

- FCM setup (above) — required for real push delivery on Android.
- Profile photos (initials only today).
- Account basics: forgot-password, edit name, delete account.
- Named-place picker on a map (currently saves your *current* GPS position).
- "Nudge" — a silent push that makes another phone report its position now.
