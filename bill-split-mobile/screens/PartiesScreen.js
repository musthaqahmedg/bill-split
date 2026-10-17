import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listParties } from '../services/parties';
import { kindOf } from '../services/partyKinds';
import { show } from '../services/names';
import StreakCard from './StreakCard';
import { C } from '../services/theme';

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const LINES = [
  'No more bill fights. Just vibes ✨',
  'Plan it. Split it. Party 🎉',
  'Who brings the speaker? 🔊',
  'Main character energy only 😎',
  'Snacks first, chaos later 🍗',
];

// One plan card: neon colour per plan type, slides in when the list opens
function PlanCard({ item, index, onPress }) {
  const k = kindOf(item.kind);
  const color = k.color || C.accent;
  const members = item.party_members || [];
  const owing = members.filter((m) => m.name !== 'Me' && Number(m.share) > 0);
  const paid = owing.filter((m) => m.paid_at).length;
  const going = members.filter((m) => m.rsvp === 'in' || m.name === 'Me').length;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 450, delay: Math.min(index, 8) * 70, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, []);

  const status =
    item.split_mode === 'treat'
      ? 'Treat 🎁'
      : item.split_mode === 'free'
      ? 'Free 🎉'
      : owing.length
      ? paid === owing.length
        ? 'All paid ✅'
        : `${paid}/${owing.length} paid`
      : 'Planning';

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
      }}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, { borderColor: color + '88', shadowColor: color, backgroundColor: color + '1F' }]}>
        <View style={[styles.stripe, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.emojiBubble, { backgroundColor: color + '33', borderColor: color }]}>
              <Text style={styles.emoji}>{k.emoji}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.kind, { color }]}>{k.label.toUpperCase()}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            </View>
            {Number(item.budget) > 0 ? <Text style={[styles.money, { color }]}>{inr(item.budget)}</Text> : null}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>📅 {item.party_date || 'No date yet'}</Text>
            {item.place ? <Text style={[styles.meta, styles.flex]} numberOfLines={1}>   📍 {item.place.replace(/^My place 🏠 · /, '🏠 ')}</Text> : null}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.avatars}>
              {members.slice(0, 5).map((m, i) => (
                <View key={m.id} style={[styles.avatar, { marginLeft: i ? -8 : 0, backgroundColor: i % 2 ? color : C.cardHi, borderColor: C.bg }]}>
                  <Text style={styles.avatarText}>{(show(m.name) || '?')[0].toUpperCase()}</Text>
                </View>
              ))}
              {members.length > 5 ? <Text style={styles.more}>+{members.length - 5}</Text> : null}
              <Text style={styles.going}>{going} going</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: color }]}>
              <Text style={styles.pillText}>{status}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PartiesScreen({ onBack, onNewParty, onOpenParty, onGroups, onNearby }) {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [line, setLine] = useState(0);
  const wobble = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setTick((t) => t + 1);
    try {
      setParties(await listParties());
    } catch (e) {
      console.log('Could not load parties:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 🎉 wiggles, fun line changes, button glows
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -1, duration: 300, useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(1800),
    ]));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]));
    a.start();
    b.start();
    const t = setInterval(() => setLine((x) => (x + 1) % LINES.length), 3500);
    return () => { a.stop(); b.stop(); clearInterval(t); };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.topBtns}>
          <TouchableOpacity style={styles.topBtn} onPress={onNearby}>
            <Text style={styles.topBtnText}>📍 Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.topBtn, styles.gap]} onPress={onGroups}>
            <Text style={styles.topBtnText}>👥 Groups</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Plans</Text>
        <Animated.Text style={[styles.titleEmoji, { transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) }] }]}>🎉</Animated.Text>
      </View>
      <Text style={styles.sub}>{LINES[line]}</Text>

      <FlatList
        data={parties}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <PlanCard item={item} index={index} onPress={() => onOpenParty(item.id)} />}
        ListHeaderComponent={<StreakCard refreshKey={tick} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🪩</Text>
              <Text style={styles.emptyText}>No plans yet</Text>
              <Text style={styles.emptySub}>Parties, trips, movies, weddings. Start one and invite the gang 👇</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listPad}
      />

      <Animated.View pointerEvents="none" style={[styles.buttonGlow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }) }]} />
      <TouchableOpacity style={styles.button} onPress={onNewParty} activeOpacity={0.85}>
        <Text style={styles.buttonText}>✨ Plan something</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 18 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 16, fontWeight: '700' },
  topBtns: { flexDirection: 'row' },
  topBtn: { backgroundColor: C.cardHi, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  topBtnText: { color: C.text, fontSize: 13, fontWeight: '800' },
  gap: { marginLeft: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  title: { fontSize: 40, fontWeight: '900', color: C.text, letterSpacing: -1 },
  titleEmoji: { fontSize: 34, marginLeft: 8 },
  sub: { color: C.pink, fontSize: 14, fontWeight: '700', marginTop: 2, marginBottom: 14 },
  listPad: { paddingBottom: 110 },
  card: {
    flexDirection: 'row', borderWidth: 1.5, borderRadius: 22, marginBottom: 14, overflow: 'hidden',
    shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  stripe: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  emojiBubble: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginRight: 12 },
  emoji: { fontSize: 26 },
  flex: { flex: 1 },
  kind: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  cardTitle: { fontSize: 19, fontWeight: '900', color: C.text, marginTop: 1 },
  money: { fontSize: 17, fontWeight: '900', marginLeft: 8 },
  metaRow: { flexDirection: 'row', marginTop: 12 },
  meta: { color: C.sub, fontSize: 13, fontWeight: '600' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  more: { color: C.sub, fontSize: 12, fontWeight: '800', marginLeft: 6 },
  going: { color: C.sub, fontSize: 12, fontWeight: '700', marginLeft: 8 },
  pill: { borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  pillText: { color: '#160A2B', fontSize: 12, fontWeight: '900' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 64 },
  emptyText: { fontSize: 22, fontWeight: '900', color: C.text, marginTop: 8 },
  emptySub: { fontSize: 14, color: C.sub, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  buttonGlow: { position: 'absolute', left: 30, right: 30, bottom: 30, height: 56, borderRadius: 20, backgroundColor: C.pink, shadowColor: C.pink, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
  button: { position: 'absolute', left: 18, right: 18, bottom: 30, backgroundColor: C.accent, padding: 18, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: C.pink },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
});
