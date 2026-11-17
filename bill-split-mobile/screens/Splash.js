import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BRAND, C, F } from '../services/theme';

// 🌙 Opening moment: "night system booting" — glitch title, spinning neon ring with cycling emojis,
// a segmented loading bar and terminal lines. Only shows while the app is actually starting.
const EMOJIS = ['🍹', '😈', '🔥', '🥳', '🪩', '👾'];
const LINES = ['syncing squad', 'splitting the bill', "finding tonight's vibe"];
const SEGMENTS = 16;
const MAGENTA = '#FF2BD6';

export default function Splash() {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [emoji, setEmoji] = useState(0);
  const [filled, setFilled] = useState(1);
  const [shown, setShown] = useState(0); // terminal lines visible
  const [blink, setBlink] = useState(true);
  const [glitch, setGlitch] = useState(0);

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
    const t1 = setInterval(() => setEmoji((n) => (n + 1) % EMOJIS.length), 320);
    const t2 = setInterval(() => setFilled((n) => Math.min(SEGMENTS, n + 1)), 65);
    const t3 = setInterval(() => setShown((n) => Math.min(LINES.length, n + 1)), 300);
    const t4 = setInterval(() => setBlink((b) => !b), 400);
    const t5 = setInterval(() => setGlitch((g) => (g + 1) % 7), 120);
    return () => [t1, t2, t3, t4, t5].forEach(clearInterval);
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateBack = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const jitter = glitch === 3 ? 2 : glitch === 5 ? -2 : 0; // a tiny glitch every so often

  return (
    <View style={styles.page}>
      <View style={styles.glow} />
      {/* corner brackets */}
      <View style={[styles.corner, { top: 54, left: 18, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[styles.corner, { top: 54, right: 18, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[styles.corner, { bottom: 40, left: 18, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[styles.corner, { bottom: 40, right: 18, borderBottomWidth: 2, borderRightWidth: 2 }]} />

      <View style={styles.topBar}>
        <Text style={styles.sys}>{BRAND.upper}//OS</Text>
        <Text style={styles.sys}>
          <Text style={{ color: blink ? C.lime : 'transparent' }}>● </Text>ONLINE
        </Text>
      </View>

      {/* glitch title: cyan + magenta ghosts behind the white word */}
      <View style={styles.titleWrap}>
        <Text style={[styles.title, styles.ghost, { color: C.cyan, transform: [{ translateX: -2 + jitter }] }]}>{BRAND.upper}</Text>
        <Text style={[styles.title, styles.ghost, { color: MAGENTA, transform: [{ translateX: 2 - jitter }] }]}>{BRAND.upper}</Text>
        <Text style={styles.title}>{BRAND.upper}</Text>
      </View>
      <View style={styles.rule} />
      <Text style={styles.tagline}>{BRAND.tagline}</Text>

      {/* neon ring */}
      <View style={styles.ringBox}>
        <Animated.View style={[styles.dashed, { transform: [{ rotate: rotateBack }] }]} />
        <Animated.View style={[styles.arc, { transform: [{ rotate }] }]} />
        <Animated.View style={[styles.core, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }]}>
          <Text style={styles.emoji}>{EMOJIS[emoji]}</Text>
        </Animated.View>
      </View>

      {/* loading bar */}
      <View style={styles.barHead}>
        <Text style={styles.small}>BOOTING NIGHT SYSTEM</Text>
        <Text style={styles.small}>LVL 01</Text>
      </View>
      <View style={styles.bar}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <View key={i} style={[styles.seg, i < filled && { backgroundColor: i < SEGMENTS / 2 ? C.cyan : i < SEGMENTS * 0.75 ? C.violet : MAGENTA }]} />
        ))}
      </View>

      {/* terminal lines */}
      <View style={styles.term}>
        {LINES.map((l, i) =>
          i < shown ? (
            <Text key={l} style={styles.termLine}>
              {'> '}{l}{i < LINES.length - 1 ? ' ... ok' : blink ? '_' : ' '}
            </Text>
          ) : null
        )}
      </View>

      <Text style={styles.footer}>
        <Text style={{ color: MAGENTA }}>// </Text>{BRAND.footer}<Text style={{ color: MAGENTA }}> //</Text>
      </Text>
    </View>
  );
}

const RING = 150;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#07060C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, overflow: 'hidden' },
  glow: { position: 'absolute', width: 520, height: 520, borderRadius: 260, backgroundColor: '#3A0D52', opacity: 0.55, top: '22%' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: C.cyan },
  topBar: { position: 'absolute', top: 66, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between' },
  sys: { fontFamily: F.pixel, color: C.cyan, fontSize: 11, opacity: 0.85 },
  titleWrap: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.logo, color: '#FFFFFF', fontSize: 46, letterSpacing: 2 },
  ghost: { position: 'absolute', opacity: 0.7 },
  rule: { width: 200, height: 1, backgroundColor: C.cyan, opacity: 0.5, marginTop: 10 },
  tagline: { fontFamily: F.pixel, color: '#E8E8F0', fontSize: 12, letterSpacing: 5, marginTop: 10 },
  ringBox: { width: RING + 20, height: RING + 20, alignItems: 'center', justifyContent: 'center', marginTop: 34 },
  dashed: { position: 'absolute', width: RING + 16, height: RING + 16, borderRadius: (RING + 16) / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.cyan, opacity: 0.7 },
  arc: { position: 'absolute', width: RING - 4, height: RING - 4, borderRadius: (RING - 4) / 2, borderWidth: 4, borderColor: 'transparent', borderTopColor: MAGENTA, borderRightColor: MAGENTA },
  core: { width: RING - 46, height: RING - 46, borderRadius: (RING - 46) / 2, borderWidth: 1, borderColor: 'rgba(85,224,240,0.35)', backgroundColor: 'rgba(58,13,82,0.6)', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 42 },
  barHead: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
  small: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  bar: { width: '100%', flexDirection: 'row', borderWidth: 1.5, borderColor: C.cyan, borderRadius: 4, padding: 3, marginTop: 8 },
  seg: { flex: 1, height: 12, marginHorizontal: 1.5, borderRadius: 1, backgroundColor: 'rgba(85,224,240,0.08)' },
  term: { width: '100%', minHeight: 60, marginTop: 14 },
  termLine: { fontFamily: F.pixel, color: '#C9C9D6', fontSize: 11, marginBottom: 5 },
  footer: { position: 'absolute', bottom: 80, fontFamily: F.pixel, color: '#E8E8F0', fontSize: 11, letterSpacing: 2, textAlign: 'center' },
});
