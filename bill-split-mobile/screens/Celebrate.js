import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../services/theme';

// 🎉 Party burst: emojis fly up + a big "GO!" when a plan is locked in (Gautham's idea). Respects quick tap-away.
const EMOJI = ['🎉', '🪩', '🔥', '💃', '🥳', '✨', '🎊', '🕺'];

export default function Celebrate({ visible, title = 'GO!', sub = 'Plan locked in 🔒', onDone }) {
  const { width, height } = Dimensions.get('window');
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const bits = useRef(
    Array.from({ length: 22 }).map((_, i) => ({
      e: EMOJI[i % EMOJI.length],
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 160,
      size: 22 + Math.random() * 18,
      delay: Math.random() * 350,
      v: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
    scale.setValue(0.3);
    fade.setValue(0);
    bits.forEach((b) => b.v.setValue(0));
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      ...bits.map((b) => Animated.timing(b.v, { toValue: 1, duration: 1500, delay: b.delay, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onDone && onDone());
    }, 1700);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone}>
      <Animated.View style={[styles.overlay, { opacity: fade }]} onTouchEnd={onDone}>
        {bits.map((b, i) => (
          <Animated.Text
            key={i}
            style={{
              position: 'absolute',
              left: b.x,
              top: height,
              fontSize: b.size,
              transform: [
                { translateY: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, -height * (0.75 + (i % 4) * 0.06)] }) },
                { translateX: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
                { rotate: b.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 200}deg`] }) },
              ],
            }}
          >
            {b.e}
          </Animated.Text>
        ))}
        <Animated.View style={[styles.center, { transform: [{ scale }] }]}>
          <View style={styles.sticker}>
            <Text style={styles.go}>{title}</Text>
          </View>
          <Text style={styles.sub}>{sub}</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(7,7,10,0.82)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  sticker: { backgroundColor: C.accent, borderRadius: 32, paddingHorizontal: 34, paddingVertical: 10, transform: [{ rotate: '-4deg' }], shadowColor: C.accent, shadowOpacity: 0.6, shadowRadius: 20, elevation: 10 },
  go: { fontFamily: F.display, color: '#fff', fontSize: 70, letterSpacing: 2 },
  sub: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 18 },
});
