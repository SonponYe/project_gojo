// Notification wiring: channels, the foreground display handler, Expo push-token
// registration, and the 6-hour awareness ping (spec §4 Layer 2).

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { Config, Tracking } from './config';
import { t } from '../i18n';
import { supabase } from './supabase';

const AWARENESS_ID_KEY = 'gojo-awareness-ping';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: t('notifications.channelDefault'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('chat', {
    name: t('notifications.channelChat'),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('sos', {
    name: t('notifications.channelSos'),
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#EF4444',
    bypassDnd: true,
  });
}

/** Ask for notification permission. Returns whether it was granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return req.granted;
}

/** Register this device's Expo push token against the signed-in user row. */
export async function registerPushToken(): Promise<void> {
  try {
    // Web push needs a VAPID key we don't configure; native-only for now.
    if (Platform.OS === 'web') return;
    if (!Device.isDevice) return; // simulators can't get a push token
    if (!(await requestNotificationPermission())) return;

    const token = await Notifications.getExpoPushTokenAsync(
      Config.easProjectId ? { projectId: Config.easProjectId } : undefined,
    );
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (uid && token.data) {
      await supabase.from('users').update({ push_token: token.data }).eq('id', uid);
    }
  } catch (err) {
    console.warn('[gojo] push token registration failed', (err as Error)?.message);
  }
}

/** Spec §4 Layer 2, a repeating local ping that cannot be silently suppressed. */
export async function scheduleAwarenessPing(): Promise<void> {
  await cancelAwarenessPing();
  await Notifications.scheduleNotificationAsync({
    identifier: AWARENESS_ID_KEY,
    content: {
      title: t('notifications.awarenessTitle'),
      body: t('notifications.awarenessBody'),
      data: { type: 'awareness' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Tracking.awarenessIntervalSec,
      repeats: true,
    },
  });
}

export async function cancelAwarenessPing(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(AWARENESS_ID_KEY);
  } catch {
    // nothing scheduled
  }
}
