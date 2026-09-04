import { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { t } from '../i18n';
import { Palette } from './ui';

const HOLD_MS = 2000; // spec §10.3, 2-second hold guards against accidental triggers

/**
 * Large red SOS control for the pin card. Fires `onTrigger` only after a full
 * 2-second hold; releasing early cancels. Shows a filling bar while held.
 */
export function SosButton({
  onTrigger,
  sending,
  active,
  onResolve,
}: {
  onTrigger: () => void;
  sending?: boolean;
  active?: boolean;
  onResolve?: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [progress]);

  const begin = useCallback(() => {
    if (sending || active) return;
    setHolding(true);
    Vibration.vibrate(10);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();
    timer.current = setTimeout(() => {
      Vibration.vibrate([0, 60, 40, 120]);
      cancel();
      onTrigger();
    }, HOLD_MS);
  }, [sending, active, progress, cancel, onTrigger]);

  if (active) {
    return (
      <View style={[styles.button, styles.activeButton]}>
        <Text style={styles.activeLabel}>{t('map.sosActive')}</Text>
        <Pressable style={styles.okButton} onPress={onResolve} accessibilityRole="button">
          <Text style={styles.okLabel}>{t('map.imOk')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPressIn={begin}
      onPressOut={cancel}
      accessibilityRole="button"
      accessibilityLabel={t('map.sos')}
      accessibilityHint={t('map.sosHold')}
      style={styles.button}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
      <Text style={styles.label}>
        {sending ? t('map.sosSending') : holding ? t('map.sosHold') : t('map.sos')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 58,
    borderRadius: 16,
    backgroundColor: Palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  label: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  activeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#7F1D1D',
  },
  activeLabel: { color: '#fff', fontSize: 16, fontWeight: '800' },
  okButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  okLabel: { color: '#7F1D1D', fontWeight: '800' },
});
