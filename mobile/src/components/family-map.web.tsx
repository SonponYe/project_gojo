import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MemberWithLocation } from '../lib/database.types';
import { freshnessOf, pinColorFor, timeAgo } from '../lib/format';
import { Avatar, StatusDot } from './badges';
import { Palette } from './ui';

interface Props {
  roster: MemberWithLocation[];
  myId: string | undefined;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  fitToken: number;
}

/**
 * MapLibre GL is native-only, so `npm run web` gets this list view instead of a
 * real map. Enough to exercise the data flow (realtime locations, pin cards,
 * SOS) in a browser; use a device build for the actual map.
 */
export function FamilyMap({ roster, myId, selectedId, onSelect }: Props) {
  const withLoc = roster.filter((m) => m.location);
  return (
    <View style={styles.wrap}>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          🗺️ Map view is native-only — showing a list on web.
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {withLoc.map((m) => {
          const isMe = m.user.id === myId;
          return (
            <View
              key={m.user.id}
              style={[styles.row, selectedId === m.user.id && styles.rowSelected]}
              onTouchEnd={() => onSelect(m.user.id)}>
              <Avatar
                name={m.user.name}
                url={m.user.avatar_url}
                color={pinColorFor(m.user.id)}
                size={36}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {isMe ? `${m.user.name} (you)` : m.location?.place_name ?? m.user.name}
                </Text>
                <Text style={styles.meta}>
                  {m.location?.latitude.toFixed(4)}, {m.location?.longitude.toFixed(4)} ·{' '}
                  {timeAgo(m.location?.updated_at)}
                </Text>
              </View>
              <StatusDot freshness={freshnessOf(m.location?.updated_at)} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#E8EAF2' },
  notice: { padding: 12, backgroundColor: Palette.brandSoft },
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
  name: { fontWeight: '800', color: Palette.text },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
});
