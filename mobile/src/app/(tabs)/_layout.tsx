import { Redirect, Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { useAuth } from '../../context/auth';
import { t } from '../../i18n';
import { Palette } from '../../components/ui';

function Icon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 22, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { initializing, session, profile } = useAuth();

  if (initializing) return null;
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
          tabBarIcon: ({ color }) => <Icon glyph="🗺️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ color }) => <Icon glyph="💬" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.me'),
          tabBarIcon: ({ color }) => <Icon glyph="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
