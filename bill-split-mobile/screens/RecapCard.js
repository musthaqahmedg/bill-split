import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

// Fun awards for the night. Rule: never reward drinking.
function makeAwards(bill) {
  const people = bill.bill_participants || [];
  const items = bill.bill_items || [];
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const awards = [];

  // 👑 Big spender: highest share
  const top = [...people].sort((a, b) => Number(b.amount_due) - Number(a.amount_due))[0];
  if (top && Number(top.amount_due) > 0 && people.length > 1) {
    awards.push({ emoji: '👑', title: 'Big spender', name: top.name });
  }

  // 💛 Generous one: covered friends the most
  const covers = {};
  items.forEach((it) =>
    (it.item_claims || []).forEach((c) => {
      if (c.paid_by && c.paid_by !== c.participant_id) covers[c.paid_by] = (covers[c.paid_by] || 0) + 1;
    })
  );
  const generous = Object.entries(covers).sort((a, b) => b[1] - a[1])[0];
  if (generous && nameOf[generous[0]]) {
    awards.push({ emoji: '💛', title: 'Generous one', name: nameOf[generous[0]] });
  }

  // 🥤 Hydration Hero: not drinking
  const dry = people.filter((p) => p.not_drinking).map((p) => p.name);
  if (dry.length) awards.push({ emoji: '🥤', title: 'Hydration Hero', name: dry.join(' & ') });

  // ⚡ Fastest payer: paid first
  const first = people
    .filter((p) => p.paid_at)
    .sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at))[0];
  if (first) awards.push({ emoji: '⚡', title: 'Fastest payer', name: first.name });

  return awards;
}

export default function RecapCard({ bill, visible, onClose }) {
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  if (!bill) return null;

  const people = bill.bill_participants || [];
  const items = bill.bill_items || [];
  const awards = makeAwards(bill);
  const when = new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const share = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing is not available on this phone');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share the recap' });
    } catch (e) {
      Alert.alert("Couldn't share", e.message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* The card itself: this is what becomes the image */}
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <Text style={styles.kicker}>THE NIGHT, SORTED ✨</Text>
          <Text style={styles.place}>{bill.title || 'Night out'}</Text>
          <Text style={styles.date}>{when}</Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statBig}>{inr(bill.total)}</Text>
              <Text style={styles.statLabel}>total</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statBig}>{people.length}</Text>
              <Text style={styles.statLabel}>people</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statBig}>{items.length}</Text>
              <Text style={styles.statLabel}>items</Text>
            </View>
          </View>

          <Text style={styles.crew}>{people.map((p) => p.name).join(' · ')}</Text>

          {awards.length > 0 && (
            <View style={styles.awards}>
              {awards.map((a) => (
                <View key={a.title} style={styles.award}>
                  <Text style={styles.awardEmoji}>{a.emoji}</Text>
                  <View style={styles.awardText}>
                    <Text style={styles.awardTitle}>{a.title}</Text>
                    <Text style={styles.awardName}>{a.name}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footer}>Split fairly with Vibe Out</Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={share} disabled={sharing}>
            {sharing ? <ActivityIndicator color="#fff" /> : <Text style={styles.shareText}>Share 📤</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: 330, backgroundColor: '#24103F', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#5B3A99' },
  kicker: { color: '#C9A8FF', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  place: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 8 },
  date: { color: '#B8A6D9', fontSize: 14, marginTop: 4 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, backgroundColor: '#341A5C', borderRadius: 16, padding: 14 },
  stat: { alignItems: 'center', flex: 1 },
  statBig: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#B8A6D9', fontSize: 12, marginTop: 2 },
  crew: { color: '#E6DAFF', fontSize: 14, marginTop: 16, lineHeight: 20 },
  awards: { marginTop: 16 },
  award: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#341A5C', borderRadius: 14, padding: 10, marginBottom: 8 },
  awardEmoji: { fontSize: 26, marginRight: 12 },
  awardText: { flex: 1 },
  awardTitle: { color: '#C9A8FF', fontSize: 12, fontWeight: '700' },
  awardName: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  footer: { color: '#8C7AAE', fontSize: 11, textAlign: 'center', marginTop: 14 },
  buttons: { flexDirection: 'row', width: 330, marginTop: 16 },
  closeBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#fff', marginRight: 10 },
  closeText: { color: '#333', fontSize: 16, fontWeight: '600' },
  shareBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#8B5CF6' },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});