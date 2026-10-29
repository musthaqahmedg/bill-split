import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listParties } from '../services/parties';
import { kindOf } from '../services/partyKinds';
import { show } from '../services/names';
import LevelCard from './LevelCard';
import StreakCard from './StreakCard';
import { C, F } from '../services/theme';
import NightSky from '../components/NightSky';
import { countdown, planBucket, sortPlans } from '../services/when';

const HUES = ['#9B5CFF', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const LINES = [
  'No more bill fights. Just vibes ✨',
  'Plan it. Split it. Party 🎉',
  'Who brings the speaker? 🔊',
  'Main character energy only 😎',
  'Snacks first, chaos later 🍗',
];

// One plan card: neon colour per plan type, slides in when the list opens
function PlanCard({ item, index, onPress, bucket }) {
  const k = kindOf(item.kind);
  const color = k.color || C.accent;
  const members = item.party_members || [];
  const owing = members.filter((m) => m.name !== 'Me' && Number(m.share) > 0);
  const paid = owing.filter((m) => m.paid_at).length;
  const going = members.filter((m) => m.rsvp === 'in' || m.name === 'Me').length;
  const out = members.filter((m) => m.live_status === 'omw' || m.live_status === 'here').length;
  const when = countdown(item);
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
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.card, bucket === 'live' && { borderColor: C.lime }]}>
        <View style={[styles.icon, { backgroundColor: color + '26' }]}>
          <Text style={styles.emoji}>{k.emoji}</Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {Number(item.budget) > 0 ? <Text style={styles.money}>{inr(item.budget)}</Text> : null}
          </View>
          <View style={styles.whenRow}>
            {bucket === 'live' ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{out ? `LIVE · ${out} out` : 'LIVE TONIGHT'}</Text>
              </View>
            ) : (
              <View style={[styles.whenPill, bucket === 'past' && styles.whenPast]}>
                <Text style={[styles.whenText, bucket === 'past' && { color: C.faint }]}>{bucket === 'upcoming' && when !== 'Date TBD' ? '⏳ ' : ''}{when}</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.party_date || 'No date', item.place ? item.place.replace(/^My place 🏠 · .*/, 'My place') : null].filter(Boolean).join('  ·  ')}
          </Text>
          <View style={styles.rowBottom}>
            <View style={styles.avatars}>
              {members.slice(0, 4).map((m, i) => (
                <View key={m.id || i} style={[styles.avatar, { backgroundColor: hue(m.name), marginLeft: i ? -8 : 0 }]}>
                  <Text style={styles.avatarText}>{(show(m.name) || '?')[0].toUpperCase()}</Text>
                </View>
              ))}
              <Text style={styles.going}>{going} going</Text>
            </View>
            <View style={[styles.status, { backgroundColor: color + '22' }]}>
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

