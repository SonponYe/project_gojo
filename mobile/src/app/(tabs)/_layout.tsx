import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useAuth } from '../../context/auth';
import { useLiveTracking } from '../../hooks/use-live-tracking';
import { t } from '../../i18n';
import { Palette } from '../../components/ui';

// Filled glyph when the tab is active, outline otherwise, a standard iOS/
// Material convention that reads as more deliberate than a flat icon set.
function TabIcon({
  focused,
  filled,
  outline,
  color,
}: {
  focused: boolean;
  filled: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
}) {
  return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
}

export default function TabsLayout() {
  const { initializing, ready, session, profile } = useAuth();
  useLiveTracking(!!profile?.is_sharing);

  if (initializing || !ready) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile?.family_id) return <Redirect href="/(auth)/join-family" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.brand,
        tabBarInactiveTintColor: Palette.textDim,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: Palette.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.map'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} filled="map" outline="map-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              filled="chatbubble-ellipses"
              outline="chatbubble-ellipses-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.me'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              filled="person-circle"
              outline="person-circle-outline"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
