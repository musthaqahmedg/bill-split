import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getNights, isSafe, stats } from '../services/safety';
import { C } from '../services/theme';

// 🔥 Your safe-night streak + badges (top of Plans)
export default function StreakCard({ refreshKey }) {
  const [s, setS] = useState(null);
  const [nights, setNights] = useState([]);
  const [open, setOpen] = useState(false);
  const flame = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getNights()
      .then((n) => {
        setNights(n);
        setS(stats(n));
      })
      .catch(() => setS(stats([])));
  }, [refreshKey]);

  // The flame breathes, a bit bigger as the streak grows
  useEffect(() => {
    if (!s || !s.current) return;
    const grow = 1 + Math.min(s.current, 10) * 0.03;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flame, { toValue: grow + 0.12, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flame, { toValue: grow, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [s && s.current]);

  if (!s) return null;

  const explain = () => setOpen(true);

  return (
    <TouchableOpacity style={styles.card} onPress={explain} activeOpacity={0.8}>
      <View style={styles.top}>
        <Animated.Text style={[styles.flame, { transform: [{ scale: flame }] }]}>{s.current ? '🔥' : '🌙'}</Animated.Text>
        <View style={styles.flex}>
          <Text style={styles.big}>{s.current ? `${s.current} safe night${s.current === 1 ? '' : 's'}` : 'Start your streak'}</Text>
          <Text style={styles.sub}>{s.total ? `Best: ${s.best} · tap to see how it works` : 'Tap "I\'m home safe" after a plan · how it works ›'}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        {s.badges.map((b) => (
          <View key={b.id} style={[styles.badge, !b.unlocked && styles.locked]}>
            <Text style={styles.badgeIcon}>{b.icon}</Text>
            <Text style={styles.badgeCount}>{b.unlocked ? '✓' : `${b.have}/${b.count}`}</Text>
          </View>
        ))}
      </View>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.page}>
          <View style={styles.pageTop}>
            <Text style={styles.pageTitle}>🔥 Safe nights</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.close}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statNum}>{s.current}</Text><Text style={styles.statLabel}>Streak now</Text></View>
              <View style={styles.stat}><Text style={styles.statNum}>{s.best}</Text><Text style={styles.statLabel}>Best streak</Text></View>
              <View style={styles.stat}><Text style={styles.statNum}>{s.badges.filter((b) => b.unlocked).length}/{s.badges.length}</Text><Text style={styles.statLabel}>Badges</Text></View>
            </View>

            <Text style={styles.section}>BADGES</Text>
            {s.badges.map((b) => (
              <View key={b.id} style={[styles.badgeRow, b.unlocked && styles.badgeRowOn]}>
                <Text style={[styles.badgeBig, !b.unlocked && styles.locked]}>{b.icon}</Text>
                <View style={styles.flex}>
                  <Text style={styles.badgeName}>{b.name} {b.unlocked ? '✅' : '🔒'}</Text>
                  <Text style={styles.badgeHow}>{b.how}</Text>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${(b.have / b.count) * 100}%` }, b.unlocked && styles.barDone]} />
                  </View>
                  <Text style={styles.badgeHow}>{b.have} of {b.count}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.section}>HOW IT WORKS</Text>
            <Text style={styles.how}>After a plan, open it and tap "🏠 I'm home safe". A night counts 🔥 when you got home safe and either ate first, had water between drinks and stayed within your limit, or it was a sober / mocktail night, or you were the driver.</Text>
            <Text style={styles.how}>Staying in never breaks your streak. Drinks are never counted.</Text>

            <Text style={styles.section}>YOUR NIGHTS</Text>
            {nights.length === 0 && <Text style={styles.how}>No check-ins yet. Your first one starts the streak 🌙</Text>}
            {nights.map((n) => (
              <View key={n.party_id} style={styles.nightRow}>
                <Text style={styles.nightDate}>{n.night_date}</Text>
                <Text style={styles.nightText}>
                  {isSafe(n) ? '🔥 Safe night' : '💜 Home'}{n.sober ? ' · 🧃' : ''}{n.driver ? ' · 🛡️' : ''}{n.water ? ' · 🥤' : ''}{n.ate_first ? ' · 🍗' : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.cardHi, borderRadius: 16, padding: 14, marginBottom: 14 },
  top: { flexDirection: 'row', alignItems: 'center' },
  flame: { fontSize: 34, marginRight: 12 },
  flex: { flex: 1 },
  big: { color: C.text, fontSize: 18, fontWeight: '800' },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  badge: { alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, paddingVertical: 6, width: '18%' },
  locked: { opacity: 0.4 },
  badgeIcon: { fontSize: 20 },
  page: { flex: 1, backgroundColor: C.bg, padding: 20 },
  pageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pageTitle: { color: C.text, fontSize: 26, fontWeight: '800' },
  close: { color: C.accentSoft, fontSize: 16, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, marginHorizontal: 3, alignItems: 'center' },
  statNum: { color: C.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: C.faint, fontSize: 12, marginTop: 2 },
  section: { color: C.faint, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  badgeRowOn: { borderColor: C.green },
  badgeBig: { fontSize: 34, marginRight: 12 },
  badgeName: { color: C.text, fontSize: 16, fontWeight: '800' },
  badgeHow: { color: C.sub, fontSize: 12, marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.bg, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: C.accent },
  barDone: { backgroundColor: C.green },
  how: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  nightRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  nightDate: { color: C.faint, fontSize: 13, width: 95 },
  nightText: { color: C.text, fontSize: 14, flex: 1 },
  badgeCount: { color: C.sub, fontSize: 10, fontWeight: '800', marginTop: 2 },
});
