import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import type { MemberWithLocation } from '../lib/database.types';
import { freshnessOf, pinColorFor, timeAgo } from '../lib/format';
import { Avatar, BatteryBadge, SignalBadge, StatusDot } from './badges';
import { SosButton } from './sos-button';
import { Palette } from './ui';

interface Props {
  member: MemberWithLocation;
  isMe: boolean;
  sosActive: boolean;
  sosSending: boolean;
  onSos: () => void;
  onResolveSos: () => void;
  onClose: () => void;
}

/** Spec §2.1 — the card that opens when you tap a pin. §10 adds battery/signal/SOS. */
export function PinCard({
  member,
  isMe,
  sosActive,
  sosSending,
  onSos,
  onResolveSos,
  onClose,
}: Props) {
  const { user, location } = member;
  const [address, setAddress] = useState<string | null>(null);
  const label = location?.place_name ?? address;

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

  function openInMaps() {
    if (!location) return;
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(user.name)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url!);
  }

  return (
    <View style={styles.card}>
      <View style={styles.handle} />
      <View style={styles.row}>
        <Avatar name={user.name} url={user.avatar_url} color={pinColorFor(user.id)} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{isMe ? `${user.name} (${t('map.you')})` : user.name}</Text>
          <View style={styles.metaRow}>
            <StatusDot freshness={freshnessOf(location?.updated_at)} />
            <Text style={styles.meta}>
              {location ? `${t('map.lastSeen')} ${timeAgo(location.updated_at)}` : t('map.offline')}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {location ? (
        <>
          <Text style={styles.address}>{label ?? t('map.approxAddress')}</Text>
          <View style={styles.badges}>
            <BatteryBadge level={location.battery_level} />
            <SignalBadge type={location.signal_type} />
          </View>
          <Pressable style={styles.mapsBtn} onPress={openInMaps}>
            <Text style={styles.mapsBtnText}>{t('map.openInMaps')}</Text>
          </Pressable>
        </>
      ) : null}

      {/* SOS can be fired for anyone, including yourself (spec §10.3). */}
      <View style={{ marginTop: 12 }}>
        <SosButton
          onTrigger={onSos}
          sending={sosSending}
          active={sosActive}
          onResolve={onResolveSos}
        />
      </View>
    </View>
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
  name: { fontSize: 17, fontWeight: '800', color: Palette.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { color: Palette.textDim, fontWeight: '600', fontSize: 13 },
  close: { fontSize: 16, color: Palette.textDim, padding: 4 },
  address: { color: Palette.text, fontSize: 15, fontWeight: '600' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 2 },
  mapsBtn: {
    marginTop: 6,
    backgroundColor: Palette.brandSoft,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  mapsBtnText: { color: Palette.brand, fontWeight: '800' },
});
