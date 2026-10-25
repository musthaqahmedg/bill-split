import { LinearGradient } from './SafeGradient';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { C, F, G } from '../services/theme';

// 🌈 Gradient button (Gautham's glossy CTAs). Lime gradient gets dark text automatically.
export function GradButton({ title, onPress, colors = G.hot, style, textStyle, disabled, loading, children }) {
  const dark = colors === G.lime;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={[styles.wrap, disabled && { opacity: 0.45 }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        {loading ? (
          <ActivityIndicator color={dark ? C.onLime : '#fff'} />
        ) : children || <Text style={[styles.text, dark && { color: C.onLime }, textStyle]}>{title}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// 🌈 Gradient card background
export function GradCard({ colors = G.card, style, children }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: 'hidden', shadowColor: '#FF3DA5', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fill: { paddingVertical: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 16, fontFamily: F.bold, letterSpacing: 0.2 },
});
