import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Ellipse, Path, Polygon } from 'react-native-svg';
import { BRAND, C, F } from '../services/theme';

// 🎬 First-open story (Gautham's ref): purple "LET'S GO!" → black poster with a lime marquee strip,
// huge VIBE / OUT, pink zigzag + starburst + sticker, "or are you just staying in?". Tap to skip.
const PURPLE = '#8B4DF5';
const PINK = '#E5339B';
const LIME = C.lime || '#C8F94A';

// "VibeOut" → ['VIBE', 'OUT']; a one-word name stays on one line
function splitName(name) {
  const parts = name.match(/[A-Z][a-z]*/g) || [name];
  if (parts.length < 2) return [name.toUpperCase(), ''];
  return [parts.slice(0, -1).join('').toUpperCase(), parts[parts.length - 1].toUpperCase()];
}

function Burst({ size }) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const r = i % 2 === 0 ? size / 2 : size / 4.2;
    const a = (Math.PI * 2 * i) / 24;
    pts.push(`${size / 2 + r * Math.cos(a)},${size / 2 + r * Math.sin(a)}`);
  }
  return (
    <Svg width={size} height={size}>
      <Polygon points={pts.join(' ')} fill={PINK} />
    </Svg>
  );
}

function Zigzag({ height }) {
  let d = 'M 20 0';
  for (let y = 0, i = 0; y < height; y += 14, i++) d += ` L ${i % 2 ? 6 : 34} ${y + 14}`;
  return (
    <Svg width={40} height={height}>
      <Path d={d} stroke={PINK} strokeWidth={4} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export default function IntroStory({ onDone }) {
  const { width } = useWindowDimensions();
  const [scene, setScene] = useState(0); // 0 = LET'S GO!, 1 = poster
  const pop = useRef(new Animated.Value(0)).current;
  const marquee = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const [top, bottom] = splitName(BRAND.name);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone && onDone();
  };

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    const t1 = setTimeout(() => {
      setScene(1);
      Animated.spring(rise, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    }, 1400);
    const t2 = setTimeout(finish, 5200);
    Animated.loop(Animated.timing(marquee, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (scene === 0) {
    return (
      <Pressable style={[styles.page, { backgroundColor: PURPLE }]} onPress={finish}>
        <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: pop }}>
          <Text style={styles.letsGo}>LET'S{'\n'}GO!</Text>
        </Animated.View>
        <Text style={styles.skip}>tap to skip</Text>
      </Pressable>
    );
  }

  const strip = 'PULL UP ✦ LINK UP ✦ VIBE OUT ✦ ';
  const big = Math.min(110, width / (Math.max(top.length, 3) * 0.72));
  const shift = marquee.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const lift = rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const tilt = wobble.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

  return (
    <Pressable style={[styles.page, { backgroundColor: '#08070B', alignItems: 'flex-start' }]} onPress={finish}>
      {/* tilted lime marquee strip */}
      <View style={[styles.strip, { width: width * 1.3 }]}>
        <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: shift }] }}>
          {[0, 1, 2, 3].map((k) => (
            <Text key={k} style={styles.stripText}>{strip}</Text>
          ))}
        </Animated.View>
      </View>

      {/* cyan scribble + pink starburst */}
      <View style={{ position: 'absolute', top: 150, right: 40 }}>
        <Svg width={110} height={50}>
          <Ellipse cx={55} cy={25} rx={50} ry={16} stroke={C.cyan || '#55E0F0'} strokeWidth={2} fill="none" transform="rotate(-12 55 25)" />
          <Ellipse cx={58} cy={24} rx={44} ry={12} stroke={C.cyan || '#55E0F0'} strokeWidth={1.5} fill="none" transform="rotate(-6 58 24)" />
        </Svg>
      </View>
      <Animated.View style={{ position: 'absolute', top: 190, right: 18, transform: [{ rotate: tilt }] }}>
        <Burst size={96} />
      </Animated.View>

      {/* pink zigzag running down through the word */}
      <View style={{ position: 'absolute', top: 120, left: width * 0.5 }}>
        <Zigzag height={260} />
      </View>

      <Animated.View style={{ marginLeft: 22, transform: [{ translateY: lift }], opacity: rise }}>
        <Text style={[styles.big, { color: LIME, fontSize: big }]}>{top}</Text>
        {!!bottom && <Text style={[styles.big, { color: '#FFFFFF', fontSize: big }]}>{bottom}</Text>}
      </Animated.View>

      {/* pink sticker shape */}
      <Animated.View style={[styles.sticker, { left: width * 0.5 - 18, top: '52%', transform: [{ rotate: tilt }] }]}>
        <View style={styles.stickerTop} />
        <View style={styles.stickerNeck} />
        <View style={styles.stickerTop} />
      </Animated.View>

      <View style={styles.question}>
        <Text style={styles.questionText}>or are you just</Text>
        <Text style={styles.questionText}>staying in?</Text>
      </View>
      <Text style={[styles.skip, { alignSelf: 'center' }]}>tap to skip</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  letsGo: { fontFamily: F.display, color: '#FFFFFF', fontSize: 72, lineHeight: 80 },
  skip: { position: 'absolute', bottom: 46, width: '100%', textAlign: 'center', fontFamily: F.pixel, color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 2 },
  strip: { position: 'absolute', top: 90, left: -40, backgroundColor: LIME, paddingVertical: 8, transform: [{ rotate: '-4deg' }], overflow: 'hidden' },
  stripText: { fontFamily: F.display, color: '#08070B', fontSize: 22, letterSpacing: 1 },
  big: { fontFamily: F.display, lineHeight: undefined, letterSpacing: -2 },
  sticker: { position: 'absolute', alignItems: 'center' },
  stickerTop: { width: 76, height: 44, borderRadius: 18, backgroundColor: PINK, borderWidth: 2, borderColor: '#B01F74' },
  stickerNeck: { width: 30, height: 22, backgroundColor: PINK, marginVertical: -4 },
  question: { position: 'absolute', right: 22, bottom: 110, alignItems: 'flex-end' },
  questionText: { fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontStyle: 'italic', color: '#FFFFFF', fontSize: 22, textDecorationLine: 'underline' },
});
