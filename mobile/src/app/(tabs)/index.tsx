import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/auth';
import { useFamilyMap } from '../../hooks/use-family-map';
import { useSos } from '../../hooks/use-sos';
import { t } from '../../i18n';
import { FamilyMap } from '../../components/family-map';
import { PinCard } from '../../components/pin-card';
import { Palette, Screen } from '../../components/ui';

export default function MapScreen() {
  const { profile, family } = useAuth();
  const insets = useSafeAreaInsets();
  const { roster } = useFamilyMap(family?.id);
  const { alerts, myActiveAlert, sending, trigger, resolveMine } = useSos(family?.id, profile?.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);

  const selected = useMemo(
    () => roster.find((m) => m.user.id === selectedId) ?? null,
    [roster, selectedId],
  );
  const sharingCount = roster.filter((m) => m.location).length;

  const sosBanner = useMemo(() => {
    if (alerts.length === 0) return null;
    if (alerts.length === 1) {
      const who = roster.find((m) => m.user.id === alerts[0].sender_id);
      return t('map.sosBannerOne', { name: who?.user.name ?? '' });
    }
    return t('map.sosBannerMany', { count: alerts.length });
  }, [alerts, roster]);

  return (
    <Screen>
      <FamilyMap
        roster={roster}
        myId={profile?.id}
        selectedId={selectedId}
        onSelect={setSelectedId}
        fitToken={fitToken}
      />

      {sosBanner ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(160)}
          style={[styles.sosBanner, { top: insets.top + 8 }]}>
          <Pressable
            style={styles.sosBannerPress}
            onPress={() => setSelectedId(alerts[0].sender_id)}>
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={styles.sosBannerText}>{sosBanner}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {sharingCount === 0 ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.empty, { top: insets.top + 60 }]}>
          <Text style={styles.emptyText}>{t('map.empty')}</Text>
        </Animated.View>
      ) : null}

      <Pressable
        style={[styles.recenter, { bottom: (selected ? 260 : 24) + insets.bottom }]}
        onPress={() => setFitToken((n) => n + 1)}>
        <Ionicons name="locate" size={16} color={Palette.brand} />
        <Text style={styles.recenterText}>{t('map.recenter')}</Text>
      </Pressable>

      {selected ? (
        <PinCard
          member={selected}
          isMe={selected.user.id === profile?.id}
          sosActive={!!myActiveAlert && selected.user.id === profile?.id}
          sosSending={sending}
          onSos={trigger}
          onResolveSos={resolveMine}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sosBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#B91C1C',
    borderRadius: 14,
    elevation: 6,
    overflow: 'hidden',
  },
  sosBannerPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sosBannerText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  emptyText: { color: Palette.textDim, fontWeight: '600' },
  recenter: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  recenterText: { color: Palette.brand, fontWeight: '800' },
});
