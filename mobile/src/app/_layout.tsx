// Registers the background location task in global scope (must be a static
// import, before any component code runs).
import '../lib/location-task';

import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../context/auth';
import { setupNotificationChannels } from '../lib/notifications';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    setupNotificationChannels();

    // Tapping an SOS or chat push opens the map (spec §10.3).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string };
      if (data?.type === 'sos' || data?.type === 'chat') {
        router.navigate(data.type === 'chat' ? '/(tabs)/chat' : '/(tabs)');
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
