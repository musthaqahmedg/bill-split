import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, F } from '../services/theme';

// 📡 Shown instead of an endless spinner when a screen can't load (offline, server hiccup)
export default function LoadError({ onRetry, onBack, what = 'this' }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>📡</Text>
      <Text style={styles.title}>Couldn't load {what}</Text>
      <Text style={styles.sub}>Check your internet and try again.</Text>
      <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
      {onBack ? (
        <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button">
          <Text style={styles.backText}>‹ Go back</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 48 },
  title: { fontFamily: F.display, color: C.text, fontSize: 22, marginTop: 12, textAlign: 'center' },
  sub: { color: C.sub, fontSize: 15, marginTop: 6, textAlign: 'center' },
  retry: { backgroundColor: C.lime, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, marginTop: 22 },
  retryText: { fontFamily: F.display, color: C.onLime, fontSize: 16 },
  back: { paddingVertical: 14, paddingHorizontal: 20, marginTop: 6 },
  backText: { color: C.sub, fontSize: 15, fontWeight: '700' },
});
