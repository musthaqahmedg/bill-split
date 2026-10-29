import { StyleSheet, View } from 'react-native';
import { G } from '../services/theme';
import { LinearGradient } from './SafeGradient';

// ✨ Soft neon glow behind a screen's header (Final UX). Put it first inside a screen;
// it sits behind everything and never takes taps.
export default function NightSky({ height = 300 }) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <LinearGradient colors={G.sky} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.circle} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  // 🟣 v14: the big plum circle in the top-right corner
  circle: { position: 'absolute', top: -90, right: -150, width: 360, height: 360, borderRadius: 180, backgroundColor: '#4A1640', opacity: 0.9 },
});
