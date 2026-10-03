import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { t } from '../i18n';
import type { MapPin } from '../lib/database.types';
import { timeAgo } from '../lib/format';
import { Palette } from './ui';

interface Props {
  pin: MapPin;
  creatorName: string;
  isMine: boolean;
  onClose: () => void;
  onDelete: () => void;
}

/** Card for a shared, dropped waypoint — distinct from a person's pin card. */
export function PlacePinCard({ pin, creatorName, isMine, onClose, onDelete }: Props) {
  function openDirections() {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${pin.lat},${pin.lng}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`,
    });
    Linking.openURL(url!);
  }

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(180)}
      style={styles.card}>
      <View style={styles.handle} />
      <View style={styles.row}>
        <View style={styles.flagWrap}>
          <Ionicons name="flag" size={22} color={Palette.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{pin.name}</Text>
          <Text style={styles.meta}>
            {t('map.droppedBy', { name: creatorName, ago: timeAgo(pin.created_at) })}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={20} color={Palette.textDim} />
        </Pressable>
      </View>

      <Pressable style={styles.dirBtn} onPress={openDirections}>
        <Ionicons name="navigate" size={16} color={Palette.brand} />
        <Text style={styles.dirBtnText}>{t('map.directionsToPin')}</Text>
      </Pressable>

      {isMine ? (
        <Pressable style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={Palette.danger} />
          <Text style={styles.deleteBtnText}>{t('map.removePin')}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flagWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 17, fontWeight: '800', color: Palette.text },
  meta: { color: Palette.textDim, fontWeight: '600', fontSize: 13, marginTop: 2 },
  dirBtn: {
    backgroundColor: Palette.brandSoft,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dirBtnText: { color: Palette.brand, fontWeight: '800' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  deleteBtnText: { color: Palette.danger, fontWeight: '700' },
});
