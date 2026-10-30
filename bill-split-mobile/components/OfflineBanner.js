import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { C, F } from '../services/theme';

// 📴 No internet? A small banner at the top instead of confusing errors.
// Checks our server every 15 s (and when the app comes back to the front). No extra permissions, no native module.
const URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function online() {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctrl && ctrl.abort(), 6000);
  try {
    await fetch(URL, { headers: { apikey: KEY }, signal: ctrl ? ctrl.signal : undefined });
    return true; // any answer from the server means we're connected
  } catch (e) {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function OfflineBanner() {
  const [off, setOff] = useState(false);
  const misses = useRef(0);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ok = await online();
      if (!alive) return;
      misses.current = ok ? 0 : misses.current + 1;
      setOff(misses.current >= 2); // two misses in a row, so one slow request doesn't flash the banner
    };
    check();
    const t = setInterval(check, 15000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      alive = false;
      clearInterval(t);
      sub.remove();
    };
  }, []);
  if (!off) return null;
  const top = Math.max((initialWindowMetrics && initialWindowMetrics.insets.top) || 0, Platform.OS === 'ios' ? 44 : 24);
  return (
    <View pointerEvents="none" style={[styles.bar, { paddingTop: top + 6 }]}>
      <Text style={styles.text}>📴 YOU'RE OFFLINE · CHANGES WON'T SAVE TILL YOU'RE BACK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999, backgroundColor: C.pink, paddingBottom: 8, paddingHorizontal: 12, alignItems: 'center' },
  text: { fontFamily: F.pixel, color: C.onLime, fontSize: 10, textAlign: 'center' },
});
