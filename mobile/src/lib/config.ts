/**
 * Runtime configuration, all sourced from EXPO_PUBLIC_* env vars so it is
 * inlined at build time. Copy `.env.example` to `.env` and fill these in.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    console.warn(`[gojo] missing env var ${name}, set it in mobile/.env`);
    return '';
  }
  return value;
}

export const Config = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  /** MapLibre style JSON. Defaults to the free MapLibre demo tiles. */
  mapStyleUrl:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json',
  /** EAS project id, needed for Expo push tokens on a device build. */
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined,
} as const;

/** Tracking + freshness tuning (see spec §3 and §2.1). */
export const Tracking = {
  /** Background GPS cadence, spec §3 "every 60 seconds with medium accuracy". */
  intervalMs: 60_000,
  /** Minimum metres moved before an update is delivered. */
  distanceIntervalM: 25,
  /** Pin is "live" (green dot) if updated within this window. */
  liveWindowMs: 2 * 60_000,
  /** Pin is "recent" (amber dot) up to this age; older is "offline" (grey). */
  staleWindowMs: 30 * 60_000,
  /** Awareness ping cadence, spec §4 Layer 2 "every 6 hours". */
  awarenessIntervalSec: 6 * 60 * 60,
  /** An SOS auto-clears after this long, spec §10.3. */
  sosTtlMs: 30 * 60_000,
} as const;

export const BACKGROUND_LOCATION_TASK = 'gojo-background-location';
