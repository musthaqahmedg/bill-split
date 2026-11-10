import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { EVENT_CATS, eventKm, eventPrice, eventsBrowse, eventWhen, onDay } from '../services/events';
import { C, F } from '../services/theme';

// 🌙 Plan a Night = what's ON around you: parties, live music, comedy, festivals, activities, games.
// Events only (restaurants live in Book a Table). Events come from organisers / our admin page — never made up.

const DAYS = [
  { key: 'all', label: 'Any day' },
  { key: 'tonight', label: 'Tonight' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];
const CAT_BG = { parties: C.pink, music: C.violet, comedy: '#FFD84D', festivals: C.cyan, activities: C.lime, games: '#FF8A3D' };
const catOf = (k) => EVENT_CATS.find((c) => c.key === k);
const W = Dimensions.get('window').width;
const COL = (W - 20 * 2 - 12) / 2;

// Poster, or a bold category block when the organiser didn't add one
function Poster({ e, style, big }) {
  if (e.poster_url) return <Image source={{ uri: e.poster_url }} style={style} resizeMode="cover" accessibilityIgnoresInvertColors />;
  const c = catOf(e.category);
  return (
    <View style={[style, { backgroundColor: CAT_BG[e.category] || C.violet, alignItems: 'center', justifyContent: 'center', padding: 12 }]}>
      <Text style={{ fontSize: big ? 64 : 44 }}>{c ? c.emoji : '🌙'}</Text>
      <Text style={[styles.blockTitle, big && { fontSize: 20 }]} numberOfLines={3}>{e.title}</Text>
    </View>
  );
}

export default function PlanNightScreen({ onBack, onOpenEvent, onPlanAnyway }) {
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [day, setDay] = useState('all');
  const [cat, setCat] = useState('all');

  const load = useCallback(async () => {
    try {
      setFailed(false);
      setList(await eventsBrowse({ ask: true }));
    } catch (e) {
      setFailed(true);
      setList((l) => l || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => (list || []).filter((e) => onDay(e, day) && (cat === 'all' || e.category === cat)),
    [list, day, cat]
  );
  const spotlight = shown.filter((e) => e.is_featured).slice(0, 8);
  const nearby = [...shown].sort((a, b) => (a.km ?? 9e9) - (b.km ?? 9e9));
  const filtered = day !== 'all' || cat !== 'all';

  const card = (e) => {
    const price = eventPrice(e);
    const c = catOf(e.category);
    return (
      <TouchableOpacity key={e.id} style={styles.card} onPress={() => onOpenEvent(e)} activeOpacity={0.85} accessibilityRole="button">
        <View>
          <Poster e={e} style={styles.cardPoster} />
          {e.status === 'sold_out' ? <View style={styles.soldTag}><Text style={styles.soldText}>SOLD OUT</Text></View> : null}
        </View>
        <View style={styles.dateChip}><Text style={styles.dateText} numberOfLines={1}>{eventWhen(e)}</Text></View>
        <Text style={styles.cardTitle} numberOfLines={2}>{e.title}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>{[e.venue_name, eventKm(e.km)].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.cardCat} numberOfLines={1}>{[c ? `${c.emoji} ${c.label}` : null, price].filter(Boolean).join(' · ')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <NightSky />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.lime} />}
      >
        <TouchableOpacity onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>PLAN A{'\n'}NIGHT</Text>
        <Text style={styles.kicker}>DISCOVER WHAT'S HAPPENING AROUND YOU</Text>

        {/* When */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={{ paddingRight: 20 }}>
          {DAYS.map((d) => (
            <TouchableOpacity key={d.key} style={[styles.chip, day === d.key && styles.chipOn]} onPress={() => setDay(d.key)}>
              <Text style={[styles.chipText, day === d.key && styles.chipTextOn]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* What */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={{ paddingRight: 20 }}>
          {[{ key: 'all', label: 'All', emoji: '✨' }, ...EVENT_CATS].map((c) => (
            <TouchableOpacity key={c.key} style={[styles.cat, cat === c.key && styles.catOn]} onPress={() => setCat(c.key)}>
              <Text style={styles.catEmoji}>{c.emoji}</Text>
              <Text style={[styles.catText, cat === c.key && { color: C.lime }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {list === null ? <ActivityIndicator color={C.lime} style={{ marginTop: 40 }} /> : null}

        {/* ⭐ Spotlight */}
        {spotlight.length ? (
          <>
            <Text style={styles.section}>⭐ IN THE SPOTLIGHT</Text>
            <FlatList
              horizontal
              data={spotlight}
              keyExtractor={(e) => e.id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={W * 0.78 + 12}
              decelerationRate="fast"
              contentContainerStyle={{ paddingRight: 20 }}
              renderItem={({ item: e }) => (
                <TouchableOpacity style={styles.spot} onPress={() => onOpenEvent(e)} activeOpacity={0.9}>
                  <Poster e={e} style={styles.spotPoster} big />
                  <View style={styles.spotInfo}>
                    <Text style={styles.spotWhen} numberOfLines={1}>{eventWhen(e)}</Text>
                    <Text style={styles.spotTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>{[e.venue_name, eventKm(e.km), eventPrice(e)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        ) : null}

        {/* 📍 Everything near you */}
        {nearby.length ? (
          <>
            <Text style={styles.section}>📍 NEAR YOU · {nearby.length} {nearby.length === 1 ? 'EVENT' : 'EVENTS'}</Text>
            <View style={styles.grid}>{nearby.map(card)}</View>
          </>
        ) : null}

        {/* Empty / error */}
        {list !== null && !nearby.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{failed ? '📡' : filtered ? '🔍' : '🌙'}</Text>
            <Text style={styles.emptyTitle}>{failed ? "Couldn't load events" : filtered ? 'Nothing for this filter' : 'Nothing on yet near you'}</Text>
            <Text style={styles.emptySub}>
              {failed ? 'Check your internet and pull down to try again.' : filtered ? 'Try another day or category.' : 'New events show up here as organisers add them.'}
            </Text>
            {filtered && !failed ? (
              <TouchableOpacity style={styles.ghost} onPress={() => { setDay('all'); setCat('all'); }}>
                <Text style={styles.ghostText}>Show everything</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Always: make your own night */}
        <TouchableOpacity style={styles.own} onPress={onPlanAnyway} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ownTitle}>🎈 Make your own night</Text>
          <Text style={styles.ownSub}>Pick a time, add your squad, vote on the plan</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  body: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: C.lime, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  title: { fontFamily: F.display, color: C.text, fontSize: 48, lineHeight: 50 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, marginTop: 6, marginBottom: 14 },
  row: { marginBottom: 10, marginRight: -20 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingVertical: 9, paddingHorizontal: 14, marginRight: 8 },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { color: C.text, fontSize: 14, fontWeight: '800' },
  chipTextOn: { color: C.onLime },
  cat: { alignItems: 'center', width: 76, paddingVertical: 8, marginRight: 6, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  catOn: { borderColor: C.lime, backgroundColor: C.card },
  catEmoji: { fontSize: 26 },
  catText: { color: C.sub, fontSize: 12, fontWeight: '800', marginTop: 4 },
  section: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 18, marginBottom: 10 },
  spot: { width: W * 0.78, marginRight: 12, backgroundColor: C.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  spotPoster: { width: '100%', height: W * 0.78 * 1.1 },
  spotInfo: { padding: 12 },
  spotWhen: { color: C.lime, fontSize: 13, fontWeight: '800' },
  spotTitle: { fontFamily: F.display, color: C.text, fontSize: 18, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: COL, marginBottom: 18 },
  cardPoster: { width: COL, height: COL * 1.45, borderRadius: 14, overflow: 'hidden' },
  soldTag: { position: 'absolute', top: 8, right: 8, backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  soldText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  dateChip: { alignSelf: 'flex-start', backgroundColor: C.cardHi, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  dateText: { color: C.text, fontSize: 12, fontWeight: '700' },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginTop: 6 },
  cardSub: { color: C.sub, fontSize: 12, marginTop: 3 },
  cardCat: { color: C.lime, fontSize: 12, fontWeight: '800', marginTop: 3 },
  blockTitle: { fontFamily: F.display, color: C.onLime, fontSize: 15, textAlign: 'center', marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: F.display, color: C.text, fontSize: 20, marginTop: 10, textAlign: 'center' },
  emptySub: { color: C.sub, fontSize: 14, marginTop: 6, textAlign: 'center' },
  ghost: { borderWidth: 1, borderColor: C.lime, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginTop: 14 },
  ghostText: { color: C.lime, fontSize: 14, fontWeight: '800' },
  own: { backgroundColor: C.violet, borderRadius: 22, padding: 18, marginTop: 18 },
  ownTitle: { fontFamily: F.display, color: C.onLime, fontSize: 18 },
  ownSub: { color: C.onLime, fontSize: 13, fontWeight: '700', marginTop: 4, opacity: 0.8 },
});
