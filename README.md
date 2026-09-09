# Gojo

## Overview
A family-first, always-on location-sharing and quick-messaging app for real-life
family safety: one shared live map, last-known location when someone is offline,
a group chat, and an SOS button. Built for families — with Ghana in mind, where
battery, signal and language are daily factors.

## Problem It Solves
Commercial family trackers are ad-heavy, complex, battery-hungry, and often feel
like surveillance. Gojo does three things well — a live map, an offline-resilient
last position, and lightweight chat — with anti-stalking safeguards baked in:
explicit logged consent, mutual visibility enforced in the database (not the UI),
a recurring "your location is being shared" reminder, and one-tap off with no
confirmation. Plus an SOS that reaches the whole family in seconds.

## Features
- Live family map (MapLibre) with per-person freshness, battery %, and signal type
- Always-on background location + in-app heartbeat + offline map cache (never blank)
- Realtime family group chat with WhatsApp-style push and location-share cards
- SOS: 2-second hold → urgent push to the family with a one-tap **Directions**
  action, pulsing red pin, "I'm OK" / 30-min auto-clear
- Named places ("Home", "School") that relabel your pin — private per user
- Invite by QR code / shareable deep link
- English + Twi, monochrome theme, deliberately generic app icon
- Multi-tenant: every family fully isolated by Postgres Row Level Security

## Tech Stack
- **Frontend:** React Native (Expo SDK 57), expo-router, TypeScript, Reanimated, MapLibre GL
- **Backend:** Supabase — PostgreSQL + Row Level Security, Realtime, Auth, Edge Functions (Deno)
- **Push:** Expo Push → FCM / APNs
- **Build / Deploy:** EAS Build
- **Design:** in-app monochrome design system (no external tool)

## My Role
Solo project. Built end to end: the Supabase schema + RLS policies + onboarding
RPCs + Edge Functions, and the whole Expo app — auth, map, chat, SOS, background
tracking, i18n, theming, icon/splash — plus the EAS build pipeline. Product spec
came from two written description documents (`*.docx` in this repo).

## Status
MVP — feature-complete against the v1 + v2 spec. Supabase backend deployed;
Android build installable via EAS. Remaining: FCM for production push, profile
photos, account management.

## Live Link / Demo
Private — Android build distributed via EAS to family testers. Not on any store.

## Screenshots (optional)
_TBD_

---

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
| Location freshness | `expo-location` + `expo-task-manager` background OS task every ~60s, **plus** `useLiveTracking`: while the app is open it runs a live `watchPositionAsync` stream (near real-time), and it also pushes on app open, on foreground, the instant connectivity returns, and on a 60s stationary timer. Manual **Refresh** button on the map. Green pin ≤ 3 min old, amber ≤ 30 min, grey after. |
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
   (safe to commit).
2. Add it to `mobile/app.json` under `android`:
   `"googleServicesFile": "./google-services.json"` — and `git add` the file
   (EAS Build only uploads git-tracked files).
3. Firebase → Project settings → **Service accounts** → **Generate new private
   key** (this JSON *is* secret — do not commit).
4. `cd mobile && npx eas-cli credentials` → Android → profile `preview` →
   Google Service Account → upload the key from step 3.
5. Rebuild. Sign in on each device; `users.push_token` should populate.

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
