import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C } from '../services/theme';

// ✨ Opening moment: glowing moon, VibeOut wordmark and a fun loading line (from Gautham's loading-screen designs)
const LINES = [
  'Warming up the dance floor…',
  'Finding your crew…',
  'Doing the maths so you don’t have to…',
  'Chilling the vibes…',
  'Checking who still owes you… 👀',
  'Polishing the disco ball…',
];

export default function Splash() {
  const glow = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const [line] = useState(() => LINES[Math.floor(Math.random() * LINES.length)]);

  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.page}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }}
      >
        <View style={styles.moonWrap}>
          <Animated.View style={[styles.halo, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }] }]} />
          <Text style={styles.moon}>🌙</Text>
        </View>
        <Text style={styles.word}>
          Vibe<Text style={styles.wordGold}>Out</Text>
        </Text>
        <Text style={styles.tag}>The whole night, sorted.</Text>
      </Animated.View>
      <Animated.Text style={[styles.line, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]}>{line}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  moonWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: C.accent, shadowColor: C.accentSoft, shadowOpacity: 0.9, shadowRadius: 40 },
  moon: { fontSize: 72 },
  word: { color: C.text, fontSize: 44, fontWeight: '900', letterSpacing: 0.5, marginTop: 14 },
  wordGold: { color: C.accentSoft },
  tag: { color: C.sub, fontSize: 15, fontWeight: '600', marginTop: 6 },
  line: { position: 'absolute', bottom: 70, color: C.faint, fontSize: 13, fontWeight: '600' },
});
