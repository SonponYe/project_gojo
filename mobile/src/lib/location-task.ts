// Spec §3, the always-on background location task.
//
// IMPORTANT: TaskManager.defineTask MUST run in the global module scope so the
// OS can spin up the JS runtime, run this, and tear it down with no React tree
// mounted. This file is imported once from the root _layout, which the router
// entry always loads, including on a headless background launch and after a
// device reboot (the task auto-re-registers on boot).

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { BACKGROUND_LOCATION_TASK } from './config';
import { upsertLocation } from './location-sync';
import { supabase } from './supabase';

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
    if (!uid) return; // signed out, nothing to report

    // Only write while the master toggle is on (spec §2.3).
    const { data: me } = await supabase
      .from('users')
      .select('is_sharing')
      .eq('id', uid)
      .single<{ is_sharing: boolean }>();
    if (!me?.is_sharing) return;

    await upsertLocation(uid, fix.coords);
  } catch (err) {
    // Offline or transient — a later trigger (reconnect, heartbeat, next tick)
    // pushes a fresh fix (spec §3 "No internet").
    console.warn('[gojo] background upsert skipped', (err as Error)?.message);
  }
};

// No background task runtime on web, skip registration there.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, handleLocationTask);
}
