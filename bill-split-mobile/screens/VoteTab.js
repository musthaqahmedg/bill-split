import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createPoll, getPolls, votePoll } from '../services/chat';
import { C, F } from '../services/theme';
import NewPollSheet from './NewPollSheet';
import PollCard from './PollCard';

// 🗳️ Room "Vote" tab (Final UX): where are we going, what time, or anything else.
// Venue votes can pull places straight from Discover. Everyone in the room (and on the invite link) can vote.
const QUICK = [
  { key: 'venue', label: '📍 Venue vote', color: C.lime, initial: { q: '📍 Where should we go?', o: ['', ''] } },
  { key: 'time', label: '🕘 Time vote', color: C.cyan, initial: { q: '🕘 What time?', o: ['8 pm', '9 pm', '10 pm'] } },
  { key: 'day', label: '📅 Day vote', color: C.violet, initial: { q: '📅 Which day works?', o: ['Friday', 'Saturday', 'Sunday'] } },
  { key: 'custom', label: '＋ Anything', color: null, initial: { q: '', o: ['', ''] } },
];

export default function VoteTab({ party }) {
  const [polls, setPolls] = useState(null);
  const [sheet, setSheet] = useState(null); // initial question/options for the new poll
  const me = (party.party_members || []).find((m) => m.name === 'Me');
  const token = party.share_token;

  const load = () => getPolls(token).then((p) => setPolls([...(p || [])].reverse())).catch(() => setPolls([]));
  useEffect(() => {
    if (token) load();
    else setPolls([]);
  }, [token]);

  const vote = async (pollId, option) => {
    if (!me) return;
    try {
      await votePoll({ token, memberId: me.id, pollId, option });
      load();
    } catch (e) {}
  };

  return (
    <View>
      <Text style={styles.lead}>Can't decide? Put it to a vote. Friends on the invite link can vote too.</Text>
      <View style={styles.quick}>
        {QUICK.map((q) => (
          <TouchableOpacity key={q.key} style={[styles.chip, q.color ? { backgroundColor: q.color } : styles.chipOutline]} onPress={() => setSheet(q.initial)} activeOpacity={0.85} disabled={!token}>
            <Text style={[styles.chipText, !q.color && { color: C.text }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {polls === null ? (
        <ActivityIndicator color={C.lime} style={{ marginTop: 20 }} />
      ) : polls.length ? (
        polls.map((p) => <PollCard key={p.id} poll={p} myId={me && me.id} onVote={vote} />)
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🗳️</Text>
          <Text style={styles.emptyTitle}>No votes yet</Text>
          <Text style={styles.lead}>Start a venue vote and add places from Discover in one tap.</Text>
        </View>
      )}

      <NewPollSheet
        visible={!!sheet}
        initial={sheet}
        onClose={() => setSheet(null)}
        onCreate={async (question, options) => {
          await createPoll({ token, memberId: me && me.id, question, options });
          load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  chip: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, marginBottom: 8, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  chipOutline: { borderWidth: 1, borderColor: C.border },
  chipText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { fontFamily: F.display, color: C.text, fontSize: 18, marginTop: 8, marginBottom: 6 },
});
