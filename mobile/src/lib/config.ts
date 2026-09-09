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
  /**
   * MapLibre style JSON. Defaults to OpenFreeMap's "liberty" street style —
   * free, no API key, no rate limit. Override with a MapTiler/Protomaps/etc.
   * style URL via EXPO_PUBLIC_MAP_STYLE_URL if you want a different look.
   */
  mapStyleUrl:
    process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
  /** EAS project id, needed for Expo push tokens on a device build. */
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined,
} as const;

/** Tracking + freshness tuning. */
export const Tracking = {
  /** Background OS-task GPS cadence — spec §3 "every 60 seconds". */
  intervalMs: 60_000,
  /** Minimum metres moved before a background update is delivered. */
  distanceIntervalM: 15,
  /** App open: live position stream (fires on movement) — near real-time. */
  foregroundWatchMs: 8_000,
  foregroundWatchM: 10,
  /** App open: also push on this timer so a stationary pin still stays fresh. */
  foregroundSyncMs: 60_000,
  /** Don't push again within this window of the last successful push (debounce). */
  minSyncGapMs: 8_000,
  /** Pin is "live" (green) if updated within this window. */
  liveWindowMs: 3 * 60_000,
  /** Pin is "recent" (amber) up to this age; older is "offline" (grey). */
  staleWindowMs: 30 * 60_000,
  /** Awareness ping cadence, spec §4 Layer 2 "every 6 hours". */
  awarenessIntervalSec: 6 * 60 * 60,
  /** An SOS auto-clears after this long, spec §10.3. */
  sosTtlMs: 30 * 60_000,
} as const;

export const BACKGROUND_LOCATION_TASK = 'gojo-background-location';
