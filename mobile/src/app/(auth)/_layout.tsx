import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../context/auth';

export default function AuthLayout() {
  const { initializing, ready, session, profile } = useAuth();

  // Wait for the *current* session's profile before deciding where to send the
  // user — otherwise a fresh sign-in/sign-up can strand you on this screen
  // (session exists, but nothing re-evaluates "where do I belong now?").
  if (!initializing && ready && session) {
    return profile?.family_id ? (
      <Redirect href="/(tabs)" />
    ) : (
      <Redirect href="/(auth)/join-family" />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F6FB' } }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="join-family" />
    </Stack>
  );
}
