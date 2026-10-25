import { StyleSheet, View } from 'react-native';
import { G } from '../services/theme';
import { LinearGradient } from './SafeGradient';

// 🌃 v12 backdrop: purple night sky fading to black, with a city skyline and a few lit windows.
// Put it first inside a screen; it sits behind everything and never takes taps.
const BUILDINGS = [
  [0, 46, 34], [32, 70, 26], [56, 38, 30], [84, 92, 22], [104, 58, 34], [136, 120, 26], [160, 64, 30],
  [188, 84, 24], [210, 44, 36], [244, 104, 28], [270, 62, 30], [298, 136, 22], [318, 74, 34], [350, 52, 30],
  [378, 96, 26], [402, 58, 40],
];
const LIT = ['#F2CD8B', '#F0469E', '#D9B8FF'];

export default function NightSky({ height = 300, skyline = true }) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <LinearGradient colors={G.sky} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.glow} />
      {skyline ? (
        <View style={styles.city}>
          {BUILDINGS.map(([left, h, w], i) => (
            <View key={i} style={[styles.building, { left, height: h, width: w }]}>
              {i % 3 === 0 ? <View style={[styles.window, { top: 10, left: 6, backgroundColor: LIT[i % 3] }]} /> : null}
              {i % 4 === 1 ? <View style={[styles.window, { top: 24, left: w - 12, backgroundColor: LIT[(i + 1) % 3] }]} /> : null}
              {h > 80 ? <View style={[styles.window, { top: 40, left: 8, backgroundColor: LIT[(i + 2) % 3] }]} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  glow: { position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: '#E23CA8', opacity: 0.14 },
  city: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140, opacity: 0.55 },
  building: { position: 'absolute', bottom: 0, backgroundColor: '#140A26', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  window: { position: 'absolute', width: 4, height: 5, borderRadius: 1, opacity: 0.8 },
});
