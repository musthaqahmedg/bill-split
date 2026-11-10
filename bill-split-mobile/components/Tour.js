import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { C, F } from '../services/theme';

// 🧭 First-time guided tour: a few quick tips that spotlight the main buttons. Skip anytime, replay from Menu.
const KEY = 'vo_tour_done_v1'; // only new users see the tour
export const tourDone = async () => {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'yes';
  } catch (e) {
    return true;
  }
};
export const resetTour = () => AsyncStorage.removeItem(KEY).catch(() => {});
const finish = () => AsyncStorage.setItem(KEY, 'yes').catch(() => {});

// tab: which bottom tab to spotlight (0–4), or null for a centred card
const STEPS = [
  { tab: null, emoji: '👋', title: 'Welcome to VibeOut', body: 'A 20-second tour of where everything lives.' },
  { tab: null, emoji: '🧾', title: 'Quick buttons', body: 'On Tonight: split a bill, get a ride home, invite friends or check your budget in one tap.' },
  { tab: 1, emoji: '🧭', title: 'Discover', body: 'Cafés, clubs, rooftops and big events near you.' },
  { tab: 2, emoji: '👥', title: 'Squad', body: 'Your rooms: plan a night with friends, vote on the place, chat and split.' },
  { tab: 3, emoji: '🪩', title: 'Night', body: 'On the night: squad radar, bill so far, and get home safe.' },
  { tab: 4, emoji: '👤', title: 'Me', body: 'Your budget, spends and memories. Only you see your money.' },
  { tab: null, emoji: '🗂️', title: 'Everything else', body: 'Friends, groups, memories, alerts, help and this tour all live in the Me tab.' },
];

export default function Tour({ visible, onDone }) {
  const [i, setI] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setI(0);
  }, [visible]);
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);

  if (!visible) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  const { width: W, height: H } = Dimensions.get('window');
  const bottom = Math.max((initialWindowMetrics && initialWindowMetrics.insets.bottom) || 0, Platform.OS === 'ios' ? 20 : 10);
  // tab bar: 5 equal slots; the camera button sits a little higher
  const ringX = s.tab === null ? null : (W / 5) * (s.tab + 0.5);
  const ringY = s.tab === null ? null : H - bottom - 26;
  const close = () => {
    finish();
    onDone();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.dim}>
        {ringX !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { left: ringX - 36, top: ringY - 36, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }]}
          />
        ) : null}
        <View style={[styles.card, ringY ? { position: 'absolute', left: 20, right: 20, bottom: H - ringY + 60 } : null]}>
          <Text style={styles.step}>TIP {i + 1} OF {STEPS.length}</Text>
          <Text style={styles.emoji}>{s.emoji}</Text>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.body}>{s.body}</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Text style={styles.skip}>{last ? '' : 'Skip'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.next} onPress={() => (last ? close() : setI(i + 1))} activeOpacity={0.85}>
              <Text style={styles.nextText}>{last ? "LET'S GO 🤟" : i === 0 ? 'START →' : 'NEXT →'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dots}>
            {STEPS.map((_, k) => (
              <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(8,8,12,0.82)', justifyContent: 'center', paddingHorizontal: 20 },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: C.lime, backgroundColor: 'rgba(226,255,59,0.12)' },
  card: { backgroundColor: C.card, borderRadius: 24, padding: 20, borderWidth: 2, borderColor: C.lime, borderRightWidth: 4, borderBottomWidth: 5 },
  step: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  emoji: { fontSize: 40, marginTop: 10 },
  title: { fontFamily: F.display, color: C.text, fontSize: 22, marginTop: 6 },
  body: { color: C.sub, fontSize: 15, lineHeight: 21, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  skip: { color: C.sub, fontSize: 15, fontWeight: '700' },
  next: { backgroundColor: C.lime, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20 },
  nextText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border, marginHorizontal: 3 },
  dotOn: { width: 18, backgroundColor: C.lime },
});
