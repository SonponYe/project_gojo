import { Redirect, Stack, useSegments } from 'expo-router';

import { useAuth } from '../../context/auth';

export default function AuthLayout() {
  const { initializing, ready, session, profile } = useAuth();
  // e.g. ['(auth)', 'join-family'] — the currently active screen in this group.
  const segments = useSegments();
  const activeScreen = segments[segments.length - 1];

  // Wait for the *current* session's profile before deciding where to send the
  // user — otherwise a fresh sign-in/sign-up can strand you on this screen
  // (session exists, but nothing re-evaluates "where do I belong now?").
  if (!initializing && ready && session) {
    if (profile?.family_id) {
      // Different group — this layout unmounts, so no re-render loop.
      return <Redirect href="/(tabs)" />;
    }
    // Same group: only redirect if we're not already there, or re-rendering
    // (ready flips false→true on every auth event) would redirect-to-self
    // forever and blow the update-depth limit.
    if (activeScreen !== 'join-family') {
      return <Redirect href="/(auth)/join-family" />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F6FB' } }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="join-family" />
    </Stack>
  );
}
