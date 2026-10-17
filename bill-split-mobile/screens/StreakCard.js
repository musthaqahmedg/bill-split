import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BADGES, getNights, stats } from '../services/safety';
import { C } from '../services/theme';

// 🔥 Your safe-night streak + badges (top of Plans)
export default function StreakCard({ refreshKey }) {
  const [s, setS] = useState(null);
  const flame = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getNights().then((n) => setS(stats(n))).catch(() => setS(stats([])));
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

  const explain = () =>
    Alert.alert(
      '🔥 Safe nights',
      'After a plan, tap "I\'m home safe". A night counts when you got home safe and either:\n\n• ate first, had water between drinks and stayed within your limit, or\n• it was a sober / mocktail night, or you were the driver.\n\nStaying in never breaks your streak. Drinks are never counted.\n\n' +
        BADGES.map((b) => `${b.icon} ${b.name}: ${b.how}`).join('\n')
    );

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
  badgeCount: { color: C.sub, fontSize: 10, fontWeight: '800', marginTop: 2 },
});
