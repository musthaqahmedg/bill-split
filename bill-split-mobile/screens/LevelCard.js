import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LEVELS, levelOf, myXp } from '../services/xp';
import { C } from '../services/theme';

const SEEN = 'vibeout.level';

// ⭐ Your level + XP bar (top of Plans). Tap for how to earn XP.
export default function LevelCard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [levelUp, setLevelUp] = useState(null);
  const fill = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    myXp()
      .then(async (d) => {
        setData(d);
        const lv = levelOf(d.xp);
        Animated.timing(fill, { toValue: lv.progress, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        // 🎉 Level up?
        try {
          const before = Number(await AsyncStorage.getItem(SEEN));
          if (!Number.isNaN(before) && (await AsyncStorage.getItem(SEEN)) !== null && lv.index > before) {
            setLevelUp(lv);
            pop.setValue(0);
            Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
          }
          await AsyncStorage.setItem(SEEN, String(lv.index));
        } catch (e) {}
      })
      .catch(() => {});
  }, [refreshKey]);

  if (!data) return null;
  const lv = levelOf(data.xp);

  return (
    <>
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => setOpen(true)}>
        <Text style={styles.emoji}>{lv.emoji}</Text>
        <View style={styles.flex}>
          <View style={styles.row}>
            <Text style={styles.name}>{lv.name}</Text>
            <Text style={styles.xp}>{data.xp} XP</Text>
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <Text style={styles.sub}>{lv.next ? `${lv.toNext} XP to ${lv.next.emoji} ${lv.next.name}` : 'Max level. Absolute legend 👑'}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.page}>
          <View style={styles.pageTop}>
            <Text style={styles.pageTitle}>{lv.emoji} {lv.name}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.done}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.big}>{data.xp} XP</Text>
            <Text style={styles.section}>LEVELS</Text>
            {LEVELS.map((l, i) => (
              <View key={l.name} style={[styles.level, i === lv.index && styles.levelOn, i > lv.index && styles.locked]}>
                <Text style={styles.levelEmoji}>{l.emoji}</Text>
                <Text style={styles.levelName}>{l.name}</Text>
                <Text style={styles.levelXp}>{i <= lv.index ? '✓' : `${l.xp} XP`}</Text>
              </View>
            ))}
            <Text style={styles.section}>HOW YOU EARNED IT</Text>
            {data.rows.map((r) => (
              <View key={r.label} style={styles.earn}>
                <Text style={styles.earnLabel}>{r.label}</Text>
                <Text style={styles.earnN}>{r.n} × {r.each}</Text>
                <Text style={styles.earnXp}>+{r.n * r.each}</Text>
              </View>
            ))}
            <Text style={styles.note}>XP comes from good party habits only. Drinks never count 💜</Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!levelUp} transparent animationType="fade" onRequestClose={() => setLevelUp(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setLevelUp(null)}>
          {levelUp ? (
            <Animated.View style={[styles.upBox, { transform: [{ scale: pop }] }]}>
              <Text style={styles.upEmoji}>{levelUp.emoji}</Text>
              <Text style={styles.upTitle}>Level up! 🎉</Text>
              <Text style={styles.upName}>You’re now a {levelUp.name}</Text>
              <Text style={styles.upTap}>Tap to continue</Text>
            </Animated.View>
          ) : null}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  emoji: { fontSize: 30, marginRight: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { color: C.text, fontSize: 16, fontWeight: '700' },
  xp: { color: C.amber, fontSize: 13, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: C.amber },
  sub: { color: C.faint, fontSize: 12, marginTop: 5 },
  page: { flex: 1, backgroundColor: C.bg, padding: 20 },
  pageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { color: C.text, fontSize: 26, fontWeight: '700' },
  done: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  big: { color: C.amber, fontSize: 40, fontWeight: '800', marginTop: 10 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 22, marginBottom: 8 },
  level: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  levelOn: { backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: C.amber },
  locked: { opacity: 0.45 },
  levelEmoji: { fontSize: 22, marginRight: 12 },
  levelName: { color: C.text, fontSize: 15, fontWeight: '600', flex: 1 },
  levelXp: { color: C.sub, fontSize: 13 },
  earn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  earnLabel: { color: C.text, fontSize: 14, flex: 1 },
  earnN: { color: C.faint, fontSize: 12, marginRight: 10 },
  earnXp: { color: C.amber, fontSize: 14, fontWeight: '700', width: 52, textAlign: 'right' },
  note: { color: C.faint, fontSize: 12, marginTop: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  upBox: { backgroundColor: C.card, borderRadius: 28, padding: 30, alignItems: 'center', borderWidth: 2, borderColor: C.amber, width: '80%' },
  upEmoji: { fontSize: 80 },
  upTitle: { color: C.amber, fontSize: 28, fontWeight: '800', marginTop: 8 },
  upName: { color: C.text, fontSize: 18, fontWeight: '600', marginTop: 4 },
  upTap: { color: C.faint, fontSize: 12, marginTop: 16 },
});
