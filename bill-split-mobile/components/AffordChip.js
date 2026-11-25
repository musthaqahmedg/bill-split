import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getBudgets } from '../services/budget';
import { canAfford, cycleFor, cycleSpends, getPockets, pocketBalances, tonightPocket } from '../services/pockets';
import { C } from '../services/theme';

// 🎟️ "Can I afford this?" — checks the ticket price against Going Out (and tonight's slice if it's set).
// Shows nothing for people who don't use Pockets, free events or when there's no price.
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export default function AffordChip({ price, style }) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    if (!(Number(price) > 0)) return;
    let live = true;
    (async () => {
      const st = await getPockets();
      if (!st.setup) return;
      const cyc = cycleFor(st.setup);
      const { spends } = await cycleSpends(cyc.startStr);
      const roll = st.rollovers.reduce((a, r) => a + Number(r.amount || 0), 0);
      const go = pocketBalances(st.pockets, spends, cyc, roll).rows.find((r) => r.name.toLowerCase() === 'going out');
      if (!go) return;
      const b = await getBudgets().catch(() => ({ tonight: 0 }));
      const tn = b.tonight ? tonightPocket(b.tonight, spends.filter((x) => x.pocket_id === go.id)).left : null;
      if (live) setRes({ ...canAfford(price, go.left, tn), emoji: go.emoji, tonight: tn !== null });
    })().catch(() => {});
    return () => { live = false; };
  }, [price]);
  if (!res || res.free) return null;
  return (
    <View style={[styles.chip, { backgroundColor: res.ok ? C.lime + '22' : C.pink + '22', borderColor: res.ok ? C.lime : C.pink }, style]}>
      <Text style={styles.text}>
        {res.ok
          ? `${res.emoji} You can afford this: ${inr(res.room)} left in ${res.tonight ? 'tonight\'s pocket' : 'Going Out'} ✅`
          : `⚠️ ${inr(res.short)} short. ${res.tonight ? 'Tonight\'s pocket' : 'Going Out'} has ${inr(Math.max(0, res.room))} left`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10 },
  text: { color: C.text, fontSize: 13, fontWeight: '700' },
});
