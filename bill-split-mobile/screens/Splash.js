import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BRAND, F } from '../services/theme';

// 💡 Opening moment: a neon sign that switches on letter by letter, with a buzz + hum.
// Plays once at app start (about 3 s), tap anywhere to skip. Sound follows the phone's silent switch.
// Smooth on a busy start: every blink runs on the phone's UI thread (native driver), and the
// light show waits for the sound to be ready (max 0.5 s) so they stay in sync.
const PINK = '#FF2BD6';
const BLUE = '#4D6BFF';
const LETTER_AT = [350, 550, 750, 1220, 1450, 1600, 1750]; // ms, the sound file uses the same timings
const FRAME_AT = 2000;
const DONE_AT = 4300; // the lit name stays on screen ~2 s before moving on
const SOUND_WAIT = 1200;

// expo-audio is optional: an older build without it still opens fine, just silently
let Audio = null;
try {
  Audio = require('expo-audio');
} catch (e) {}

// 🔊 Load the sound as soon as the app's code starts (not when this screen appears),
// so it's ready the moment the sign lights up
let preloaded = null;
try {
  if (Audio) preloaded = Audio.createAudioPlayer(require('../assets/sounds/neon-on.m4a'));
} catch (e) {}

const step = (v, to, ms) => Animated.timing(v, { toValue: to, duration: ms, useNativeDriver: true });

export default function Splash({ onDone }) {
  const { width } = useWindowDimensions();
  const word = BRAND.upper;
  const letters = useRef(word.split('').map(() => new Animated.Value(0))).current;
  const frame = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const smoke = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone && onDone();
  };

  useEffect(() => {
    let doneTimer = null;
    let started = false;
    let player = preloaded;
    preloaded = null; // played once per app start
    let sub = null;

    const show = (withSound) => {
      if (started) return;
      started = true;
      // only play if it can start right now with the lights: a late sound is worse than none
      try { if (withSound && player) { player.seekTo(0); player.play(); } } catch (e) {}
      const lights = letters.map((v, i) => {
        const at = LETTER_AT[Math.min(i, LETTER_AT.length - 1)] + Math.max(0, i - LETTER_AT.length + 1) * 150;
        if (i === 3) {
          // the 4th tube flickers before it catches
          return Animated.sequence([
            Animated.delay(950), step(v, 1, 0), Animated.delay(60), step(v, 0, 0), Animated.delay(40),
            step(v, 1, 0), Animated.delay(70), step(v, 0, 0), Animated.delay(at - 1120), step(v, 1, 40),
          ]);
        }
        return Animated.sequence([Animated.delay(at), step(v, 1, 40)]);
      });
      Animated.parallel([
        ...lights,
        Animated.sequence([Animated.delay(FRAME_AT), step(frame, 1, 0), Animated.delay(60), step(frame, 0, 0), Animated.delay(50), step(frame, 1, 60)]),
        Animated.sequence([Animated.delay(FRAME_AT + 200), step(tag, 1, 500)]),
      ]).start();
      doneTimer = setTimeout(finish, DONE_AT);
    };

    try {
      if (player) {
        if (player.isLoaded) show(true);
        else sub = player.addListener('playbackStatusUpdate', (st) => st && st.isLoaded && show(true));
      }
    } catch (e) {}
    const fallback = setTimeout(() => show(false), player ? SOUND_WAIT : 0); // sound not ready in time → lights only

    Animated.loop(Animated.timing(smoke, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })).start();

    return () => {
      clearTimeout(fallback);
      clearTimeout(doneTimer);
      try { sub && sub.remove(); } catch (e) {}
      try { player && player.remove(); } catch (e) {}
    };
  }, []);

  const size = Math.min(54, (width - 90) / (word.length * 0.74));
  const drift = smoke.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 24, 0] });

  const sign = (mirror) => (
    <View style={mirror && styles.mirror}>
      {/* lit frame fades over the dark one */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.haloLit, { opacity: frame }]} />
      <View style={styles.halo}>
        <View style={[styles.frame, { borderColor: 'rgba(77,107,255,0.22)' }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.frameLit, { opacity: frame }]} />
          <View style={styles.row}>
            {word.split('').map((ch, i) => (
              <View key={i}>
                <Text style={[styles.letter, styles.off, { fontSize: size }]}>{ch}</Text>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: letters[i] }]}>
                  <Text style={[styles.letter, styles.glowWide, { fontSize: size }]}>{ch}</Text>
                  <Text style={[styles.letter, styles.glowMid, { fontSize: size }]}>{ch}</Text>
                  <Text style={[styles.letter, styles.on, { fontSize: size }]}>{ch}</Text>
                </Animated.View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Pressable style={styles.page} onPress={finish}>
      <Animated.View style={[styles.smoke, { left: -60, transform: [{ translateX: drift }] }]} />
      <Animated.View style={[styles.smoke, { right: -80, bottom: '30%', transform: [{ translateX: Animated.multiply(drift, -1) }] }]} />

      {sign(false)}
      {/* floor reflection */}
      <View style={styles.reflection} pointerEvents="none">
        {sign(true)}
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
  frameLit: { borderRadius: 14, borderWidth: 2.5, borderColor: '#8FA2FF', shadowColor: BLUE, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, backgroundColor: 'rgba(77,107,255,0.06)' },
  row: { flexDirection: 'row' },
  letter: { fontWeight: '600', letterSpacing: 3, marginHorizontal: 1 },
  glowWide: { position: 'absolute', color: PINK, opacity: 0.9, textShadowColor: PINK, textShadowRadius: 28, textShadowOffset: { width: 0, height: 0 } },
  glowMid: { position: 'absolute', color: PINK, textShadowColor: '#FF5CE1', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
  on: { color: '#FFF0FB', textShadowColor: '#FF8BEA', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  off: { color: 'rgba(255,120,220,0.16)' },
  halo: { borderRadius: 18, padding: 3, borderWidth: 3, borderColor: 'transparent' },
  haloLit: { borderRadius: 18, borderWidth: 3, borderColor: 'rgba(77,107,255,0.35)', shadowColor: BLUE, shadowOpacity: 0.9, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  mirror: { transform: [{ scaleY: -1 }] },
  reflection: { marginTop: 6, opacity: 0.18, height: 46, overflow: 'hidden', justifyContent: 'flex-start' },
  tagline: { fontFamily: F.pixel, color: '#E8E8F0', fontSize: 12, letterSpacing: 5, marginTop: 26 },
  skip: { position: 'absolute', bottom: 60, fontFamily: F.pixel, color: 'rgba(232,232,240,0.45)', fontSize: 10, letterSpacing: 2 },
});
