// One place that turns "where am I now" into a row in public.locations.
// Used by the background task, the foreground heartbeat, app-resume and
// network-reconnect — so a fresh position lands the moment we plausibly can.

import * as Location from 'expo-location';

import { Tracking } from './config';
import { matchSavedPlace } from './geo';
import { readBatteryLevel, readSignalType } from './device-signals';
import { supabase } from './supabase';
import type { SavedPlace } from './database.types';

let lastSyncAt = 0;
let inFlight: Promise<boolean> | null = null;

type Coords = { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null };

/** Enrich a fix with battery / signal / saved-place and upsert it. */
export async function upsertLocation(uid: string, coords: Coords): Promise<boolean> {
  try {
    const { data: places } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', uid)
      .returns<SavedPlace[]>();
    const [battery, signal] = await Promise.all([readBatteryLevel(), readSignalType()]);

    const { error } = await supabase.from('locations').upsert(
      {
        user_id: uid,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
        speed: coords.speed ?? null,
        battery_level: battery,
        signal_type: signal,
        place_name: matchSavedPlace(coords.latitude, coords.longitude, places ?? []),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
    lastSyncAt = Date.now();
    return true;
  } catch {
    // offline / transient — a later trigger (reconnect, heartbeat) retries
    return false;
  }
}

/**
 * Push a position, if the signed-in user is sharing. Pass `coords` when the
 * caller already has a fix (the foreground watch) to skip a GPS read. `force`
 * bypasses the short debounce that stops rapid repeat calls (e.g. the network
 * listener firing several times as connectivity settles).
 */
export async function syncMyLocation(force = false, coords?: Coords): Promise<boolean> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastSyncAt < Tracking.minSyncGapMs) return false;

  inFlight = (async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return false;

      const { data: me } = await supabase
        .from('users')
        .select('is_sharing')
        .eq('id', uid)
        .single<{ is_sharing: boolean }>();
      if (!me?.is_sharing) return false;

      if (coords) return upsertLocation(uid, coords);

      let fix: Location.LocationObject | null = null;
      try {
        fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        fix = await Location.getLastKnownPositionAsync();
      }
      if (!fix) return false;

      return upsertLocation(uid, fix.coords);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
