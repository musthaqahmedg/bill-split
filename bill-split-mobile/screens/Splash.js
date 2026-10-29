import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../services/theme';

// 🕹️ Opening moment (v14 sticker pop): a game-style loading screen. Pixel hearts, VIBE OUT, a block loading bar.
const LINES = ['Warming up the dance floor', 'Finding your crew', 'Doing the maths for you', 'Polishing the disco ball', 'Checking who owes you 👀'];
const BLOCKS = 10;

export default function Splash() {
  const pop = useRef(new Animated.Value(0)).current;
  const [filled, setFilled] = useState(1);
  const [line] = useState(() => LINES[Math.floor(Math.random() * LINES.length)]);

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    const t = setInterval(() => setFilled((n) => (n >= BLOCKS ? BLOCKS : n + 1)), 110);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={styles.page}>
      {/* lime swooshes in the corners */}
      <View style={[styles.arc, styles.arcTop]} />
      <View style={[styles.arc, styles.arcBottom]} />

      <View style={styles.hearts}>
        <Text style={[styles.heart, { color: C.pink }]}>♥</Text>
        <Text style={[styles.heart, { color: C.pink }]}>♥</Text>
        <Text style={[styles.heart, { color: 'rgba(255,79,160,0.35)' }]}>♥</Text>
      </View>

      <Animated.View style={{ alignItems: 'center', transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }, { rotate: '-4deg' }] }}>
        <Text style={styles.bolt}>⚡</Text>
        <Text style={styles.word}>VIBE OUT</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>night-out assistant</Text>
        </View>
        <Text style={styles.hand}>🤟</Text>
      </Animated.View>

      <View style={styles.bar}>
        {Array.from({ length: BLOCKS }).map((_, i) => (
          <View key={i} style={[styles.block, i < filled && styles.blockOn]} />
        ))}
      </View>
      <Text style={styles.loading}>LOADING</Text>
      <Text style={styles.line}>{line}…</Text>

      <View style={styles.city}>
        <Text style={styles.cityText}>⏳ TONIGHT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#3B1FE0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  arc: { position: 'absolute', width: 420, height: 420, borderRadius: 210, borderWidth: 34, borderColor: C.lime },
  arcTop: { top: -250, right: -250 },
  arcBottom: { bottom: -260, left: -270 },
  hearts: { position: 'absolute', top: 110, right: 40, flexDirection: 'row' },
  heart: { fontFamily: F.pixel, fontSize: 34, marginLeft: 4 },
  bolt: { position: 'absolute', left: -26, top: -6, fontSize: 34 },
  word: { fontFamily: F.logo, color: '#fff', fontSize: 52, letterSpacing: 1, textShadowColor: C.pink, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0 },
  pill: { backgroundColor: C.pink, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, marginTop: 6, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  pillText: { fontFamily: F.pixel, color: '#fff', fontSize: 13 },
  hand: { position: 'absolute', right: -40, bottom: -36, fontSize: 40 },
  bar: { flexDirection: 'row', backgroundColor: C.pink, padding: 5, borderRadius: 4, marginTop: 70, borderWidth: 3, borderColor: '#0E0E12' },
  block: { width: 20, height: 22, marginHorizontal: 2, backgroundColor: 'rgba(14,14,18,0.25)' },
  blockOn: { backgroundColor: '#0E0E12' },
  loading: { fontFamily: F.pixel, color: '#0E0E12', fontSize: 30, letterSpacing: 4, marginTop: 10 },
  line: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700', marginTop: 8 },
  city: { position: 'absolute', bottom: 70, backgroundColor: C.pink, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 14, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#0E0E12', borderBottomColor: '#0E0E12' },
  cityText: { fontFamily: F.pixel, color: '#fff', fontSize: 14 },
});
