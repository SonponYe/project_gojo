# Gojo — mobile

Expo (SDK 57) + expo-router + TypeScript. See the [root README](../README.md) for
architecture, EAS builds, and the FCM push setup.

```bash
cp .env.example .env    # Supabase URL + anon key
npm install
npm run typecheck       # tsc --noEmit, kept clean
npm run web             # limited preview (no map; MapLibre is native-only)
```

Full features need native code — build with EAS (`npx eas-cli build -p android
--profile preview`) or a local dev client (`npm run android` / `npm run ios`).

- `src/app/` — routes: `(auth)` sign in/up + onboarding, `(tabs)` map / chat / profile
- `src/lib/` — supabase client, `location-sync` + `location-task` (background),
  `tracking`, `notifications`, `invite-link`, `i18n`
- `src/hooks/` — `use-family-map` (realtime + offline cache), `use-live-tracking`
  (foreground heartbeat), `use-messages`, `use-sos`, `use-saved-places`
- `src/components/` — `family-map`, `pin-card`, `sos-button`, `badges`,
  `animated-splash`
