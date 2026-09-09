import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { Tracking } from '../lib/config';
import { syncMyLocation } from '../lib/location-sync';

/**
 * Keeps the signed-in user's position fresh while the app is in use, on top of
 * the ~60s background OS task. While the app is foregrounded it runs a live
 * position stream (fires on movement); it also pushes:
 *   - right now (on mount),
 *   - whenever the app returns to the foreground,
 *   - the moment connectivity comes back after being offline,
 *   - and on a steady 60s timer (so a stationary open app still stays green).
 * All no-ops unless `isSharing` is true (re-checked inside syncMyLocation).
 */
export function useLiveTracking(isSharing: boolean) {
  useEffect(() => {
    if (!isSharing) return;

    let watch: Location.LocationSubscription | null = null;

    async function startWatch() {
      if (watch) return;
      try {
        watch = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: Tracking.foregroundWatchMs,
            distanceInterval: Tracking.foregroundWatchM,
          },
          (loc) => {
            syncMyLocation(false, loc.coords);
          },
        );
      } catch {
        /* permission not granted yet / transient */
      }
    }

    function stopWatch() {
      watch?.remove();
      watch = null;
    }

    syncMyLocation(true);
    if (AppState.currentState === 'active') startWatch();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncMyLocation(true);
        startWatch();
      } else {
        stopWatch(); // background OS task takes over
      }
    });

    let wasConnected = true;
    const netUnsub = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false;
      if (connected && !wasConnected) syncMyLocation(true); // just came back online
      wasConnected = connected;
    });

    const timer = setInterval(() => syncMyLocation(false), Tracking.foregroundSyncMs);

    return () => {
      appSub.remove();
      netUnsub();
      clearInterval(timer);
      stopWatch();
    };
  }, [isSharing]);
}
