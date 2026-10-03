import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SIGNAL_LABEL } from '../lib/device-signals';
import type { MapPin, MemberWithLocation } from '../lib/database.types';
import { batteryColor, batteryPercent, freshnessOf, pinColorFor, timeAgo } from '../lib/format';
import { Avatar, StatusDot } from './badges';
import { Palette } from './ui';

interface Props {
  roster: MemberWithLocation[];
  myId: string | undefined;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  sosUserIds: Set<string>;
  pins: MapPin[];
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  fitToken: number;
  focusCoord: [number, number] | null;
  focusToken: number;
}

/**
 * MapLibre GL is native-only, so `npm run web` gets this list view instead of a
 * real map. Enough to exercise the data flow (realtime locations, pin cards,
 * SOS) in a browser; use a device build for the actual map.
 */
export function FamilyMap({
  roster,
  myId,
  selectedId,
  onSelect,
  sosUserIds,
  pins,
  selectedPinId,
  onSelectPin,
}: Props) {
  const withLoc = roster.filter((m) => m.location);
  return (
    <View style={styles.wrap}>
      <View style={styles.notice}>
        <Ionicons name="map-outline" size={16} color={Palette.brand} />
        <Text style={styles.noticeText}>Map view is native-only, showing a list on web.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {pins.map((p) => (
          <View
            key={p.id}
            style={[styles.row, selectedPinId === p.id && styles.rowSelected]}
            onTouchEnd={() => onSelectPin(p.id)}>
            <View style={styles.flagAvatar}>
              <Ionicons name="flag" size={18} color={Palette.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>Dropped {timeAgo(p.created_at)}</Text>
            </View>
          </View>
        ))}
        {withLoc.map((m) => {
          const isMe = m.user.id === myId;
          const loc = m.location!;
          const hasSos = sosUserIds.has(m.user.id);
          return (
            <View
              key={m.user.id}
              style={[
                styles.row,
                selectedId === m.user.id && styles.rowSelected,
                hasSos && styles.rowSos,
              ]}
              onTouchEnd={() => onSelect(m.user.id)}>
              <Avatar
                name={m.user.name}
                url={m.user.avatar_url}
                color={pinColorFor(m.user.id)}
                size={36}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {hasSos ? '🆘 ' : ''}
                  {isMe ? `${m.user.name} (you)` : loc.place_name ?? m.user.name}
                </Text>
                <Text style={styles.meta}>
                  {timeAgo(loc.updated_at)} · {SIGNAL_LABEL[loc.signal_type ?? 'unknown']}
                  {loc.battery_level != null ? ' · ' : ''}
                  {loc.battery_level != null ? (
                    <Text style={{ color: batteryColor(loc.battery_level), fontWeight: '700' }}>
                      {batteryPercent(loc.battery_level)}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <StatusDot freshness={freshnessOf(loc.updated_at)} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#E8EAF2' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: Palette.brandSoft,
  },
  noticeText: { color: Palette.brand, fontWeight: '700', textAlign: 'center' },
  list: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
  },
  rowSelected: { borderWidth: 2, borderColor: Palette.brand },
  rowSos: { borderWidth: 2, borderColor: Palette.danger },
  flagAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontWeight: '800', color: Palette.text },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
});
