import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/auth';
import { useSavedPlaces } from '../../hooks/use-saved-places';
import { SUPPORTED_LANGUAGES, t } from '../../i18n';
import type { LanguageCode } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';
import { startTracking, stopTracking } from '../../lib/tracking';
import { AddPlaceModal } from '../../components/add-place-modal';
import { Button, Card, Label, Palette, Screen } from '../../components/ui';

export default function ProfileScreen() {
  const { profile, family, language, signOut, refreshProfile, setLanguageOverride } = useAuth();
  const insets = useSafeAreaInsets();
  const { places, addPlace, removePlace, atLimit } = useSavedPlaces(profile?.id);

  const [sharing, setSharing] = useState(!!profile?.is_sharing);
  const [busy, setBusy] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);

  useEffect(() => setSharing(!!profile?.is_sharing), [profile?.is_sharing]);

  async function onToggleSharing(next: boolean) {
    setBusy(true);
    setPermBlocked(false);
    setSharing(next); // optimistic
    try {
      if (next) {
        const res = await startTracking();
        if (!res.ok) {
          setSharing(false);
          setPermBlocked(true);
        }
      } else {
        await stopTracking(); // spec §4 Layer 5 — instant, no confirm
      }
    } finally {
      await refreshProfile();
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!family) return;
    await Clipboard.setStringAsync(family.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    await supabase.rpc('regenerate_invite_code');
    await refreshProfile();
  }

  function confirmLeave() {
    Alert.alert(t('profile.leaveFamily'), t('profile.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.leaveFamily'),
        style: 'destructive',
        onPress: async () => {
          await stopTracking();
          await supabase.rpc('leave_family');
          await refreshProfile();
        },
      },
    ]);
  }

  async function onAddPlace(input: { name: string; radius_m: number }) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await addPlace({
      name: input.name,
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      radius_m: input.radius_m,
    });
    setShowAddPlace(false);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.h1}>{t('profile.title')}</Text>
        <Text style={styles.sub}>{profile?.name} · {profile?.email}</Text>

        {/* ---- Master tracking toggle (spec §2.3) ---- */}
        <Card style={styles.trackCard}>
          <View style={styles.trackRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle}>{t('profile.tracking')}</Text>
              <Text style={[styles.trackState, { color: sharing ? Palette.ok : Palette.textDim }]}>
                {sharing ? t('profile.trackingOn') : t('profile.trackingOff')}
              </Text>
            </View>
            <Switch
              value={sharing}
              onValueChange={onToggleSharing}
              disabled={busy}
              trackColor={{ true: Palette.brand }}
            />
          </View>
          <Text style={styles.help}>{t('profile.trackingHelp')}</Text>

          {permBlocked ? (
            <View style={styles.permBox}>
              <Text style={styles.permTitle}>{t('profile.permissionTitle')}</Text>
              <Text style={styles.permBody}>{t('profile.permissionBody')}</Text>
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={styles.permLink}>{t('profile.openSettings')}</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {/* ---- Invite code ---- */}
        <Label>{t('profile.inviteTitle')}</Label>
        <Card>
          <Text style={styles.help}>{t('profile.inviteHelp')}</Text>
          <Pressable onPress={copyCode} style={styles.codeBox}>
            <Text style={styles.code}>{family?.invite_code ?? '—'}</Text>
            <Text style={styles.codeHint}>{copied ? t('profile.copied') : 'Tap to copy'}</Text>
          </Pressable>
          <Pressable onPress={regenerate}>
            <Text style={styles.linkBtn}>{t('profile.regenerate')}</Text>
          </Pressable>
        </Card>

        {/* ---- Named places (spec §10.4) ---- */}
        <Label>{t('profile.places')}</Label>
        <Card style={{ gap: 10 }}>
          <Text style={styles.help}>{t('profile.placesHelp')}</Text>
          {places.map((p) => (
            <View key={p.id} style={styles.placeRow}>
              <Text style={styles.placeName}>📍 {p.name}</Text>
              <Text style={styles.placeMeta}>{t('profile.meters', { value: p.radius_m })}</Text>
              <Pressable onPress={() => removePlace(p.id)} hitSlop={8}>
                <Text style={styles.placeDelete}>✕</Text>
              </Pressable>
            </View>
          ))}
          {atLimit ? (
            <Text style={styles.help}>{t('profile.maxPlaces')}</Text>
          ) : (
            <Button
              title={t('profile.addPlace')}
              variant="secondary"
              onPress={() => setShowAddPlace(true)}
            />
          )}
        </Card>

        {/* ---- Language (spec §10.5) ---- */}
        <Label>{t('profile.language')}</Label>
        <Card style={{ gap: 8 }}>
          <LangOption
            label={t('profile.languageSystem')}
            active={!profile?.language}
            onPress={() => setLanguageOverride(null)}
          />
          {SUPPORTED_LANGUAGES.map((l) => (
            <LangOption
              key={l.code}
              label={l.label}
              active={profile?.language === l.code}
              onPress={() => setLanguageOverride(l.code as LanguageCode)}
            />
          ))}
          <Text style={styles.help}>Current: {language.toUpperCase()}</Text>
        </Card>

        <View style={{ height: 12 }} />
        <Button title={t('profile.signOut')} variant="ghost" onPress={signOut} />
        <Button title={t('profile.leaveFamily')} variant="danger" onPress={confirmLeave} />
      </ScrollView>

      <AddPlaceModal
        visible={showAddPlace}
        onClose={() => setShowAddPlace(false)}
        onSubmit={onAddPlace}
      />
    </Screen>
  );
}

function LangOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.langRow} onPress={onPress}>
      <Text style={styles.langLabel}>{label}</Text>
      <View style={[styles.radio, active && styles.radioOn]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  h1: { fontSize: 28, fontWeight: '900', color: Palette.text },
  sub: { color: Palette.textDim, fontWeight: '600', marginBottom: 8 },
  trackCard: { gap: 12, borderColor: '#D9D6F7' },
  trackRow: { flexDirection: 'row', alignItems: 'center' },
  trackTitle: { fontSize: 16, fontWeight: '800', color: Palette.text },
  trackState: { fontWeight: '700', marginTop: 2 },
  help: { color: Palette.textDim, fontSize: 13, lineHeight: 19 },
  permBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, gap: 4 },
  permTitle: { fontWeight: '800', color: Palette.danger },
  permBody: { color: Palette.text, fontSize: 13, lineHeight: 18 },
  permLink: { color: Palette.danger, fontWeight: '800', marginTop: 4 },
  codeBox: {
    backgroundColor: Palette.brandSoft,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 6, color: Palette.brand },
  codeHint: { color: Palette.brand, fontWeight: '600', fontSize: 12, marginTop: 4 },
  linkBtn: { color: Palette.brand, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  placeName: { flex: 1, fontWeight: '700', color: Palette.text },
  placeMeta: { color: Palette.textDim, fontWeight: '600', fontSize: 13 },
  placeDelete: { color: Palette.danger, fontWeight: '900', fontSize: 16 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  langLabel: { fontSize: 15, fontWeight: '600', color: Palette.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Palette.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.brand },
});
