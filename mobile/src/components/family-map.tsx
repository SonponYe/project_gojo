import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Config } from '../lib/config';
import type { MemberWithLocation } from '../lib/database.types';
import { boundsOf } from '../lib/geo';
import { batteryColor, batteryPercent, freshnessOf, pinColorFor, timeAgo } from '../lib/format';
import { Avatar, StatusDot } from './badges';
import { Palette } from './ui';

// MapLibre needs native code (a dev build / prebuild). Guard the import so the
// JS bundle still loads in Expo Go, where we show a simple fallback instead.
let MapLibre: typeof import('@maplibre/maplibre-react-native') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapLibre = require('@maplibre/maplibre-react-native');
} catch {
  MapLibre = null;
}

interface Props {
  roster: MemberWithLocation[];
  myId: string | undefined;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  /** user ids with an active SOS — their pin pulses red (spec §10.3) */
  sosUserIds: Set<string>;
  /** bump this to re-fit the camera to everyone */
  fitToken: number;
}

/** Spec §10.3 — an expanding red ring under a pin while its owner has an SOS out. */
function SosPulse() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + t.value * 1.6 }],
    opacity: 0.55 * (1 - t.value),
  }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
}

export function FamilyMap({ roster, myId, selectedId, onSelect, sosUserIds, fitToken }: Props) {
  const cameraRef = useRef<import('@maplibre/maplibre-react-native').CameraRef>(null);

  const points = useMemo(
    () =>
      roster
        .filter((m) => m.location)
        .map((m) => ({ lat: m.location!.latitude, lng: m.location!.longitude })),
    [roster],
  );

  const box = useMemo(() => boundsOf(points), [points]);

  useEffect(() => {
    if (!cameraRef.current || !box) return;
    if (points.length === 1) {
      cameraRef.current.flyTo({ center: box.center, zoom: 14, duration: 600 });
    } else {
      cameraRef.current.fitBounds(box.bounds, {
        padding: { top: 90, bottom: 260, left: 60, right: 60 },
        duration: 600,
      });
    }
  }, [box, points.length, fitToken]);

  if (!MapLibre) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Map needs a development build.{'\n'}Run `npm run android` / `npm run ios`.
        </Text>
      </View>
    );
  }

  const { Map, Camera, Marker } = MapLibre;

  return (
    <Map style={StyleSheet.absoluteFill} mapStyle={Config.mapStyleUrl} logo={false}>
      <Camera ref={cameraRef} />
      {roster.map((m) => {
        if (!m.location) return null;
        const color = pinColorFor(m.user.id);
        const fresh = freshnessOf(m.location.updated_at);
        const isMe = m.user.id === myId;
        const label = m.location.place_name ?? (isMe ? 'You' : m.user.name);
        const hasSos = sosUserIds.has(m.user.id);
        const battery = m.location.battery_level;

        return (
          <Marker
            key={m.user.id}
            lngLat={[m.location.longitude, m.location.latitude]}
            anchor="bottom"
            onPress={() => onSelect(m.user.id)}>
            <View style={styles.pin}>
              {hasSos ? <SosPulse /> : null}
              <View
                style={[
                  styles.pinRow,
                  selectedId === m.user.id && styles.pinSelected,
                  hasSos && styles.pinSos,
                ]}>
                <Avatar name={m.user.name} url={m.user.avatar_url} color={color} size={26} />
                <View style={styles.pinTextCol}>
                  <Text numberOfLines={1} style={styles.pinLabel}>
                    {label}
                  </Text>
                  {fresh !== 'live' ? (
                    <Text style={styles.pinAge}>{timeAgo(m.location.updated_at)}</Text>
                  ) : null}
                </View>
                {battery != null ? (
                  <Text style={[styles.pinBattery, { color: batteryColor(battery) }]}>
                    {batteryPercent(battery)}
                  </Text>
                ) : null}
                <StatusDot freshness={fresh} />
              </View>
              <View style={[styles.pinStem, hasSos && { borderTopColor: Palette.danger }]} />
            </View>
          </Marker>
        );
      })}
    </Map>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#E8EAF2',
  },
  fallbackText: { color: Palette.textDim, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  pin: { alignItems: 'center', justifyContent: 'flex-end' },
  pulse: {
    position: 'absolute',
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Palette.danger,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    maxWidth: 200,
    ...Platform.select({
      android: { elevation: 4 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  pinSelected: { transform: [{ scale: 1.08 }] },
  pinSos: { borderWidth: 2, borderColor: Palette.danger },
  pinTextCol: { flexShrink: 1 },
  pinLabel: { fontWeight: '700', color: Palette.text, fontSize: 13 },
  pinAge: { fontWeight: '600', color: Palette.textDim, fontSize: 10 },
  pinBattery: { fontWeight: '800', fontSize: 11 },
  pinStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -1,
  },
});
