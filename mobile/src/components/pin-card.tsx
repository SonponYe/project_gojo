import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { t } from '../i18n';
import type { MemberWithLocation } from '../lib/database.types';
import { FRESHNESS_COLOR, freshnessOf, pinColorFor, timeAgo } from '../lib/format';
import { Avatar, BatteryBadge, SignalBadge, StatusDot } from './badges';
import { SosButton } from './sos-button';
import { Palette } from './ui';

interface Props {
  member: MemberWithLocation;
  isMe: boolean;
  /** my own SOS alert is currently active (only relevant when isMe) */
  myAlertActive: boolean;
  /** the person shown here has an active SOS (only relevant when !isMe) */
  theirSosActive: boolean;
  sosSending: boolean;
  onSos: () => void;
  onResolveSos: () => void;
  onClose: () => void;
}

export function PinCard({
  member,
  isMe,
  myAlertActive,
  theirSosActive,
  sosSending,
  onSos,
  onResolveSos,
  onClose,
}: Props) {
  const { user, location } = member;
  const [address, setAddress] = useState<string | null>(null);
  const label = location?.place_name ?? address;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const fresh = freshnessOf(location?.updated_at);

  useEffect(() => {
    let cancelled = false;
    if (!location || location.place_name) {
      setAddress(null);
      return;
    }
    Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    })
      .then((results) => {
        if (cancelled) return;
        const r = results[0];
        if (!r) return;
        const parts = [r.name ?? r.street, r.district ?? r.subregion, r.city].filter(Boolean);
        setAddress(parts.slice(0, 2).join(', ') || r.region || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location]);

  // Hand off to the phone's real maps app, straight into turn-by-turn directions
  // to this person's last known position (Gojo itself isn't a nav app).
  function openDirections() {
    if (!location) return;
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    Linking.openURL(url!);
  }

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown.duration(180)}
      style={styles.card}>
      <View style={styles.handle} />

      {!isMe && theirSosActive ? (
        <View style={styles.sosStrip}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.sosStripText}>{t('map.needsHelp', { name: firstName })}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Avatar name={user.name} url={user.avatar_url} color={pinColorFor(user.id)} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{isMe ? `${user.name} (${t('map.you')})` : user.name}</Text>
          <View style={styles.metaRow}>
            <StatusDot freshness={fresh} />
            <Text style={[styles.meta, { color: FRESHNESS_COLOR[fresh] }]}>
              {!location
                ? t('map.offline')
                : fresh === 'live'
                  ? t('map.live')
                  : t('map.updatedAgo', { ago: timeAgo(location.updated_at) })}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={20} color={Palette.textDim} />
        </Pressable>
      </View>

      {location ? (
        <>
          <Text style={styles.address}>{label ?? t('map.approxAddress')}</Text>
          <View style={styles.badges}>
            <BatteryBadge level={location.battery_level} />
            <SignalBadge type={location.signal_type} />
          </View>

          {!isMe ? (
            <Pressable
              style={[styles.dirBtn, theirSosActive && styles.dirBtnUrgent]}
              onPress={openDirections}>
              <Ionicons
                name="navigate"
                size={16}
                color={theirSosActive ? '#fff' : Palette.brand}
              />
              <Text style={[styles.dirBtnText, theirSosActive && { color: '#fff' }]}>
                {t('map.directionsTo', { name: firstName })}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {/* Spec (per product decision): you can only raise an SOS as yourself. */}
      {isMe ? (
        <View style={{ marginTop: 12 }}>
          <SosButton
            onTrigger={onSos}
            sending={sosSending}
            active={myAlertActive}
            onResolve={onResolveSos}
          />
        </View>
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
  sosStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.danger,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sosStripText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 17, fontWeight: '800', color: Palette.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { fontWeight: '700', fontSize: 13 },
  address: { color: Palette.text, fontSize: 15, fontWeight: '600' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
  dirBtn: {
    marginTop: 6,
    backgroundColor: Palette.brandSoft,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dirBtnUrgent: { backgroundColor: Palette.danger },
  dirBtnText: { color: Palette.brand, fontWeight: '800' },
});
