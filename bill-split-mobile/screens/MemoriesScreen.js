import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { getParty, listParties } from '../services/parties';
import { kindOf } from '../services/partyKinds';
import { C, F } from '../services/theme';
import MorningRecap from './MorningRecap';

// 📸 Memories (v12): every night you've had, as a highlight reel. Tap one to replay its story.
export default function MemoriesScreen({ onOpenPlan, onBack }) {
  const [plans, setPlans] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recap, setRecap] = useState(null);

  const load = useCallback(async () => {
    try {
      setPlans(await listParties());
    } catch (e) {
      setPlans([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const play = async (id) => {
    try {
      setRecap(await getParty(id));
    } catch (e) {}
  };

  if (plans === null) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator color={C.accentSoft} />
      </View>
    );
  }

  const [top, ...rest] = plans;
  const people = (p) => (p.party_members || []).filter((m) => m.rsvp === 'in' || m.name === 'Me').length;

  // Poster cards (Final UX): solid neon blocks with dark text, colour rotates per night
  const POSTERS = [C.lime, C.violet, C.pink, C.cyan];
  const Poster = ({ p, big, i = 0 }) => {
    const k = kindOf(p.kind);
    const bg = POSTERS[i % POSTERS.length];
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => play(p.id)} onLongPress={() => onOpenPlan && onOpenPlan(p.id)} style={[big ? styles.reel : styles.tile, { backgroundColor: bg }]}>
        <Text style={big ? styles.reelEmoji : styles.tileEmoji}>{k.emoji}</Text>
        {big ? <Text style={styles.reelKicker}>HIGHLIGHT REEL</Text> : null}
        <Text style={big ? styles.reelTitle : styles.tileTitle} numberOfLines={2}>{p.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{[p.party_date, `${people(p)} ${people(p) === 1 ? 'person' : 'people'}`].filter(Boolean).join(' · ')}</Text>
        {big ? (
          <View style={styles.play}>
            <Text style={styles.playText}>☀️ Open the recap</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.page}>
      <NightSky height={260} />
      <FlatList
        data={rest}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.accentSoft} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View>
            {onBack ? (
              <TouchableOpacity onPress={onBack} hitSlop={10}>
                <Text style={styles.back}>‹ Back</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.logo}>● MEMORY VAULT</Text>
            <Text style={styles.title}>
              <Text style={styles.titleItalic}>Memories</Text>
            </Text>
            <Text style={styles.lead}>Every night, saved. Tap to replay the story.</Text>
            {top ? <Poster p={top} big /> : (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📸</Text>
                <Text style={styles.emptyText}>No nights yet</Text>
                <Text style={styles.lead}>Plan something, and the night's story lands here.</Text>
              </View>
            )}
            {rest.length ? <Text style={styles.section}>All nights</Text> : null}
          </View>
        }
        renderItem={({ item, index }) => <Poster p={item} i={index + 1} />}
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
      />
      {recap ? <MorningRecap visible onClose={() => setRecap(null)} party={recap} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.lime, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  logo: { color: C.lime, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { marginTop: 14 },
  titleItalic: { fontFamily: F.display, color: C.text, fontSize: 32 },
  lead: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 14 },
  reel: { height: 220, borderRadius: 24, padding: 18, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: 6 },
  reelEmoji: { position: 'absolute', right: 16, top: 12, fontSize: 70 },
  reelKicker: { color: C.onLime, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, opacity: 0.7 },
  reelTitle: { fontFamily: F.display, color: C.onLime, fontSize: 26, marginTop: 4 },
  meta: { color: C.onLime, opacity: 0.75, fontSize: 12, fontWeight: '700', marginTop: 4 },
  play: { alignSelf: 'flex-start', backgroundColor: C.onLime, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, marginTop: 10 },
  playText: { color: C.lime, fontSize: 13, fontWeight: '900' },
  section: { fontFamily: F.display, color: C.text, fontSize: 17, marginTop: 16, marginBottom: 10 },
  tile: { width: '48.5%', height: 170, borderRadius: 20, padding: 12, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: 10 },
  tileEmoji: { position: 'absolute', right: 10, top: 8, fontSize: 40 },
  tileTitle: { fontFamily: F.display, color: C.onLime, fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 46 },
  emptyText: { fontFamily: F.display, color: C.text, fontSize: 18, marginTop: 8 },
});
