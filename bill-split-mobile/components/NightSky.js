import { StyleSheet, View } from 'react-native';
import { G } from '../services/theme';
import { LinearGradient } from './SafeGradient';

// ✨ Soft neon glow behind a screen's header (Final UX). Put it first inside a screen;
// it sits behind everything and never takes taps.
export default function NightSky({ height = 300 }) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <LinearGradient colors={G.sky} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