export default function PartiesScreen({ onBack, onNewParty, onOpenParty, onGroups, onNearby, onMemories }) {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [line, setLine] = useState(0);
  const [tab, setTab] = useState(null); // live · upcoming · past (picked automatically first time)
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

  const groups = { live: [], upcoming: [], past: [] };
  parties.forEach((p) => groups[planBucket(p)].push(p));
  const current = tab || (groups.live.length ? 'live' : groups.upcoming.length || !groups.past.length ? 'upcoming' : 'past');
  const shown = sortPlans(groups[current], current);
  const TABS = [
    { key: 'live', label: 'Live' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ];
  const EMPTY = {
    live: { e: '🌙', t: 'Nothing live tonight', s: 'When a plan is on today, it shows up here.' },
    upcoming: { e: '🪩', t: 'Nothing coming up', s: 'Parties, trips, movies, weddings. Start one and invite the gang.' },
    past: { e: '🎞️', t: 'No past nights yet', s: 'Your finished plans land here.' },
  }[current];

  return (
    <View style={styles.container}>
      <NightSky height={260} />
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <PlanCard item={item} index={index} bucket={current} onPress={() => onOpenParty(item.id)} />}
        ListHeaderComponent={
          <>
            {onBack ? (
              <TouchableOpacity onPress={onBack}>
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sub}>{LINES[line]}</Text>
                <Text style={styles.title}>Your <Text style={styles.titleItalic}>rooms</Text></Text>
              </View>
            </View>
            <View style={styles.quick}>
              <TouchableOpacity style={styles.quickBtn} onPress={onNewParty} activeOpacity={0.85}>
                <Text style={styles.quickEmoji}>🎉</Text>
                <Text style={[styles.quickText, { color: C.onLime }]}>New plan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickBtn, styles.quickAlt]} onPress={onMemories || onNearby} activeOpacity={0.85}>
                <Text style={styles.quickEmoji}>🧭</Text>
                <Text style={styles.quickText}>Nearby</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickBtn, styles.quickAlt]} onPress={onGroups} activeOpacity={0.85}>
                <Text style={styles.quickEmoji}>👥</Text>
                <Text style={styles.quickText}>Groups</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tabs}>
              {TABS.map((t) => (
                <TouchableOpacity key={t.key} style={[styles.tab, current === t.key && styles.tabOn]} onPress={() => setTab(t.key)} activeOpacity={0.85}>
                  {t.key === 'live' && groups.live.length ? <View style={[styles.liveDot, { marginRight: 6 }]} /> : null}
                  <Text style={[styles.tabText, current === t.key && styles.tabTextOn]}>{t.label}</Text>
                  {groups[t.key].length ? <Text style={[styles.tabCount, current === t.key && styles.tabTextOn]}> {groups[t.key].length}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{EMPTY.e}</Text>
              <Text style={styles.emptyText}>{EMPTY.t}</Text>
              <Text style={styles.emptySub}>{EMPTY.s}</Text>
              {current !== 'past' ? (
                <TouchableOpacity style={styles.emptyBtn} onPress={onNewParty}>
                  <Text style={styles.newText}>＋ Plan something</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          <View style={{ marginTop: 10 }}>
            <LevelCard refreshKey={tick} />
            <StreakCard refreshKey={tick} />
          </View>
        }
        contentContainerStyle={styles.listPad}
        showsVerticalScrollIndicator={false}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listPad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24 },
  back: { color: C.accentSoft, fontSize: 17, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sub: { color: C.sub, fontSize: 15, fontWeight: '500' },
  title: { fontFamily: F.display, fontSize: 28, color: C.text, marginTop: 2 },
  titleItalic: { fontFamily: F.display, color: C.lime },
  tabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 12 },
  tabOn: { backgroundColor: C.lime },
  tabText: { color: C.sub, fontSize: 14, fontWeight: '700' },
  tabTextOn: { color: C.onLime },
  tabCount: { color: C.faint, fontSize: 13, fontWeight: '800' },
  whenRow: { flexDirection: 'row', marginTop: 5 },
  whenPill: { backgroundColor: C.accent + '33', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  whenPast: { backgroundColor: C.cardHi },
  whenText: { color: C.accentSoft, fontSize: 11, fontWeight: '800' },
  livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lime + '22', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.lime, marginRight: 5 },
  liveText: { color: C.lime, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  roundIcon: { fontSize: 19 },
  gap: { marginLeft: 8 },
  quick: { flexDirection: 'row', marginBottom: 14 },
  quickBtn: { flex: 1, backgroundColor: C.lime, borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  quickAlt: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginLeft: 8 },
  quickEmoji: { fontSize: 22 },
  quickText: { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  section: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 6, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emoji: { fontSize: 22 },
  flex: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: C.text, marginRight: 8 },
  money: { fontSize: 16, fontWeight: '800', color: C.text },
  meta: { color: C.faint, fontSize: 13, marginTop: 3 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  going: { color: C.faint, fontSize: 12, marginLeft: 6 },
  status: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 9 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { color: C.text, fontSize: 12, fontWeight: '600' },
  chev: { color: C.faint, fontSize: 22, marginLeft: 8 },
  empty: { alignItems: 'center', marginTop: 30 },
  emptyEmoji: { fontSize: 46 },
  emptyText: { fontSize: 19, fontWeight: '700', color: C.text, marginTop: 10 },
  emptySub: { fontSize: 14, color: C.sub, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  emptyBtn: { backgroundColor: C.accent, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 22, marginTop: 18 },
  newText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
