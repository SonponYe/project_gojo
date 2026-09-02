import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Config } from '../lib/config';
import type { MemberWithLocation } from '../lib/database.types';
import { boundsOf } from '../lib/geo';
import { freshnessOf, pinColorFor } from '../lib/format';
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
  /** bump this to re-fit the camera to everyone */
  fitToken: number;
}

export function FamilyMap({ roster, myId, selectedId, onSelect, fitToken }: Props) {
  const cameraRef = useRef<any>(null);

  const points = useMemo(
    () =>
      roster
        .filter((m) => m.location)
        .map((m) => ({ lat: m.location!.latitude, lng: m.location!.longitude })),
    [roster],
  );

  const bounds = useMemo(() => boundsOf(points), [points]);

  useEffect(() => {
    if (!cameraRef.current || !bounds) return;
    if (points.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: bounds.center,
        zoomLevel: 14,
        animationDuration: 600,
      });
    } else {
      cameraRef.current.fitBounds(bounds.ne, bounds.sw, [80, 60, 160, 60], 600);
    }
  }, [bounds, points.length, fitToken]);

  if (!MapLibre) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Map needs a development build.{'\n'}Run `npx expo run:android` / `run:ios`.
        </Text>
      </View>
    );
  }

  const { MapView, Camera, MarkerView } = MapLibre;

  return (
    <MapView style={StyleSheet.absoluteFill} mapStyle={Config.mapStyleUrl} logoEnabled={false}>
      <Camera ref={cameraRef} />
      {roster.map((m) => {
        if (!m.location) return null;
        const color = pinColorFor(m.user.id);
        const fresh = freshnessOf(m.location.updated_at);
        const isMe = m.user.id === myId;
        const label = m.location.place_name ?? m.user.name;
        return (
          <MarkerView
            key={m.user.id}
            coordinate={[m.location.longitude, m.location.latitude]}
            anchor={{ x: 0.5, y: 1 }}>
            <View
              style={[styles.pin, selectedId === m.user.id && styles.pinSelected]}
              onTouchEnd={() => onSelect(m.user.id)}>
              <View style={styles.pinRow}>
                <Avatar name={m.user.name} url={m.user.avatar_url} color={color} size={26} />
                <Text numberOfLines={1} style={styles.pinLabel}>
                  {isMe ? 'You' : label}
                </Text>
                <StatusDot freshness={fresh} />
              </View>
              <View style={[styles.pinStem, { borderTopColor: '#fff' }]} />
            </View>
          </MarkerView>
        );
      })}
    </MapView>
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
  pin: {
    alignItems: 'center',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    maxWidth: 180,
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
  pinLabel: { fontWeight: '700', color: Palette.text, fontSize: 13, flexShrink: 1 },
  pinStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
