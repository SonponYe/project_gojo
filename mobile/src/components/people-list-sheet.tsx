import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '../i18n';
import type { MemberWithLocation } from '../lib/database.types';
import { freshnessOf, pinColorFor, timeAgo } from '../lib/format';
import { Avatar, StatusDot } from './badges';
import { Palette } from './ui';

interface Props {
  visible: boolean;
  roster: MemberWithLocation[];
  myId: string | undefined;
  sosUserIds: Set<string>;
  onClose: () => void;
  onSelect: (userId: string) => void;
}

/** Spec fix — overlapping pins made people hard to find; search + pick from a list instead. */
export function PeopleListSheet({ visible, roster, myId, sosUserIds, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? roster.filter((m) => m.user.name.toLowerCase().includes(q)) : roster;
    // Sharing-now first, then by freshness, so the people most worth finding sort to the top.
    return [...list].sort((a, b) => {
      if (!!a.location !== !!b.location) return a.location ? -1 : 1;
      if (!a.location || !b.location) return 0;
      return new Date(b.location.updated_at).getTime() - new Date(a.location.updated_at).getTime();
    });
  }, [roster, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('map.peopleTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Palette.textDim} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={Palette.textDim} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('map.peopleSearch')}
              placeholderTextColor={Palette.textDim}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {filtered.map((m) => {
            const isMe = m.user.id === myId;
            const fresh = freshnessOf(m.location?.updated_at);
            const hasSos = sosUserIds.has(m.user.id);
            return (
              <Pressable
                key={m.user.id}
                style={styles.row}
                onPress={() => {
                  onSelect(m.user.id);
                  onClose();
                }}>
                <Avatar
                  name={m.user.name}
                  url={m.user.avatar_url}
                  color={pinColorFor(m.user.id)}
                  size={38}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {isMe ? `${m.user.name} (${t('map.you')})` : m.user.name}
                    {hasSos ? '  🆘' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {m.location ? timeAgo(m.location.updated_at) : t('map.offline')}
                  </Text>
                </View>
                <StatusDot freshness={fresh} />
              </Pressable>
            );
          })}
          {filtered.length === 0 ? (
            <Text style={styles.empty}>{t('map.peopleNone')}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800', color: Palette.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: Palette.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  name: { fontWeight: '700', color: Palette.text, fontSize: 15 },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 1 },
  empty: { textAlign: 'center', color: Palette.textDim, fontWeight: '600', paddingVertical: 20 },
});
