import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BRAND, F } from '../services/theme';

// 💡 Opening moment: a neon sign that switches on letter by letter, with a buzz + hum.
// Plays once at app start (about 3 s), tap anywhere to skip. Sound follows the phone's silent switch.
const PINK = '#FF2BD6';
const BLUE = '#4D6BFF';
const LETTER_AT = [350, 550, 750, 1220, 1450, 1600, 1750]; // ms, the sound file uses the same timings
const FRAME_AT = 2000;
const DONE_AT = 2900;

// expo-audio is optional: an older build without it still opens fine, just silently
let Audio = null;
try {
  Audio = require('expo-audio');
} catch (e) {}

export default function Splash({ onDone }) {
  const { width } = useWindowDimensions();
  const word = BRAND.upper;
  const [lit, setLit] = useState(() => word.split('').map(() => false));
  const [frame, setFrame] = useState(false);
  const tag = useRef(new Animated.Value(0)).current;
  const smoke = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone && onDone();
  };

  useEffect(() => {
    const timers = [];
    const on = (i, v) => setLit((l) => l.map((x, j) => (j === i ? v : x)));
    word.split('').forEach((_, i) => {
      const at = LETTER_AT[Math.min(i, LETTER_AT.length - 1)] + Math.max(0, i - LETTER_AT.length + 1) * 150;
      // the 4th letter flickers before it catches, like a real tube
      if (i === 3) {
        timers.push(setTimeout(() => on(i, true), 950));
        timers.push(setTimeout(() => on(i, false), 1010));
        timers.push(setTimeout(() => on(i, true), 1050));
        timers.push(setTimeout(() => on(i, false), 1120));
      }
      timers.push(setTimeout(() => on(i, true), at));
    });
    timers.push(setTimeout(() => setFrame(true), FRAME_AT));
    timers.push(setTimeout(() => setFrame(false), FRAME_AT + 60));
    timers.push(setTimeout(() => setFrame(true), FRAME_AT + 110));
    timers.push(setTimeout(() => Animated.timing(tag, { toValue: 1, duration: 500, useNativeDriver: true }).start(), FRAME_AT + 200));
    timers.push(setTimeout(finish, DONE_AT));
    Animated.loop(Animated.timing(smoke, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })).start();

    let player = null;
    try {
      if (Audio) {
        player = Audio.createAudioPlayer(require('../assets/sounds/neon-on.m4a'));
        let started = false;
        const start = () => {
          if (started) return;
          started = true;
          try { player.play(); } catch (e) {}
        };
        if (player.isLoaded) start();
        const sub = player.addListener('playbackStatusUpdate', (st) => st && st.isLoaded && start());
        timers.push(setTimeout(start, 400)); // fallback if no status event comes
        timers.push(setTimeout(() => { try { sub && sub.remove(); } catch (e) {} }, DONE_AT));
      }
    } catch (e) {}

    return () => {
      timers.forEach(clearTimeout);
      try {
        player && player.remove();
      } catch (e) {}
    };
  }, []);

  const size = Math.min(54, (width - 90) / (word.length * 0.74));
  const Sign = ({ mirror }) => (
    <View style={[styles.halo, frame && styles.haloLit, mirror && styles.mirror]}>
    <View style={[styles.frame, { borderColor: frame ? '#8FA2FF' : 'rgba(77,107,255,0.22)' }, frame && styles.frameLit]}>
      <View style={styles.row}>
        {word.split('').map((ch, i) => (
          <View key={i}>
            {lit[i] && <Text style={[styles.letter, styles.glowWide, { fontSize: size }]}>{ch}</Text>}
            {lit[i] && <Text style={[styles.letter, styles.glowMid, { fontSize: size }]}>{ch}</Text>}
            <Text style={[styles.letter, { fontSize: size }, lit[i] ? styles.on : styles.off]}>{ch}</Text>
          </View>
        ))}
      </View>
    </View>
    </View>
  );

  const drift = smoke.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 24, 0] });

  return (
    <Pressable style={styles.page} onPress={finish}>
      <Animated.View style={[styles.smoke, { left: -60, transform: [{ translateX: drift }] }]} />
      <Animated.View style={[styles.smoke, { right: -80, bottom: '30%', transform: [{ translateX: Animated.multiply(drift, -1) }] }]} />

      <Sign />
      {/* floor reflection */}
      <View style={styles.reflection} pointerEvents="none">
        <Sign mirror />
      </View>

      <Animated.Text style={[styles.tagline, { opacity: tag }]}>{BRAND.tagline}</Animated.Text>
      <Text style={styles.skip}>tap to skip</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#05040A', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  smoke: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(160,140,200,0.06)', bottom: '18%' },
  frame: { borderWidth: 2.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  frameLit: { shadowColor: BLUE, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, backgroundColor: 'rgba(77,107,255,0.06)' },
  row: { flexDirection: 'row' },
  letter: { fontWeight: '600', letterSpacing: 3, marginHorizontal: 1 },
  glowWide: { position: 'absolute', color: PINK, opacity: 0.9, textShadowColor: PINK, textShadowRadius: 28, textShadowOffset: { width: 0, height: 0 } },
  glowMid: { position: 'absolute', color: PINK, textShadowColor: '#FF5CE1', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
  on: { color: '#FFF0FB', textShadowColor: '#FF8BEA', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  off: { color: 'rgba(255,120,220,0.16)' },
  halo: { borderRadius: 18, padding: 3, borderWidth: 3, borderColor: 'transparent' },
  haloLit: { borderColor: 'rgba(77,107,255,0.35)', shadowColor: BLUE, shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  mirror: { transform: [{ scaleY: -1 }] },
  reflection: { marginTop: 6, opacity: 0.18, height: 46, overflow: 'hidden', justifyContent: 'flex-start' },
  tagline: { fontFamily: F.pixel, color: '#E8E8F0', fontSize: 12, letterSpacing: 5, marginTop: 26 },
  skip: { position: 'absolute', bottom: 60, fontFamily: F.pixel, color: 'rgba(232,232,240,0.45)', fontSize: 10, letterSpacing: 2 },
});
