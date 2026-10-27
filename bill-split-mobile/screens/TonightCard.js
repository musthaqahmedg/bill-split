import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getPolls, votePoll } from '../services/chat';
import { LIVE, listParties, liveOf } from '../services/parties';
import { KINDS, kindOf } from '../services/partyKinds';
import { C, F } from '../services/theme';
import PollCard from './PollCard';
import NightRecap from './NightRecap';
import { getParty } from '../services/parties';
import { countdown, planBucket } from '../services/when';

// 🌙 Home "Tonight": vibe chips to start a plan, your next plan, and its live vibe-check poll (Gautham's Home design)
const VIBES = ['nightout', 'party', 'birthday', 'house', 'movie', 'trip', 'daytrip', 'match'];

export default function TonightCard({ onPlan, onOpenPlan, refreshKey }) {
  const [next, setNext] = useState(null);
  const [poll, setPoll] = useState(null);
  const [recapParty, setRecapParty] = useState(null); // 🎬 morning-after story
  const openRecap = async () => {
    try {
      setRecapParty(await getParty(next.id));
    } catch (e) {}
  };

  const load = async () => {
    try {
      const list = await listParties();
      const fresh = (list || []).filter((p) => new Date(p.created_at) > new Date(Date.now() - 14 * 864e5));
      const n = fresh[0] || null;
      setNext(n);
      if (n && n.share_token) {
        const polls = await getPolls(n.share_token).catch(() => []);
        setPoll(polls.length ? polls[polls.length - 1] : null);
      } else setPoll(null);
    } catch (e) {}
  };
  useEffect(() => {
    load();
  }, [refreshKey]);

  const me = next && (next.party_members || []).find((m) => m.name === 'Me');
  const vote = async (pollId, option) => {
    if (!me || !next) return;
    try {
      await votePoll({ token: next.share_token, memberId: me.id, pollId, option });
      load();
    } catch (e) {}
  };

  const going = next ? (next.party_members || []).filter((m) => m.rsvp === 'in' || m.name === 'Me').length : 0;
  const k = next ? kindOf(next.kind) : null;

  return (
    <View>
      {/* 🎛️ Vibe chips: one tap to start that kind of plan */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingRight: 8 }}>
        {VIBES.map((key) => {
          const v = KINDS.find((x) => x.key === key);
          if (!v) return null;
          return (
            <TouchableOpacity key={key} style={[styles.chip, { borderColor: v.color }]} onPress={() => onPlan(key)} activeOpacity={0.8}>
              <Text style={styles.chipText}>{v.emoji} {v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 🟢 Live night strip (Final UX): your plan is on today */}
      {next && planBucket(next) === 'live' ? (
        <TouchableOpacity style={styles.live} onPress={() => onOpenPlan(next.id)} activeOpacity={0.85}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.liveKicker}>LIVE NIGHT ACTIVE</Text>
            <Text style={styles.liveTitle} numberOfLines={1}>{next.title}{next.place ? ` · ${next.place.replace(/^My place 🏠 · .*/, 'My place')}` : ''}</Text>
          </View>
          <Text style={styles.liveGo}>VIEW ›</Text>
        </TouchableOpacity>
      ) : null}

      {/* ⏭️ Next up: a lime poster card */}
      {next ? (
        <TouchableOpacity style={[styles.next, { borderColor: (k.color || C.accent) + '88' }]} onPress={() => onOpenPlan(next.id)} activeOpacity={0.85}>
          <View style={styles.nextTop}>
            <Text style={styles.nextKicker}>{planBucket(next) === 'past' ? 'LAST TIME' : 'NEXT UP'} · {countdown(next).toUpperCase()}</Text>
            <Text style={styles.nextGoing}>
              {(() => {
                const c = { omw: 0, here: 0, home: 0 };
                (next.party_members || []).forEach((m) => { const l = liveOf(m); if (l) c[l]++; });
                const parts = [c.here && `📍 ${c.here} here`, c.omw && `🚶 ${c.omw} on the way`].filter(Boolean);
                return parts.length ? parts.join(' · ') : `🙌 ${going} going`;
              })()}
            </Text>
          </View>
          <Text style={styles.nextTitle} numberOfLines={2}>{next.title}</Text>
          <Text style={styles.nextEmoji}>{k.emoji}</Text>
          <Text style={styles.nextMeta} numberOfLines={1}>
            {[next.party_date, next.place ? next.place.replace(/^My place 🏠 · .*/, 'My place 🏠') : null].filter(Boolean).join(' · ') || 'Date and place to be decided'}
          </Text>
          <View style={styles.nextBtns}>
            <View style={styles.nextBtn}>
              <Text style={styles.nextBtnText}>Open plan ›</Text>
            </View>
            {(next.party_members || []).some((m) => m.home_at) ? (
              <TouchableOpacity style={styles.recapBtn} onPress={openRecap}>
                <Text style={styles.recapText}>🎬 Last night's recap</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

      {/* 🗳️ Vibe check: the latest poll in your next plan, vote right here */}
      {poll ? (
        <View style={styles.pollWrap}>
          <Text style={styles.pollKicker}>🗳️ VIBE CHECK · LIVE</Text>
          <PollCard poll={poll} myId={me && me.id} onVote={vote} />
        </View>
      ) : null}
      {recapParty ? <NightRecap visible onClose={() => setRecapParty(null)} party={recapParty} photos={[]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { marginBottom: 14, marginHorizontal: -2 },
  chip: { backgroundColor: 'transparent', borderWidth: 1.5, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 13, marginHorizontal: 3 },
  chipText: { color: C.text, fontSize: 14, fontWeight: '600' },
  next: { backgroundColor: C.lime, borderRadius: 22, padding: 16, marginBottom: 14, overflow: 'hidden' },
  nextEmoji: { position: 'absolute', right: 14, bottom: 10, fontSize: 46, opacity: 0.9 },
  live: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.lime, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.lime, marginRight: 10 },
  liveKicker: { color: C.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  liveTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 1 },
  liveGo: { color: C.lime, fontSize: 12, fontWeight: '900', marginLeft: 8 },
  nextTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextKicker: { color: C.onLime, fontSize: 11, fontWeight: '900', letterSpacing: 1, opacity: 0.7 },
  nextGoing: { color: C.onLime, fontSize: 12, fontWeight: '800' },
  nextTitle: { fontFamily: F.display, color: C.onLime, fontSize: 24, lineHeight: 28, marginTop: 6, marginRight: 50 },
  nextMeta: { color: C.onLime, opacity: 0.75, fontSize: 13, fontWeight: '600', marginTop: 4, marginRight: 50 },
  nextBtns: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  nextBtn: { backgroundColor: C.onLime, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 },
  recapBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 },
  recapText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  nextBtnText: { color: C.lime, fontSize: 14, fontWeight: '900' },
  pollWrap: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 22, padding: 14, marginBottom: 14 },
  pollKicker: { color: C.pink, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
});
