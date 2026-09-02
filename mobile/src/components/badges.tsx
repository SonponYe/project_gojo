import { StyleSheet, Text, View } from 'react-native';

import { SIGNAL_LABEL } from '../lib/device-signals';
import type { SignalType } from '../lib/database.types';
import { batteryColor, batteryPercent, FRESHNESS_COLOR, initialsOf, type Freshness } from '../lib/format';
import { Palette } from './ui';

/** Spec §2.1 — green / amber / grey freshness dot. */
export function StatusDot({ freshness, size = 10 }: { freshness: Freshness; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: FRESHNESS_COLOR[freshness],
        borderWidth: 1.5,
        borderColor: '#fff',
      }}
    />
  );
}

/** Spec §10.1 — coloured battery indicator. */
export function BatteryBadge({ level }: { level: number | null | undefined }) {
  const color = batteryColor(level);
  return (
    <View style={styles.badge}>
      <View style={[styles.batteryShell, { borderColor: color }]}>
        <View
          style={{
            width: `${Math.max(6, Math.round((level ?? 0) * 100))}%`,
            backgroundColor: color,
            height: '100%',
            borderRadius: 1,
          }}
        />
      </View>
      <Text style={[styles.badgeText, { color }]}>{batteryPercent(level)}</Text>
    </View>
  );
}

/** Spec §10.2 — connectivity type. */
export function SignalBadge({ type }: { type: SignalType | null | undefined }) {
  const t = type ?? 'unknown';
  const color = t === 'none' ? Palette.danger : t === '2g' ? '#F59E0B' : Palette.textDim;
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeText, { color }]}>{SIGNAL_LABEL[t]}</Text>
    </View>
  );
}

export function Avatar({
  name,
  url,
  color,
  size = 40,
}: {
  name: string;
  url?: string | null;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>
        {initialsOf(name) || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  batteryShell: {
    width: 22,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.5,
    padding: 1,
    justifyContent: 'center',
  },
});
