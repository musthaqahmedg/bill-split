import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { listParties } from '../services/parties';
import { C, F, STICK } from '../services/theme';
import { countdown, planBucket, sortPlans } from '../services/when';

// 🪩 Night tab (new UX): tonight's room front and centre with one big START NIGHT MODE button.
// No room tonight → the next one coming up, or a "plan a night" nudge.
export default function NightTabScreen({ onStart, onOpen, onPlan }) {
  const [plans, setPlans] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = () => listParties().then(setPlans).catch(() => setPlans([]));
  useEffect(() => {
    load();
  }, []);

  if (!plans) {
    return (
      <View style={[styles.page, { justifyContent: 'center' }]}>
        <ActivityIndicator color={C.lime} />
      </View>
    );
  }
  const live = sortPlans(plans.filter((p) => planBucket(p) === 'live'), 'upcoming');
  const next = sortPlans(plans.filter((p) => planBucket(p) === 'upcoming'), 'upcoming').slice(0, 3);
  const tonight = live[0];
  const going = (p) => (p.party_members || []).filter((m) => m.rsvp !== 'out');
  const out = (p) => (p.party_members || []).filter((m) => m.live_status === 'omw' || m.live_status === 'here').length;

  return (
    <View style={styles.page}>
      <NightSky height={260} />
      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.lime} />}
      >
        <Text style={styles.kicker}>{tonight ? `● ${(tonight.place || tonight.title).toUpperCase()} · LIVE` : '● NIGHT MODE'}</Text>
        <Text style={styles.title}>NIGHT</Text>

        {tonight ? (
          <View style={styles.hero}>
            <Text style={styles.heroTitle} numberOfLines={2}>{tonight.title}</Text>
            <Text style={styles.heroMeta} numberOfLines={1}>{[tonight.place, countdown(tonight)].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.heroCrew}>👥 {going(tonight).length} in the squad{out(tonight) ? ` · ${out(tonight)} out now` : ''}</Text>
            <TouchableOpacity style={styles.start} onPress={() => onStart(tonight.id)} activeOpacity={0.85}>
              <Text style={styles.startText}>START NIGHT MODE →</Text>
            </TouchableOpacity>
            <Text style={styles.heroSub}>Squad radar · bill so far · get home safe</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌙</Text>
            <Text style={styles.emptyTitle}>No night on yet</Text>
            <Text style={styles.emptySub}>Plan one and Night Mode lights up here on the day.</Text>
            <TouchableOpacity style={styles.start} onPress={onPlan} activeOpacity={0.85}>
              <Text style={styles.startText}>PLAN A NIGHT →</Text>
            </TouchableOpacity>
          </View>
        )}

        {next.length ? <Text style={styles.section}>COMING UP</Text> : null}
        {next.map((p) => (
          <TouchableOpacity key={p.id} style={styles.row} onPress={() => onOpen(p.id)} activeOpacity={0.85}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>{[p.place, `${going(p).length} going`].filter(Boolean).join(' · ')}</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{countdown(p).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  title: { fontFamily: F.display, color: C.text, fontSize: 40, marginTop: 4, marginBottom: 16 },
  hero: { backgroundColor: C.violet, borderRadius: 24, padding: 20, ...STICK },
  heroTitle: { fontFamily: F.display, color: C.onLime, fontSize: 24 },
  heroMeta: { color: C.onLime, fontSize: 14, fontWeight: '700', marginTop: 4, opacity: 0.8 },
  heroCrew: { color: C.onLime, fontSize: 14, fontWeight: '800', marginTop: 10 },
  heroSub: { color: C.onLime, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10, opacity: 0.75 },
  start: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 16, ...STICK, borderRightColor: C.onLime, borderBottomColor: C.onLime },
  startText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  empty: { backgroundColor: C.card, borderRadius: 24, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontFamily: F.display, color: C.text, fontSize: 20, marginTop: 8 },
  emptySub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 4 },
  section: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 24, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  rowTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  rowMeta: { color: C.sub, fontSize: 13, marginTop: 2 },
  pill: { backgroundColor: C.lime, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8 },
  pillText: { fontFamily: F.pixel, color: C.onLime, fontSize: 11 },
});
