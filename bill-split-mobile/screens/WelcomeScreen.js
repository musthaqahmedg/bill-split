import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// 👋 First open: 3 simple slides, then jump straight in as a guest (no sign-up needed to try)
const SLIDES = [
  {
    emoji: '🌙',
    kicker: 'Where the night comes alive',
    title: 'The whole night,\nsorted.',
    body: 'Plan it with your crew, live it in Night Mode, split the bill and get everyone home safe. All in one app.',
    chips: ['🎉 Plan', '🪩 Night Mode', '🧾 Split', '🏠 Home safe'],
  },
  {
    emoji: '🧾',
    kicker: 'No awkward maths',
    title: 'Pay for what\nyou had.',
    body: 'Snap the bill. Everyone taps their items. Tax and service are shared fairly, to the rupee.',
    chips: ['📸 Scan', '👆 Tap your items', '💸 Settle up'],
  },
  {
    emoji: '🔒',
    kicker: 'Private by design',
    title: 'Your night,\nyour data.',
    body: 'Try it without signing up. We never sync your contacts, never hold your money, and you can delete everything anytime.',
    chips: ['🙅 No contact sync', '💳 No wallet', '🗑️ Delete anytime'],
  },
];

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
      <TouchableOpacity style={styles.skip} onPress={onSignIn} hitSlop={10}>
        <Text style={styles.skipText}>I have an account</Text>
      </TouchableOpacity>

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
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.bubble}>
              <Text style={styles.emoji}>{s.emoji}</Text>
            </View>
            <Text style={styles.kicker}>{s.kicker}</Text>
            <Text style={styles.title}>{s.title}</Text>
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
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{last ? "Let's go 🚀" : 'Next'}</Text>}
        </TouchableOpacity>
        <Text style={styles.note}>{last ? 'No sign-up needed. Save your account later.' : ' '}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  skip: { position: 'absolute', top: 60, right: 22, zIndex: 2 },
  skipText: { color: C.accentSoft, fontSize: 15, fontWeight: '600' },
  slide: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 40 },
  bubble: { width: 96, height: 96, borderRadius: 30, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  emoji: { fontSize: 50 },
  kicker: { color: C.accentSoft, fontSize: 15, fontWeight: '700' },
  title: { color: C.text, fontSize: 40, fontWeight: '800', lineHeight: 46, marginTop: 8 },
  body: { color: C.sub, fontSize: 16, lineHeight: 24, marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22 },
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
  bottom: { paddingHorizontal: 24, paddingBottom: 40 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 22 },
  dot: { height: 8, borderRadius: 4, backgroundColor: C.accent, marginHorizontal: 4 },
  button: { backgroundColor: C.accent, padding: 17, borderRadius: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  note: { color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 12 },
});
