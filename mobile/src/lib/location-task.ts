// Spec §3 — the always-on background location task.
//
// IMPORTANT: TaskManager.defineTask MUST run in the global module scope so the
// OS can spin up the JS runtime, run this, and tear it down with no React tree
// mounted. This file is imported once from the root _layout, which the router
// entry always loads — including on a headless background launch and after a
// device reboot (the task auto-re-registers on boot).

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { BACKGROUND_LOCATION_TASK } from './config';
import { matchSavedPlace } from './geo';
import { readBatteryLevel, readSignalType } from './device-signals';
import { supabase } from './supabase';
import type { SavedPlace } from './database.types';

type LocationTaskData = { locations: Location.LocationObject[] };

const handleLocationTask: TaskManager.TaskManagerTaskExecutor<LocationTaskData> = async ({
  data,
  error,
}) => {
  if (error) {
    console.warn('[gojo] background location error', error.message);
    return;
  }
  const fix = data?.locations?.[data.locations.length - 1];
  if (!fix) return;

  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return; // signed out — nothing to report

    // Only write while the master toggle is on (spec §2.3).
    const { data: me } = await supabase
      .from('users')
      .select('is_sharing')
      .eq('id', uid)
      .single();
    if (!me?.is_sharing) return;

    const { latitude, longitude, accuracy, speed } = fix.coords;

    const { data: places } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', uid);

    const [battery, signal] = await Promise.all([readBatteryLevel(), readSignalType()]);
    const placeName = matchSavedPlace(latitude, longitude, (places ?? []) as SavedPlace[]);

    await supabase.from('locations').upsert(
      {
        user_id: uid,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        battery_level: battery,
        signal_type: signal,
        place_name: placeName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch (err) {
    // Offline or transient — the OS keeps the last fix and we retry next tick
    // (spec §3 "No internet": pushed the moment connectivity returns).
    console.warn('[gojo] background upsert skipped', (err as Error)?.message);
  }
};

// No background task runtime on web — skip registration there.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, handleLocationTask);
}
