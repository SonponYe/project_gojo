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

    // Tapping a push: chat opens the chat tab; SOS opens the map focused on the
    // person who needs help (spec §10.3).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        sender_id?: string;
      };
      if (data?.type === 'chat') {
        router.navigate('/(tabs)/chat');
      } else if (data?.type === 'sos') {
        router.navigate({
          pathname: '/(tabs)',
          params: data.sender_id ? { focus: data.sender_id } : {},
        });
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 220 }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
