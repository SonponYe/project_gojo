import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/auth';
import { useFamilyMap } from '../../hooks/use-family-map';
import { useFamilyPins } from '../../hooks/use-family-pins';
import { useSos } from '../../hooks/use-sos';
import { t } from '../../i18n';
import { syncMyLocation } from '../../lib/location-sync';
import { supabase } from '../../lib/supabase';
import { AddMapPinModal } from '../../components/add-map-pin-modal';
import { FamilyMap } from '../../components/family-map';
import { PeopleListSheet } from '../../components/people-list-sheet';
import { PinCard } from '../../components/pin-card';
import { PlacePinCard } from '../../components/place-pin-card';
import { Palette, Screen } from '../../components/ui';

type CheckinState = 'idle' | 'sending' | 'sent';

export default function MapScreen() {
  const { profile, family } = useAuth();
  const insets = useSafeAreaInsets();
  const { roster, fromCache, reload } = useFamilyMap(family?.id);
  const { alerts, myActiveAlert, sending, trigger, resolveMine } = useSos(family?.id, profile?.id);
  const { pins, addPin, removePin } = useFamilyPins(family?.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [focusCoord, setFocusCoord] = useState<[number, number] | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showDropPin, setShowDropPin] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [checkinStates, setCheckinStates] = useState<Record<string, CheckinState>>({});

  function selectPerson(userId: string) {
    setSelectedPinId(null);
    setSelectedId(userId);
  }
  function selectPlace(pinId: string) {
    setSelectedId(null);
    setSelectedPinId(pinId);
  }

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
    if (focus) selectPerson(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const sosUserIds = useMemo(() => new Set(alerts.map((a) => a.sender_id)), [alerts]);

  const selected = useMemo(
    () => roster.find((m) => m.user.id === selectedId) ?? null,
    [roster, selectedId],
  );
  const selectedPin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) ?? null,
    [pins, selectedPinId],
  );
  const cardShown = !!selected || !!selectedPin;
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

  // Pick someone from the people sheet: select them and fly the camera there,
  // even if their pin is hidden behind others on screen.
  function onPickPerson(userId: string) {
    selectPerson(userId);
    const m = roster.find((r) => r.user.id === userId);
    if (m?.location) {
      setFocusCoord([m.location.longitude, m.location.latitude]);
      setFocusToken((n) => n + 1);
    }
  }

  async function onPressDropPin() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPendingCoords({ lat: fix.coords.latitude, lng: fix.coords.longitude });
      setShowDropPin(true);
    } catch {
      /* no fix available right now */
    }
  }

  async function onSubmitDropPin(name: string) {
    if (!pendingCoords || !profile?.id) return;
    await addPin({ name, lat: pendingCoords.lat, lng: pendingCoords.lng }, profile.id);
    setShowDropPin(false);
  }

  async function onRequestCheckin(targetUserId: string) {
    setCheckinStates((s) => ({ ...s, [targetUserId]: 'sending' }));
    try {
      await supabase.functions.invoke('request-checkin', {
        body: { target_user_id: targetUserId },
      });
    } finally {
      setCheckinStates((s) => ({ ...s, [targetUserId]: 'sent' }));
    }
  }

  return (
    <Screen>
      <FamilyMap
        roster={roster}
        myId={profile?.id}
        selectedId={selectedId}
        onSelect={selectPerson}
        sosUserIds={sosUserIds}
        pins={pins}
        selectedPinId={selectedPinId}
        onSelectPin={selectPlace}
        fitToken={fitToken}
        focusCoord={focusCoord}
        focusToken={focusToken}
      />

      {sosBanner && firstAlert ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(160)}
          style={[styles.sosBanner, { top: insets.top + 8 }]}>
          <Pressable
            style={styles.sosBannerPress}
            onPress={() => selectPerson(firstAlert.sender_id)}>
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

      {/* Top-right: find someone whose pin is hard to spot in a cluster. */}
      <Pressable
        style={[styles.peopleBtn, { top: insets.top + 8 }]}
        onPress={() => setShowPeople(true)}
        accessibilityLabel={t('map.peopleTitle')}>
        <Ionicons name="people" size={20} color={Palette.brand} />
      </Pressable>

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

      <View style={[styles.mapButtons, { bottom: (cardShown ? 260 : 24) + insets.bottom }]}>
        <Pressable
          style={styles.roundBtn}
          onPress={onPressDropPin}
          accessibilityLabel={t('map.dropPin')}>
          <Ionicons name="flag-outline" size={20} color={Palette.brand} />
        </Pressable>
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
          onRequestCheckin={() => onRequestCheckin(selected.user.id)}
          checkinState={checkinStates[selected.user.id] ?? 'idle'}
        />
      ) : selectedPin ? (
        <PlacePinCard
          pin={selectedPin}
          creatorName={
            roster.find((m) => m.user.id === selectedPin.created_by)?.user.name ??
            (selectedPin.created_by === profile?.id ? profile?.name ?? '' : t('map.you'))
          }
          isMine={selectedPin.created_by === profile?.id}
          onClose={() => setSelectedPinId(null)}
          onDelete={() => {
            removePin(selectedPin.id);
            setSelectedPinId(null);
          }}
        />
      ) : null}

      <PeopleListSheet
        visible={showPeople}
        roster={roster}
        myId={profile?.id}
        sosUserIds={sosUserIds}
        onClose={() => setShowPeople(false)}
        onSelect={onPickPerson}
      />

      <AddMapPinModal
        visible={showDropPin}
        onClose={() => setShowDropPin(false)}
        onSubmit={onSubmitDropPin}
      />
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
  peopleBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
