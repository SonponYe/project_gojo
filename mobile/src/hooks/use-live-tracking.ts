import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { Tracking } from '../lib/config';
import { syncMyLocation } from '../lib/location-sync';

/**
 * Keeps the signed-in user's position fresh while the app is in use, on top of
 * the background OS task. Pushes a fix:
 *   - right now (on mount),
 *   - whenever the app returns to the foreground,
 *   - the moment connectivity comes back after being offline,
 *   - and on a steady in-app timer.
 * All no-ops unless `isSharing` is true (checked again inside syncMyLocation).
 */
export function useLiveTracking(isSharing: boolean) {
  useEffect(() => {
    if (!isSharing) return;

    syncMyLocation(true);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncMyLocation(true);
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
    };
  }, [isSharing]);
}
