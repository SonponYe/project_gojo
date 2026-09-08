// Registers the background location task in global scope (must be a static
// import, before any component code runs).
import '../lib/location-task';

import { useCallback, useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Linking, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplash } from '../components/animated-splash';
import { AuthProvider } from '../context/auth';
import { setupNotifications, SOS_ACTION_DIRECTIONS } from '../lib/notifications';

// Hold the native splash until our animated overlay has taken over.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // Hand off from the native splash to the JS overlay on the same frame.
    SplashScreen.hideAsync().catch(() => {});
    setupNotifications();

    // Tapping a push: chat opens the chat tab; SOS opens the map focused on the
    // person who needs help, and its "Directions" action opens maps (spec §10.3).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        sender_id?: string;
        lat?: number;
        lng?: number;
      };

      if (data?.type === 'sos' && response.actionIdentifier === SOS_ACTION_DIRECTIONS) {
        if (data.lat != null && data.lng != null) {
          const url = Platform.select({
            ios: `http://maps.apple.com/?daddr=${data.lat},${data.lng}&dirflg=d`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}`,
          });
          Linking.openURL(url!);
        }
        return;
      }

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

  const onSplashFinish = useCallback(() => setSplashDone(true), []);

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
          {!splashDone ? <AnimatedSplash onFinish={onSplashFinish} /> : null}
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
