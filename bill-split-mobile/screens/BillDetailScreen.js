import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { getBill, deleteBill } from '../services/bills';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const money = (n) => 'Rs ' + Number((Number(n) || 0).toFixed(2)).toLocaleString('en-IN');

export default function BillDetailScreen({ billId, onBack, onDeleted }) {
  const [bill, setBill] = useState(null);

  useEffect(() => {
    getBill(billId)
      .then(setBill)
      .catch((e) => Alert.alert('Error', e.message));
  }, [billId]);

  if (!bill) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const items = bill.bill_items || [];
  const people = [...(bill.bill_participants || [])].sort((a, b) => b.amount_due - a.amount_due);
  const itemsTotal = items.reduce((s, it) => s + Number(it.price), 0);
  const extras = Number(bill.total) - itemsTotal;

  const itemsOf = (pid) =>
    items
      .filter((it) => (it.item_claims || []).some((c) => c.participant_id === pid))
      .map((it) => ({ ...it, ways: it.item_claims.length }));

  const confirmDelete = () =>
    Alert.alert('Delete this bill?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBill(bill.id);
            onDeleted();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);

  const when = new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{bill.title || 'Night out'}</Text>
      <Text style={styles.meta}>
        {when}{bill.bill_no ? `  ·  Bill ${bill.bill_no}` : ''}
      </Text>

      <ScrollView style={styles.list}>
        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Items</Text>
            <Text style={styles.sumLabel}>{money(itemsTotal)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Tax, service & round-off</Text>
            <Text style={styles.sumLabel}>{money(extras)}</Text>
          </View>
          <View style={[styles.sumRow, styles.sumTotal]}>
            <Text style={styles.sumBold}>Bill total</Text>
            <Text style={styles.sumBold}>{money(bill.total)}</Text>
          </View>
        </View>

        {people.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.pay}>{inr(p.amount_due)}</Text>
            </View>
            {itemsOf(p.id).map((it) => (
              <Text key={it.id} style={styles.line}>
                {it.quantity > 1 ? `${it.quantity} × ` : ''}{it.name}
                {it.ways > 1 ? `  (shared ${it.ways} ways)` : ''}  ·  {money(Number(it.price) / it.ways)}
              </Text>
            ))}
            {itemsOf(p.id).length === 0 && <Text style={styles.line}>Didn't claim anything</Text>}
          </View>
        ))}

        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete this bill</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold' },
  meta: { color: '#999', fontSize: 14, marginTop: 4, marginBottom: 15 },
  list: { flex: 1 },
  summary: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 14, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: '#666', fontSize: 14 },
  sumTotal: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 8, marginTop: 4, marginBottom: 0 },
  sumBold: { fontSize: 16, fontWeight: 'bold' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold' },
  pay: { fontSize: 22, fontWeight: 'bold', color: '#007AFF' },
  line: { color: '#555', fontSize: 14, marginBottom: 3 },
  deleteBtn: { alignItems: 'center', paddingVertical: 20, marginBottom: 30 },
  deleteText: { color: '#FF3B30', fontSize: 16 },
});