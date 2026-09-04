// Spec §10.1 / §10.2, battery level and connectivity type, sampled on every
// location update. Both are best-effort: failures degrade to null / 'unknown',
// never throw (this runs inside the background task).

import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';

import type { SignalType } from './database.types';

export async function readBatteryLevel(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 ? level : null;
  } catch {
    return null;
  }
}

export async function readSignalType(): Promise<SignalType> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false || state.type === 'none') return 'none';
    if (state.type === 'wifi' || state.type === 'ethernet') return 'wifi';
    if (state.type === 'cellular') {
      switch (state.details?.cellularGeneration) {
        case '2g':
          return '2g';
        case '3g':
          return '3g';
        case '4g':
        case '5g':
          return '4g'; // spec only labels up to 4G
        default:
          return 'unknown';
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export const SIGNAL_LABEL: Record<SignalType, string> = {
  wifi: 'WiFi',
  '4g': '4G',
  '3g': '3G',
  '2g': '2G',
  none: 'No signal',
  unknown: 'N/A',
};
