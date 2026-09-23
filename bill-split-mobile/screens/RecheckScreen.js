import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';

export default function RecheckScreen({ items, bill, onBack, onNext }) {
  const [rows, setRows] = useState(
    items.map((it) => ({ name: it.name, qty: String(it.qty || 1), price: String(it.price) }))
  );
  const [total, setTotal] = useState(String(bill?.total || 0));

  const update = (i, field, value) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const remove = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const addRow = () => setRows((prev) => [...prev, { name: '', qty: '1', price: '' }]);

  const itemsTotal = rows.reduce((s, r) => s + (parseFloat(r.price) || 0), 0);
  const billTotal = parseFloat(total) || 0;
  const extras = billTotal - itemsTotal;

  const done = () => {
    const clean = rows
      .map((r) => ({
        name: r.name.trim(),
        qty: parseInt(r.qty) || 1,
        rate: (parseFloat(r.price) || 0) / (parseInt(r.qty) || 1),
        price: parseFloat(r.price) || 0,
      }))
      .filter((r) => r.name && r.price > 0);

    if (clean.length === 0) {
      Alert.alert('Nothing to split', 'Add at least one item with a price.');
      return;
    }
    if (billTotal < itemsTotal - 1) {
      Alert.alert('Total looks low', 'The bill total is less than the items add up to. Check it before continuing.');
      return;
    }
    onNext(clean, { ...bill, total: billTotal });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Check the bill</Text>
      <Text style={styles.sub}>Fix anything the scan got wrong. Tap a name or price to edit.</Text>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {rows.map((r, i) => (
          <View key={i} style={styles.card}>
            <TextInput
              style={styles.name}
              value={r.name}
              onChangeText={(v) => update(i, 'name', v)}
              placeholder="Item name"
            />
            <View style={styles.rowLine}>
              <View style={styles.qtyBox}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.qty}
                  value={r.qty}
                  onChangeText={(v) => update(i, 'qty', v)}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.label}>Rs</Text>
                <TextInput
                  style={styles.price}
                  value={r.price}
                  onChangeText={(v) => update(i, 'price', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity onPress={() => remove(i)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addRow}>
          <Text style={styles.addText}>+ Add an item</Text>
        </TouchableOpacity>

        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Items add up to</Text>
            <Text style={styles.sumLabel}>Rs {itemsTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Bill total</Text>
            <TextInput
              style={styles.totalInput}
              value={total}
              onChangeText={setTotal}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.extras}>
            {extras >= 0
              ? `Rs ${extras.toFixed(2)} tax, service & round-off — shared fairly`
              : `Items are Rs ${Math.abs(extras).toFixed(2)} more than the total — check the prices`}
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={done}>
        <Text style={styles.buttonText}>Looks right — continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 15 },
  list: { flex: 1 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '600', paddingVertical: 6 },
  rowLine: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  priceBox: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  label: { color: '#999', fontSize: 14, marginRight: 6 },
  qty: { borderBottomWidth: 1, borderBottomColor: '#ddd', minWidth: 40, fontSize: 16, paddingVertical: 4, textAlign: 'center' },
  price: { borderBottomWidth: 1, borderBottomColor: '#ddd', minWidth: 80, fontSize: 16, paddingVertical: 4 },
  remove: { color: '#FF3B30', fontSize: 14 },
  addBtn: { borderWidth: 1, borderColor: '#007AFF', borderStyle: 'dashed', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 15 },
  addText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  summary: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 14, marginBottom: 20 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sumLabel: { fontSize: 15, fontWeight: '600' },
  totalInput: { borderBottomWidth: 1, borderBottomColor: '#bbb', minWidth: 90, fontSize: 16, fontWeight: '600', paddingVertical: 2, textAlign: 'right' },
  extras: { color: '#888', fontSize: 13, marginTop: 4 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});