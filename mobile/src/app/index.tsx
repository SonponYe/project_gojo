import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/auth';
import { Palette } from '../components/ui';

/** Entry gate — route by auth + family state (spec: no dashboards, straight in). */
export default function Index() {
  const { initializing, ready, session, profile } = useAuth();

  if (initializing || !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.bg }}>
        <ActivityIndicator color={Palette.brand} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.family_id) return <Redirect href="/(auth)/join-family" />;
  return <Redirect href="/(tabs)" />;
}
