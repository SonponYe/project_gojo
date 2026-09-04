// Spec §3 — turning the master toggle on/off. This is the only place that
// starts or stops the OS-level location task.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { BACKGROUND_LOCATION_TASK, Tracking } from './config';
import { t } from '../i18n';
import { scheduleAwarenessPing, cancelAwarenessPing } from './notifications';
import { supabase } from './supabase';

const IS_WEB = Platform.OS === 'web';

export type PermissionResult =
  | { ok: true }
  | { ok: false; reason: 'foreground' | 'background' };

/** Request foreground then background ("Always") location permission. */
export async function ensureLocationPermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'foreground' };
  if (IS_WEB) return { ok: true }; // no background permission concept on web
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return { ok: false, reason: 'background' };
  return { ok: true };
}

export async function isTrackingRunning(): Promise<boolean> {
  if (IS_WEB) return false;
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Start sharing. Persists is_sharing=true, starts the background task, seeds an
 * immediate fix, and schedules the awareness ping. Returns a permission result
 * so the UI can route the user to Settings if "Always" was denied.
 */
export async function startTracking(): Promise<PermissionResult> {
  const perm = await ensureLocationPermissions();
  if (!perm.ok) return perm;

  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return { ok: false, reason: 'foreground' };

  await supabase.from('users').update({ is_sharing: true }).eq('id', uid);

  // Web has no background task / foreground service / local scheduling — we can
  // still push a one-off position from the browser geolocation API.
  if (!IS_WEB) {
    if (!(await isTrackingRunning())) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced, // spec §3 "medium accuracy"
        timeInterval: Tracking.intervalMs,
        distanceInterval: Tracking.distanceIntervalM,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          // Spec §4 Layer 3 — the OS-enforced persistent banner.
          notificationTitle: t('notifications.foregroundServiceTitle'),
          notificationBody: t('notifications.foregroundServiceBody'),
          notificationColor: '#0A0A0C',
        },
      });
    }
    await scheduleAwarenessPing();
  }

  await writeImmediateFix(uid);
  return { ok: true };
}

/**
 * Stop sharing — spec §4 Layer 5: instant, no confirmation, no notification to
 * anyone. Pin vanishes because we both flip the flag and delete the row.
 */
export async function stopTracking(): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;

  if (!IS_WEB && (await isTrackingRunning())) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await cancelAwarenessPing();

  if (uid) {
    await supabase.from('users').update({ is_sharing: false }).eq('id', uid);
    await supabase.from('locations').delete().eq('user_id', uid);
  }
}

/** Resume the task after a cold/boot launch if the user left sharing on. */
export async function resumeTrackingIfEnabled(): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;

  const { data: me } = await supabase
    .from('users')
    .select('is_sharing')
    .eq('id', uid)
    .single();

  if (me?.is_sharing && !(await isTrackingRunning())) {
    const perm = await ensureLocationPermissions();
    if (perm.ok) await startTracking();
  }
}

async function writeImmediateFix(uid: string): Promise<void> {
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { matchSavedPlace } = await import('./geo');
    const { readBatteryLevel, readSignalType } = await import('./device-signals');
    const { data: places } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', uid);
    const [battery, signal] = await Promise.all([readBatteryLevel(), readSignalType()]);

    await supabase.from('locations').upsert(
      {
        user_id: uid,
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy ?? null,
        speed: fix.coords.speed ?? null,
        battery_level: battery,
        signal_type: signal,
        place_name: matchSavedPlace(
          fix.coords.latitude,
          fix.coords.longitude,
          (places ?? []) as any,
        ),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // no fix yet — the background task will deliver one shortly
  }
}
