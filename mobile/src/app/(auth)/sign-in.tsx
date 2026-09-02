import { useState } from 'react';
import { Link } from 'expo-router';
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

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
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
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        <View style={styles.form}>
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={t('auth.signIn')} onPress={submit} loading={busy} />
          <Link href="/(auth)/sign-up" style={styles.link}>
            {t('auth.noAccount')}
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
  link: { textAlign: 'center', color: Palette.brand, fontWeight: '700', paddingVertical: 8 },
});
