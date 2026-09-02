import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../context/auth';

export default function AuthLayout() {
  const { initializing, session, profile } = useAuth();

  // Signed in and already in a family → the app proper.
  if (!initializing && session && profile?.family_id) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F6FB' } }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="join-family" />
    </Stack>
  );
}
