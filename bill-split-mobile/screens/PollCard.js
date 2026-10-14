import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// A poll inside the chat: tap an option to vote, tap it again to take your vote back
export default function PollCard({ poll, myId, sender, onVote }) {
  if (!poll) return null;
  const votes = poll.votes || {};
  const total = Object.keys(votes).length;
  const mine = myId != null ? votes[myId] : undefined;
  const counts = poll.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
  const top = Math.max(0, ...counts);
  const namesFor = (i) => (poll.voters || []).filter((v) => v.option === i).map((v) => v.name);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>📊 POLL {sender ? `· ${sender}` : ''}</Text>
      <Text style={styles.q}>{poll.question}</Text>
      {poll.options.map((opt, i) => {
        const pct = total ? Math.round((counts[i] / total) * 100) : 0;
        const chosen = mine === i;
        return (
          <TouchableOpacity key={i} style={[styles.opt, chosen && styles.optOn]} onPress={() => onVote(poll.id, i)}>
            <View style={[styles.fill, { width: `${pct}%` }, counts[i] === top && top > 0 && styles.fillTop]} />
            <View style={styles.optRow}>
              <Text style={styles.optText}>{chosen ? '✓ ' : ''}{opt}</Text>
              <Text style={styles.pct}>{counts[i] ? `${counts[i]} · ${pct}%` : ''}</Text>
            </View>
            {namesFor(i).length ? <Text style={styles.names} numberOfLines={1}>{namesFor(i).join(', ')}</Text> : null}
          </TouchableOpacity>
        );
      })}
      <Text style={styles.total}>{total} {total === 1 ? 'vote' : 'votes'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', backgroundColor: C.card, borderWidth: 1, borderColor: C.accent, borderRadius: 16, padding: 12, marginBottom: 10 },
  kicker: { color: C.accentSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  q: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 8 },
  opt: { borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 6, overflow: 'hidden', paddingVertical: 9, paddingHorizontal: 12 },
  optOn: { borderColor: C.accentSoft },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.cardHi },
  fillTop: { backgroundColor: '#4A2A80' },
  optRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optText: { color: C.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  pct: { color: C.sub, fontSize: 13, fontWeight: '700' },
  names: { color: C.faint, fontSize: 11, marginTop: 2 },
  total: { color: C.faint, fontSize: 12, marginTop: 2 },
});
