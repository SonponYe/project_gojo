import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const BG = '#0A0A0C';

/**
 * Covers the app on cold start with the same mark as the native splash (a white
 * circle on near-black), gives it one subtle "breath", then fades away and
 * calls `onFinish`. Mounted over everything in the root layout.
 */
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const scale = useSharedValue(1);
  const cover = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.12, { duration: 420, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 380, easing: Easing.inOut(Easing.cubic) }),
    );
    cover.value = withDelay(
      780,
      withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(onFinish)();
      }),
    );
  }, [scale, cover, onFinish]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.cover, coverStyle]} pointerEvents="none">
      <Animated.View style={[styles.dot, dotStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  dot: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
  },
});
