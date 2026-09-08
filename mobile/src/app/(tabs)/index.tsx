import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/auth';
import { useFamilyMap } from '../../hooks/use-family-map';
import { useSos } from '../../hooks/use-sos';
import { t } from '../../i18n';
import { syncMyLocation } from '../../lib/location-sync';
import { FamilyMap } from '../../components/family-map';
import { PinCard } from '../../components/pin-card';
import { Palette, Screen } from '../../components/ui';

export default function MapScreen() {
  const { profile, family } = useAuth();
  const insets = useSafeAreaInsets();
  const { roster, fromCache, reload } = useFamilyMap(family?.id);
  const { alerts, myActiveAlert, sending, trigger, resolveMine } = useSos(family?.id, profile?.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Push my own current position, then re-pull everyone's latest rows.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([syncMyLocation(true), reload()]);
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  // Deep link from an SOS push (spec §10.3) — open straight to that person's pin.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  useEffect(() => {
    if (focus) setSelectedId(focus);
  }, [focus]);

  const sosUserIds = useMemo(() => new Set(alerts.map((a) => a.sender_id)), [alerts]);

  const selected = useMemo(
    () => roster.find((m) => m.user.id === selectedId) ?? null,
    [roster, selectedId],
  );
  const sharingCount = roster.filter((m) => m.location).length;

  const firstAlert = alerts[0] ?? null;
  const sosBanner = useMemo(() => {
    if (alerts.length === 0) return null;
    if (alerts.length === 1) {
      const who = roster.find((m) => m.user.id === alerts[0].sender_id);
      return t('map.sosBannerOne', { name: who?.user.name ?? '' });
    }
    return t('map.sosBannerMany', { count: alerts.length });
  }, [alerts, roster]);

  function directionsTo(lat: number, lng: number) {
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url!);
  }

  return (
    <Screen>
      <FamilyMap
        roster={roster}
        myId={profile?.id}
        selectedId={selectedId}
        onSelect={setSelectedId}
        sosUserIds={sosUserIds}
        fitToken={fitToken}
      />

      {sosBanner && firstAlert ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(160)}
          style={[styles.sosBanner, { top: insets.top + 8 }]}>
          <Pressable
            style={styles.sosBannerPress}
            onPress={() => setSelectedId(firstAlert.sender_id)}>
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={styles.sosBannerText}>{sosBanner}</Text>
          </Pressable>
          <Pressable
            style={styles.sosBannerDir}
            onPress={() => directionsTo(firstAlert.lat, firstAlert.lng)}>
            <Ionicons name="navigate" size={16} color="#B91C1C" />
          </Pressable>
        </Animated.View>
      ) : null}

      {sharingCount === 0 ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.empty, { top: insets.top + 60 }]}>
          <Text style={styles.emptyText}>{t('map.empty')}</Text>
        </Animated.View>
      ) : fromCache ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.empty, { top: insets.top + 60 }]}>
          <Text style={styles.emptyText}>{t('map.cached')}</Text>
        </Animated.View>
      ) : null}

      <View style={[styles.mapButtons, { bottom: (selected ? 260 : 24) + insets.bottom }]}>
        <Pressable
          style={styles.roundBtn}
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityLabel={t('map.refresh')}>
          {refreshing ? (
            <ActivityIndicator size="small" color={Palette.brand} />
          ) : (
            <Ionicons name="refresh" size={20} color={Palette.brand} />
          )}
        </Pressable>
        <Pressable style={styles.recenter} onPress={() => setFitToken((n) => n + 1)}>
          <Ionicons name="locate" size={16} color={Palette.brand} />
          <Text style={styles.recenterText}>{t('map.recenter')}</Text>
        </Pressable>
      </View>

      {selected ? (
        <PinCard
          member={selected}
          isMe={selected.user.id === profile?.id}
          myAlertActive={!!myActiveAlert}
          theirSosActive={sosUserIds.has(selected.user.id)}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B91C1C',
    borderRadius: 14,
    elevation: 6,
    overflow: 'hidden',
  },
  sosBannerPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sosBannerText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  sosBannerDir: {
    backgroundColor: '#fff',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  empty: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  emptyText: { color: Palette.textDim, fontWeight: '600' },
  mapButtons: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 10,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  recenter: {
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
