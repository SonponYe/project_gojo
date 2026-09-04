import { useState } from 'react';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../context/auth';
import { t } from '../../i18n';
import { supabase } from '../../lib/supabase';
import { Button, Card, Field, Palette } from '../../components/ui';

type Mode = 'join' | 'create';

export default function JoinFamily() {
  const { signOut, refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    consented && (mode === 'join' ? code.trim().length >= 4 : familyName.trim().length >= 1);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'join') {
        const { error: e } = await supabase.rpc('join_family', {
          p_invite_code: code.trim().toUpperCase(),
        });
        if (e) throw new Error(t('onboarding.invalidCode'));
      } else {
        const { error: e } = await supabase.rpc('create_family', { p_name: familyName.trim() });
        if (e) throw e;
      }
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (e) {
      setError((e as Error).message || t('auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'join' ? t('onboarding.title') : t('onboarding.createTitle')}
          </Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
        </View>

        <View style={styles.switcher}>
          <Tab label={t('onboarding.join')} active={mode === 'join'} onPress={() => setMode('join')} />
          <Tab
            label={t('onboarding.create')}
            active={mode === 'create'}
            onPress={() => setMode('create')}
          />
        </View>

        {mode === 'join' ? (
          <Field
            label={t('onboarding.inviteCode')}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="ABC123"
          />
        ) : (
          <Field
            label={t('onboarding.familyName')}
            value={familyName}
            onChangeText={setFamilyName}
            autoCapitalize="words"
            placeholder="The Mensah family"
          />
        )}

        {/* Safety Layer 1 — explicit, logged consent. */}
        <Card style={styles.consentCard}>
          <Text style={styles.consentTitle}>{t('onboarding.consentTitle')}</Text>
          <Text style={styles.consentBody}>{t('onboarding.consentBody')}</Text>
          <Pressable style={styles.checkRow} onPress={() => setConsented((v) => !v)}>
            <View style={[styles.checkbox, consented && styles.checkboxOn]}>
              {consented ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>{t('onboarding.consentAccept')}</Text>
          </Pressable>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={mode === 'join' ? t('onboarding.join') : t('onboarding.create')}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />
        <Pressable onPress={signOut}>
          <Text style={styles.signout}>{t('profile.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  header: { gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Palette.text },
  subtitle: { fontSize: 15, color: Palette.textDim, lineHeight: 21 },
  switcher: {
    flexDirection: 'row',
    backgroundColor: '#EDEDEF',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontWeight: '700', color: Palette.textDim },
  tabTextActive: { color: Palette.brand },
  consentCard: { backgroundColor: Palette.brandSoft, borderColor: '#E2E2E6', gap: 10 },
  consentTitle: { fontWeight: '800', color: Palette.brand, fontSize: 15 },
  consentBody: { color: Palette.text, lineHeight: 21 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Palette.brand },
  checkmark: { color: '#fff', fontWeight: '900' },
  checkLabel: { fontWeight: '700', color: Palette.text, flex: 1 },
  error: { color: Palette.danger, fontWeight: '600', textAlign: 'center' },
  signout: { textAlign: 'center', color: Palette.textDim, fontWeight: '600', paddingVertical: 10 },
});
