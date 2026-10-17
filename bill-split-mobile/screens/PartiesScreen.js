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
    Animated.timing(anim, { toValue: 1, duration: 320, delay: Math.min(index, 8) * 45, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.card}>
        <View style={[styles.icon, { backgroundColor: color + '26' }]}>
          <Text style={styles.emoji}>{k.emoji}</Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {Number(item.budget) > 0 ? <Text style={styles.money}>{inr(item.budget)}</Text> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.party_date || 'No date', item.place ? item.place.replace(/^My place 🏠 · .*/, 'My place') : null].filter(Boolean).join('  ·  ')}
          </Text>
          <View style={styles.rowBottom}>
            <View style={styles.avatars}>
              {members.slice(0, 4).map((m, i) => (
                <View key={m.id || i} style={[styles.avatar, { marginLeft: i ? -6 : 0 }]}>
                  <Text style={styles.avatarText}>{(show(m.name) || '?')[0].toUpperCase()}</Text>
                </View>
              ))}
              <Text style={styles.going}>{going} going</Text>
            </View>
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PartiesScreen({ onBack, onNewParty, onOpenParty, onGroups, onNearby }) {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [line, setLine] = useState(0);
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

  useEffect(() => {
    const t = setInterval(() => setLine((x) => (x + 1) % LINES.length), 4000);
    return () => clearInterval(t);
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
        <TouchableOpacity style={styles.newBtn} onPress={onNewParty} activeOpacity={0.8}>
          <Text style={styles.newText}>＋ New</Text>
        </TouchableOpacity>
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
              <Text style={styles.emptySub}>Parties, trips, movies, weddings. Start one and invite the gang.</Text>
              <TouchableOpacity style={[styles.newBtn, styles.emptyBtn]} onPress={onNewParty}>
                <Text style={styles.newText}>＋ Plan something</Text>
              </TouchableOpacity>
            </View>
          )
        }
        contentContainerStyle={styles.listPad}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 16 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 17, fontWeight: '400' },
  topBtns: { flexDirection: 'row' },
  topBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 11 },
  topBtnText: { color: C.text, fontSize: 13, fontWeight: '600' },
  gap: { marginLeft: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  title: { fontSize: 34, fontWeight: '700', color: C.text, letterSpacing: 0.4 },
  newBtn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  newText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sub: { color: C.faint, fontSize: 13, marginTop: 2, marginBottom: 14 },
  listPad: { paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emoji: { fontSize: 22 },
  flex: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.text, marginRight: 8 },
  money: { fontSize: 15, fontWeight: '600', color: C.text },
  meta: { color: C.faint, fontSize: 13, marginTop: 2 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardHi, borderWidth: 1.5, borderColor: C.bg },
  avatarText: { color: C.text, fontSize: 9, fontWeight: '700' },
  going: { color: C.faint, fontSize: 12, marginLeft: 6 },
  status: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { color: C.sub, fontSize: 12, fontWeight: '500' },
  chev: { color: 'rgba(255,255,255,0.3)', fontSize: 22, marginLeft: 8 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 20, fontWeight: '600', color: C.text, marginTop: 8 },
  emptySub: { fontSize: 14, color: C.faint, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  emptyBtn: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10 },
});
