import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function ItemsScreen({ items, people, onBack, onNext }) {
  const [claims, setClaims] = useState(items.map(() => []));

  const toggle = (i, person) => {
    setClaims((prev) => prev.map((list, idx) => {
      if (idx !== i) return list;
      return list.includes(person) ? list.filter((p) => p !== person) : [...list, person];
    }));
  };

  const toggleAll = (i) => {
    setClaims((prev) => prev.map((list, idx) =>
      idx !== i ? list : (list.length === people.length ? [] : [...people])
    ));
  };

  const claimed = claims.filter((c) => c.length > 0).length;
  const allDone = claimed === items.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Who had what?</Text>
      <Text style={styles.sub}>Tap everyone who had each item. Shared items split between them.</Text>

      <ScrollView style={styles.list}>
        {items.map((item, i) => {
          const mystery = claims[i].length === 0;
          return (
            <View key={i} style={[styles.card, mystery && styles.mysteryCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.itemName}>
                  {mystery ? '🕵️ ' : ''}{item.qty > 1 ? `${item.qty} × ` : ''}{item.name}
                </Text>
                <Text style={styles.itemPrice}>Rs {item.price}</Text>
              </View>

              <View style={styles.chips}>
                {people.map((p) => {
                  const on = claims[i].includes(p);
                  return (
                    <TouchableOpacity key={p} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(i, p)}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.chipAll} onPress={() => toggleAll(i)}>
                  <Text style={styles.chipAllText}>All</Text>
                </TouchableOpacity>
              </View>

              {claims[i].length > 1 && (
                <Text style={styles.shared}>
                  Split {claims[i].length} ways · Rs {(item.price / claims[i].length).toFixed(2)} each
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.count}>
        {claimed} of {items.length} items claimed{!allDone ? '  ·  🕵️ = mystery item' : ''}
      </Text>

      <TouchableOpacity
        style={[styles.button, !allDone && styles.disabled]}
        disabled={!allDone}
        onPress={() => onNext(claims)}
      >
        <Text style={styles.buttonText}>See the split</Text>
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
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  mysteryCard: { borderColor: '#F5C451', backgroundColor: '#FFFBEB' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 10 },
  itemPrice: { fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: '#007AFF' },
  chipText: { color: '#007AFF', fontSize: 14 },
  chipTextOn: { color: '#fff' },
  chipAll: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  chipAllText: { color: '#666', fontSize: 14 },
  shared: { color: '#888', fontSize: 13, marginTop: 2 },
  count: { color: '#999', textAlign: 'center', marginVertical: 10 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabled: { backgroundColor: '#a0c4f5' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});