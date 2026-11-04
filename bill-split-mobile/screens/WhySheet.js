import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { show } from '../services/names';
import { C, F } from '../services/theme';

// 🤔 "Why do I owe ₹X?": what they had, their share of tax / service / tip, and the total
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const inr2 = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function WhySheet({ row, tipTotal = 0, billItemsTotal = 0, onClose }) {
  if (!row) return null;
  const extra = row.ownExact - row.subtotal;
  const pct = row.subtotal ? Math.round((extra / row.subtotal) * 1000) / 10 : 0;
  const covered = row.mine.filter((m) => m.paidBy !== row.name);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text style={styles.kicker}>{row.name === 'Me' ? 'YOUR SHARE' : `${show(row.name).toUpperCase()}'S SHARE`}</Text>
          <Text style={styles.big}>{inr(row.pay)}</Text>
          <Text style={styles.sub}>Why {row.name === 'Me' ? 'you owe' : `${show(row.name)} owes`} this</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <Text style={styles.section}>WHAT {row.name === 'Me' ? 'YOU' : 'THEY'} HAD</Text>
            {row.mine.map((m) => (
              <View key={m.i} style={styles.line}>
                <Text style={styles.item} numberOfLines={2}>
                  {m.name}
                  <Text style={styles.how}>
                    {m.counted ? `  (${m.units} of ${m.totalUnits})` : m.ways > 1 ? `  (1 of ${m.ways})` : ''}
                    {m.paidBy !== row.name ? `  · ${show(m.paidBy)} pays 💛` : ''}
                  </Text>
                </Text>
                <Text style={styles.amt}>{inr2(m.amount)}</Text>
              </View>
            ))}
            {!row.mine.length ? <Text style={styles.how}>Nothing claimed</Text> : null}
            <View style={styles.rule} />
            <View style={styles.line}>
              <Text style={styles.item}>Items subtotal</Text>
              <Text style={styles.amt}>{inr2(row.subtotal)}</Text>
            </View>
            {Math.abs(extra) >= 0.01 ? (
              <View style={styles.line}>
                <Text style={styles.item}>
                  {extra >= 0 ? 'Tax, service' : 'Discount'}{tipTotal ? ' + tip' : ''}
                  <Text style={styles.how}>  ({pct > 0 ? '+' : ''}{pct}%, same % for everyone)</Text>
                </Text>
                <Text style={styles.amt}>{extra >= 0 ? '+' : '−'}{inr2(Math.abs(extra))}</Text>
              </View>
            ) : null}
            <View style={styles.line}>
              <Text style={styles.total}>Total (rounded)</Text>
              <Text style={styles.total}>{inr(row.pay)}</Text>
            </View>
            {covered.length ? <Text style={styles.note}>Items marked 💛 are covered by a friend, so they're in that friend's total.</Text> : null}
            <Text style={styles.note}>Tax and service are shared in proportion to what each person had. Totals are rounded to whole rupees and always add up to the bill.</Text>
          </ScrollView>
          <TouchableOpacity style={styles.done} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.doneText}>GOT IT</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 36 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  big: { fontFamily: F.display, color: C.text, fontSize: 40, marginTop: 4 },
  sub: { color: C.sub, fontSize: 14, marginBottom: 10 },
  section: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 6, marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  item: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600', marginRight: 10 },
  how: { color: C.sub, fontSize: 13, fontWeight: '500' },
  amt: { color: C.text, fontSize: 15, fontWeight: '800' },
  rule: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  total: { color: C.lime, fontSize: 17, fontWeight: '900' },
  note: { color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 8 },
  done: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  doneText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
});
