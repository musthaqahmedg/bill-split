import { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { billsForParty } from '../services/bills';
import { show } from '../services/names';
import { badgeOf } from '../services/parties';
import { kindOf } from '../services/partyKinds';
import { listPhotos } from '../services/photos';
import { C, F } from '../services/theme';
import { nightLength } from '../services/when';
import NightRecap from './NightRecap';

// ☀️ Morning recap (Final UX): the night in numbers. Tab settled, time out, the squad's awards,
// the memory vault (photos), then play the story or share it.
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const PILLS = ['#E2FF3B', '#FF4FA0', '#55E0F0', '#FF8A3D', '#A98BFF'];

export default function MorningRecap({ visible, onClose, party }) {
  const [bills, setBills] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [story, setStory] = useState(false);

  useEffect(() => {
    if (!visible || !party) return;
    billsForParty(party.id).then(setBills).catch(() => setBills([]));
    listPhotos(party.id).then(setPhotos).catch(() => setPhotos([]));
  }, [visible, party && party.id]);

  if (!party) return null;
  const k = kindOf(party.kind);
  const members = party.party_members || [];
  const came = members.filter((m) => m.rsvp === 'in' || m.name === 'Me');
  const home = members.filter((m) => m.home_at).length;
  const stops = (Array.isArray(party.stops) ? party.stops : []).filter((x) => x && x.name);
  const time = nightLength(members);

  // 🧾 the tab: bills split in this plan (or the plan budget)
  const total = bills.reduce((a, b) => a + (Number(b.total) || 0), 0);
  const people = bills.flatMap((b) => (b.bill_participants || []).filter((p) => p.name !== 'Me'));
  const paid = people.filter((p) => p.paid_at).length;
  const mine = bills.reduce((a, b) => a + (Number(((b.bill_participants || []).find((p) => p.name === 'Me') || {}).amount_due) || 0), 0);
  const settled = people.length > 0 && paid === people.length;

  const awards = members.map((m) => [m, badgeOf(m, members, party)]).filter(([, b]) => b && b !== '🎟️ Host');
  const first = members.filter((m) => m.home_at).sort((a, b) => new Date(a.home_at) - new Date(b.home_at))[0];
  if (first && !awards.some(([m]) => m.id === first.id)) awards.push([first, '🏠 First home']);

  const share = () =>
    Share.share({
      message: [
        `☀️ Morning recap: ${party.title} ${k.emoji}`,
        `🙌 ${came.length} showed up${stops.length > 1 ? ` · 🗺️ ${stops.length} stops` : ''}${time ? ` · ⏱️ ${time} out` : ''}`,
        total ? `🧾 ${inr(total)} split to the rupee${settled ? ', all settled ✅' : ''}` : null,
        home ? `🏠 ${home} got home safe` : null,
        awards.length ? `😎 ${awards.slice(0, 3).map(([m, b]) => `${show(m.name)}: ${b}`).join(' · ')}` : null,
        'Planned on VibeOut ✨',
      ].filter(Boolean).join('\n'),
    }).catch(() => {});

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.top}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>✕ Close</Text>
          </TouchableOpacity>
          <View style={styles.syncPill}>
            <Text style={styles.syncText}>● NIGHT SAVED</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>MORNING RECAP ☀️</Text>
          <Text style={styles.title}>{party.title}</Text>
          <Text style={styles.meta}>{[party.party_date, party.place && party.place.replace(/^My place 🏠 · .*/, 'My place 🏠')].filter(Boolean).join(' · ') || 'The aftermath'}</Text>

          {/* 🧾 The tab */}
          <View style={styles.tab}>
            <View style={styles.row}>
              <Text style={styles.tabKicker}>{total ? 'SQUAD TAB' : 'THE PLAN'}</Text>
              {total ? (
                <View style={styles.tabPill}>
                  <Text style={styles.tabPillText}>{settled ? '100% SETTLED ✓' : `${paid}/${people.length} PAID`}</Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.row, { alignItems: 'flex-end', marginTop: 8 }]}>
              <Text style={styles.tabBig}>{total ? inr(total) : Number(party.budget) ? inr(party.budget) : '—'}</Text>
              {total ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.tabSmall}>your share</Text>
                  <Text style={styles.tabMine}>{inr(mine)}</Text>
                </View>
              ) : null}
            </View>
            {people.length ? (
              <View style={styles.segs}>
                {people.map((p, i) => (
                  <View key={i} style={[styles.seg, { backgroundColor: p.paid_at ? C.onLime : 'rgba(0,0,0,0.18)' }]} />
                ))}
              </View>
            ) : (
              <Text style={styles.tabSmall}>{total ? 'Split to the rupee 😎' : 'No bill split in this plan yet'}</Text>
            )}
          </View>

          {/* ⏱️ Numbers */}
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statKicker}>OUT IN THE WILD</Text>
              <Text style={styles.statBig}>{time || '—'}</Text>
              <Text style={styles.statSub}>{time ? 'first "on my way" → last home' : 'tap statuses in Night Mode'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statKicker}>THE SQUAD</Text>
              <Text style={styles.statBig}>{came.length}</Text>
              <Text style={styles.statSub}>{home ? `🏠 ${home} home safe` : 'showed up'}{stops.length > 1 ? ` · ${stops.length} stops` : ''}</Text>
            </View>
          </View>

          {/* 🏆 Squad honors */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>🏆 SQUAD HONORS & AWARDS</Text>
              <Text style={styles.cardCount}>{awards.length} {awards.length === 1 ? 'badge' : 'badges'}</Text>
            </View>
            {awards.length ? (
              awards.slice(0, 6).map(([m, b], i) => (
                <View key={m.id || m.name} style={styles.award}>
                  <View style={[styles.face, { backgroundColor: PILLS[i % PILLS.length] }]}>
                    <Text style={styles.faceText}>{show(m.name).slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.awardName, { color: PILLS[i % PILLS.length] }]}>{b.replace(/^\S+\s/, '').toUpperCase()} — {show(m.name)}</Text>
                    <Text style={styles.awardSub}>{b.split(' ')[0]} {b === '🏠 First home' && m.home_at ? `Home at ${new Date(m.home_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Earned last night'}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No badges yet. Give your crew one in Night Mode 😎</Text>
            )}
          </View>

          {/* 📸 Memory vault */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>📸 SQUAD MEMORY VAULT</Text>
              <Text style={styles.cardCount}>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</Text>
            </View>
            {photos.length ? (
              <View style={styles.grid}>
                {photos.slice(0, 9).map((p) => (
                  <Image key={p.id} source={{ uri: p.url }} style={styles.photo} />
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No photos from this night. Add some from the plan's 📸 Photos.</Text>
            )}
          </View>

          <TouchableOpacity style={styles.play} onPress={() => setStory(true)} activeOpacity={0.85}>
            <Text style={styles.playText}>▶ PLAY THE STORY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
            <Text style={styles.shareText}>↗ SHARE THE RECAP</Text>
          </TouchableOpacity>
          <Text style={styles.foot}>🔒 Only this plan's crew can see its photos and numbers.</Text>
        </ScrollView>
      </View>
      {story ? <NightRecap visible onClose={() => setStory(false)} party={party} photos={photos} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingTop: 56 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 6 },
  close: { color: C.sub, fontSize: 16, fontWeight: '600' },
  syncPill: { backgroundColor: C.lime + '22', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9 },
  syncText: { color: C.lime, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  pad: { paddingHorizontal: 20, paddingBottom: 50 },
  kicker: { color: C.lime, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: 8 },
  title: { fontFamily: F.display, color: C.text, fontSize: 30, lineHeight: 36, marginTop: 4 },
  meta: { color: C.sub, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tab: { backgroundColor: C.lime, borderRadius: 22, padding: 16, marginTop: 16 },
  tabKicker: { color: C.onLime, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, opacity: 0.7 },
  tabPill: { backgroundColor: C.onLime, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  tabPillText: { color: C.lime, fontSize: 10, fontWeight: '900' },
  tabBig: { fontFamily: F.display, color: C.onLime, fontSize: 34 },
  tabSmall: { color: C.onLime, fontSize: 12, fontWeight: '700', opacity: 0.75, marginTop: 6 },
  tabMine: { fontFamily: F.bold, color: C.onLime, fontSize: 18 },
  segs: { flexDirection: 'row', marginTop: 12 },
  seg: { flex: 1, height: 6, borderRadius: 3, marginRight: 4 },
  stats: { flexDirection: 'row', marginTop: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginHorizontal: 3 },
  statKicker: { color: C.faint, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statBig: { fontFamily: F.display, color: C.text, fontSize: 24, marginTop: 6 },
  statSub: { color: C.sub, fontSize: 11, marginTop: 4 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginTop: 10 },
  cardTitle: { color: C.text, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  cardCount: { color: C.faint, fontSize: 12, fontWeight: '700' },
  award: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cardHi, borderRadius: 14, padding: 10, marginTop: 10 },
  face: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  faceText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  awardName: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  awardSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -2 },
  photo: { width: '32%', aspectRatio: 1, borderRadius: 10, margin: '0.66%', backgroundColor: C.cardHi },
  empty: { color: C.faint, fontSize: 13, lineHeight: 19, marginTop: 10 },
  play: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  playText: { color: C.onLime, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  shareBtn: { borderWidth: 1.5, borderColor: C.text, borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  shareText: { color: C.text, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  foot: { color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 12 },
});
