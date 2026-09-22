import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { saveBill } from '../services/bills';

const inr = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
const money = (n) => 'Rs ' + Number(n.toFixed(2)).toLocaleString('en-IN');

export default function SplitScreen({ items, people, claims, bill, onBack, onDone }) {
  const [saving, setSaving] = useState(false);

  const itemsTotal = items.reduce((s, it) => s + it.price, 0);
  const billTotal = bill && bill.total > 0
    ? bill.total
    : itemsTotal + (bill?.tax || 0) + (bill?.service_charge || 0) - (bill?.discount || 0);
  const extras = billTotal - itemsTotal; // tax + service - discount + round-off

  // Each person's items and their share of tax & service
  const shares = people.map((name) => {
    const mine = [];
    items.forEach((it, i) => {
      const who = claims[i] || [];
      if (who.includes(name)) {
        mine.push({ name: it.name, qty: it.qty, amount: it.price / who.length, ways: who.length });
      }
    });
    const subtotal = mine.reduce((s, m) => s + m.amount, 0);
    const exact = itemsTotal > 0 ? subtotal + extras * (subtotal / itemsTotal) : 0;
    return { name, mine, subtotal, exact };
  });

  // Round to whole rupees so everyone adds up exactly to the bill
  const target = Math.round(billTotal);
  const final = shares.map((s) => Math.floor(s.exact));
  let left = target - final.reduce((a, b) => a + b, 0);
  shares
    .map((s, i) => ({ i, frac: s.exact - Math.floor(s.exact) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach((o) => { if (left > 0) { final[o.i] += 1; left -= 1; } });

  const rows = shares.map((s, i) => ({ ...s, pay: final[i] })).sort((a, b) => b.pay - a.pay);
  const sum = final.reduce((a, b) => a + b, 0);

  const save = async () => {
    setSaving(true);
    try {
      const amounts = Object.fromEntries(shares.map((s, i) => [s.name, final[i]]));
      await saveBill({ bill: { ...bill, total: billTotal }, items, people, claims, amounts });
      Alert.alert('Saved! 🎉', 'You can find this bill on your home screen.', [
        { text: 'OK', onPress: onDone },
      ]);
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>The split 🎉</Text>

      <View style={styles.summary}>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Items</Text>
          <Text style={styles.sumValue}>{money(itemsTotal)}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Tax, service & round-off</Text>
          <Text style={styles.sumValue}>{money(extras)}</Text>
        </View>
        <View style={[styles.sumRow, styles.sumTotal]}>
          <Text style={styles.sumBold}>Bill total</Text>
          <Text style={styles.sumBold}>{money(billTotal)}</Text>
        </View>
      </View>

      <ScrollView style={styles.list}>
        {rows.map((r) => {
          const extra = r.exact - r.subtotal;
          return (
            <View key={r.name} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.pay}>{inr(r.pay)}</Text>
              </View>

              {r.mine.length === 0 && <Text style={styles.line}>Didn't claim anything</Text>}

              {r.mine.map((m, j) => (
                <Text key={j} style={styles.line}>
                  {m.qty > 1 ? `${m.qty} × ` : ''}{m.name}
                  {m.ways > 1 ? `  (shared ${m.ways} ways)` : ''}  ·  {money(m.amount)}
                </Text>
              ))}

              {r.mine.length > 0 && (
                <Text style={styles.extra}>
                  {extra >= 0 ? '+' : '−'} {money(Math.abs(extra))} share of tax & service
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.check}>
        Everyone adds up to {inr(sum)} {sum === target ? '✓' : ''}
      </Text>

      <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save bill</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  summary: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 14, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: '#666', fontSize: 14 },
  sumValue: { color: '#666', fontSize: 14 },
  sumTotal: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 8, marginTop: 4, marginBottom: 0 },
  sumBold: { fontSize: 16, fontWeight: 'bold' },
  list: { flex: 1 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold' },
  pay: { fontSize: 22, fontWeight: 'bold', color: '#007AFF' },
  line: { color: '#555', fontSize: 14, marginBottom: 3 },
  extra: { color: '#999', fontSize: 13, marginTop: 4 },
  check: { color: '#34A853', textAlign: 'center', marginVertical: 10, fontWeight: '600' },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});