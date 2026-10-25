import { LinearGradient } from '../components/SafeGradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, F, G } from '../services/theme';
import NightSky from '../components/NightSky';

// 👋 First open: 3 punchy slides (Gautham's "PULL UP. LINK UP. VIBE OUT." design), then straight in as a guest
const SLIDES = [
  {
    hero: '🪩',
    stickers: ['🎉', '🎶', '✨', '🍕'],
    kicker: 'YOUR NIGHT. SORTED.',
    lines: ['Where the night', 'comes alive.'],
    body: 'Plan the night, move as a squad, split the damage and get home safe. All with your people.',
    chips: ['💬 no group chat chaos', '🧾 bills split in seconds', '🏠 get home safe'],
  },
  {
    hero: '🧾',
    stickers: ['📸', '👆', '💸', '🧮'],
    kicker: 'NO AWKWARD MATHS',
    lines: ['Snap it. Tap it.', 'Split it fairly.'],
    body: 'Scan the bill, everyone taps what they had, tax and service shared fairly. To the rupee.',
    chips: ['📸 scan any bill', '👆 tap your items', '💸 settle by UPI'],
  },
  {
    hero: '🔒',
    stickers: ['🙅', '💳', '🗑️', '🛡️'],
    kicker: 'PRIVATE BY DESIGN',
    lines: ['Your night.', 'Your data.'],
    body: 'Try it with no sign-up. We never sync your contacts, never hold your money, and you can delete everything anytime.',
    chips: ['🙅 no contact sync', '💳 no wallet', '🗑️ delete anytime'],
  },
];

// Sticker cluster: a glowing centre emoji with 4 tilted stickers gently bobbing around it
function Stickers({ hero, stickers }) {
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]));
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, []);
  const SPOTS = [
    { left: 6, top: 8, rot: '-12deg', dir: 1 },
    { right: 6, top: 0, rot: '10deg', dir: -1 },
    { left: 18, bottom: 4, rot: '8deg', dir: -1 },
    { right: 18, bottom: 12, rot: '-8deg', dir: 1 },
  ];
  return (
    <View style={styles.cluster}>
      <Animated.View style={[styles.halo, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }) }]} />
      <View style={styles.heroBubble}>
        <Text style={styles.heroEmoji}>{hero}</Text>
      </View>
      {stickers.map((e, i) => (
        <Animated.View
          key={i}
          style={[
            styles.sticker,
            SPOTS[i],
            { transform: [{ rotate: SPOTS[i].rot }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 8 * SPOTS[i].dir] }) }] },
          ]}
        >
          <Text style={styles.stickerEmoji}>{e}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

export default function WelcomeScreen({ onGuest, onSignIn }) {
  const { width } = Dimensions.get('window');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const x = useRef(new Animated.Value(0)).current;
  const last = page === SLIDES.length - 1;

  const next = () => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    if (last) return;
    setPage(page + 1);
    ref.current && ref.current.scrollTo({ x: (page + 1) * width, animated: true });
  };

  const go = async () => {
    setBusy(true);
    try {
      await onGuest();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <NightSky height={420} />
      <View style={styles.topRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>⚡ {SLIDES[page].kicker}</Text>
        </View>
        <TouchableOpacity onPress={onSignIn} hitSlop={10}>
          <Text style={styles.skipText}>I have an account</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
          useNativeDriver: false,
          listener: (e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / width);
            if (p !== page && p >= 0 && p < SLIDES.length) setPage(p);
          },
        })}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <Stickers hero={s.hero} stickers={s.stickers} />
            <View style={styles.headline}>
              {s.lines.map((l, k) => (
                <Text key={l} style={[styles.line, k === s.lines.length - 1 && styles.lineGold]}>{l}</Text>
              ))}
            </View>
            <Text style={styles.body}>{s.body}</Text>
            <View style={styles.chips}>
              {s.chips.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const w = x.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [8, 24, 8], extrapolate: 'clamp' });
            const o = x.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { width: w, opacity: o }]} />;
          })}
        </View>
        <TouchableOpacity style={styles.button} onPress={last ? go : next} disabled={busy} activeOpacity={0.85}>
          <LinearGradient colors={G.hot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{last ? "Let's go — start the night →" : 'Next →'}</Text>}
        </TouchableOpacity>
        <Text style={styles.note}>{last ? 'No sign-up needed. Save your account later.' : ' '}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 58, paddingHorizontal: 22 },
  pill: { borderWidth: 1, borderColor: C.accentSoft + '66', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  pillText: { color: C.accentSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  skipText: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },
  slide: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  cluster: { height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  halo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: C.accent },
  heroBubble: { width: 116, height: 116, borderRadius: 58, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 60 },
  sticker: { position: 'absolute', width: 58, height: 58, borderRadius: 18, backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stickerEmoji: { fontSize: 28 },
  headline: { marginTop: 4 },
  line: { fontFamily: F.display, color: C.text, fontSize: 42, lineHeight: 50 },
  lineGold: { fontFamily: F.italic, color: C.accentSoft },
  body: { color: C.sub, fontSize: 15, lineHeight: 22, marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 11, marginRight: 8, marginBottom: 8 },
  chipText: { color: C.text, fontSize: 12, fontWeight: '600' },
  bottom: { paddingHorizontal: 22, paddingBottom: 36 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 18 },
  dot: { height: 8, borderRadius: 4, backgroundColor: C.accentSoft, marginHorizontal: 4 },
  button: { backgroundColor: C.accent, padding: 17, borderRadius: 18, alignItems: 'center', overflow: 'hidden' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  note: { color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 12 },
});
