import { useState } from 'react';
import { Link, router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../context/auth';
import { t } from '../../i18n';
import { Button, Field, Palette } from '../../components/ui';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await signUp(email, password, name);
      setNotice(t('auth.checkEmail'));
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
          <Text style={styles.logo}>Gojo</Text>
          <Text style={styles.tagline}>{t('auth.signUp')}</Text>
        </View>

        <View style={styles.form}>
          <Field label={t('auth.name')} value={name} onChangeText={setName} autoCapitalize="words" />
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Button
            title={notice ? t('auth.signIn') : t('auth.signUp')}
            onPress={notice ? () => router.replace('/(auth)/sign-in') : submit}
            loading={busy}
          />
          <Link href="/(auth)/sign-in" style={styles.link}>
            {t('auth.haveAccount')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 40 },
  header: { alignItems: 'center', gap: 6 },
  logo: { fontSize: 40, fontWeight: '900', color: Palette.brand, letterSpacing: -1 },
  tagline: { fontSize: 15, color: Palette.textDim, fontWeight: '600' },
  form: { gap: 16 },
  error: { color: Palette.danger, fontWeight: '600', textAlign: 'center' },
  notice: { color: Palette.brand, fontWeight: '600', textAlign: 'center' },
  link: { textAlign: 'center', color: Palette.brand, fontWeight: '700', paddingVertical: 8 },
});
