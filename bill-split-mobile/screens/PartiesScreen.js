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

  // right-hand tag (new UX): LIVE · 31 DEC / TOMORROW · PLANNING · SETTLED
  const settled = owing.length && paid === owing.length;
  const tag =
    bucket === 'live'
      ? { text: 'LIVE', bg: C.lime }
      : settled
      ? { text: 'SETTLED', bg: '#7CFFB2' }
      : bucket === 'past'
      ? { text: (item.party_date || when).toUpperCase().replace(/^[A-Z]{3}, /, ''), bg: C.cardHi }
      : when === 'Date TBD'
      ? { text: 'PLANNING', bg: C.violet }
      : { text: when.toUpperCase(), bg: C.pink };
  const moneyLine = settled
    ? `${inr(owing.reduce((x, m) => x + Number(m.share || 0), 0) + Number((members.find((m) => m.name === 'Me') || {}).share || 0))} split · all paid`
    : Number(item.budget) > 0
    ? `${inr(item.budget)} budget`
    : status === 'Planning' ? '' : status;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.card, bucket === 'live' && { borderColor: C.lime }]}>
        <View style={styles.rowTop}>
          <Text style={styles.emojiSmall}>{k.emoji}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.tag, { backgroundColor: tag.bg }]}>
            {bucket === 'live' ? <View style={[styles.liveDot, { backgroundColor: C.onLime }]} /> : null}
            <Text style={styles.tagText}>{tag.text}</Text>
          </View>
        </View>
        {item.place ? <Text style={styles.meta} numberOfLines={1}>📍 {item.place.replace(/^My place 🏠 · .*/, 'My place')}</Text> : null}
        <View style={styles.rowBottom}>
          <View style={styles.avatars}>
            {members.slice(0, 4).map((m, i) => (
              <View key={m.id || i} style={[styles.avatar, { backgroundColor: hue(m.name), marginLeft: i ? -8 : 0 }]}>
                <Text style={styles.avatarText}>{(show(m.name) || '?')[0].toUpperCase()}</Text>
              </View>
            ))}
            <Text style={styles.going}>{out && bucket === 'live' ? `${out} out now` : `${going} going`}</Text>
          </View>
          <Text style={styles.moneyLine} numberOfLines={1}>{moneyLine}</Text>
        </View>
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
            <Text style={styles.title}>ROOMS</Text>
            <Text style={styles.sub}>{LINES[line]}</Text>
            <TouchableOpacity style={styles.newRoom} onPress={onNewParty} activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={styles.newKicker}>NEW ROOM</Text>
                <Text style={styles.newTitle}>START A ROOM</Text>
                <Text style={styles.newSub}>Invite friends, split, plan</Text>
              </View>
              <Text style={styles.newPlus}>＋</Text>
            </TouchableOpacity>
            <View style={styles.chips}>
              <TouchableOpacity style={styles.chip} onPress={onMemories || onNearby} activeOpacity={0.85}>
                <Text style={styles.chipText}>🧭 Nearby</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={onGroups} activeOpacity={0.85}>
                <Text style={styles.chipText}>👥 Groups</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.section}>YOUR ROOMS</Text>
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
  sub: { color: C.sub, fontSize: 14, fontWeight: '500', marginTop: 2 },
  title: { fontFamily: F.display, fontSize: 40, color: C.text },
  newRoom: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lime, borderRadius: 24, padding: 18, marginTop: 14, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  newKicker: { fontFamily: F.pixel, color: C.onLime, fontSize: 10, opacity: 0.7 },
  newTitle: { fontFamily: F.display, color: C.onLime, fontSize: 22, marginTop: 2 },
  newSub: { color: C.onLime, fontSize: 13, fontWeight: '700', marginTop: 2 },
  newPlus: { fontFamily: F.display, color: C.onLime, fontSize: 40, marginLeft: 8 },
  chips: { flexDirection: 'row', marginTop: 10 },
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 },
  chipText: { color: C.text, fontSize: 14, fontWeight: '800' },
  section: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 20, marginBottom: 10 },
  emojiSmall: { fontSize: 20, marginRight: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8 },
  tagText: { fontFamily: F.pixel, color: C.onLime, fontSize: 10 },
  moneyLine: { color: C.sub, fontSize: 13, fontWeight: '700', flexShrink: 1, marginLeft: 8, textAlign: 'right' },
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
  card: { backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  emoji: { fontSize: 22 },
  flex: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { flex: 1, fontFamily: F.bold, fontSize: 16, color: C.text },
  money: { fontSize: 16, fontWeight: '800', color: C.text },
  meta: { color: C.faint, fontSize: 13, marginTop: 3 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  avatarText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  going: { color: C.text, fontSize: 13, fontWeight: '700', marginLeft: 8 },
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
