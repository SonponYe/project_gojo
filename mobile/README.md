# Gojo, mobile

Expo (SDK 57) + expo-router + TypeScript. See the [root README](../README.md) for
architecture and full setup.

```bash
cp .env.example .env    # Supabase URL + anon key
npm install
npm run android         # or: npm run ios   (needs a dev build, not Expo Go)
npm run typecheck
```

- `src/app/`, routes: `(auth)` sign in/up + onboarding, `(tabs)` map / chat / profile
- `src/lib/`, Supabase client, background location task, tracking, notifications, i18n
- `src/hooks/`, realtime family map, messages, SOS, saved places
- `src/components/`, map, SOS hold-button, pin card, badges
