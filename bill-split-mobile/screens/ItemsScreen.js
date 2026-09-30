import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KINDS, kindOf } from '../services/kinds';

export default function ItemsScreen({ items, people, initialClaims, initialNonDrinkers, onBack, onNext }) {
  const [nonDrinkers, setNonDrinkers] = useState(
    (initialNonDrinkers || []).filter((p) => people.includes(p))
  );
  const [claims, setClaims] = useState(
    items.map((_, i) => ((initialClaims && initialClaims[i]) || []).filter((p) => people.includes(p)))
  );

  // "What's this?" pop-up: which item is open (-1 = none)
  const [info, setInfo] = useState(-1);

  const isAlcohol = (i) => kindOf(items[i]) === 'alcohol';
  const canHave = (i, person) => !(isAlcohol(i) && nonDrinkers.includes(person));
  const eligible = (i) => people.filter((p) => canHave(i, p));

  const toggleDrinking = (person) => {
    const nowDry = !nonDrinkers.includes(person);
    setNonDrinkers((prev) => (nowDry ? [...prev, person] : prev.filter((p) => p !== person)));
    if (nowDry) {
      // Take them off every alcohol item
      setClaims((prev) => prev.map((list, i) => (isAlcohol(i) ? list.filter((p) => p !== person) : list)));
    }
  };

  const toggle = (i, person) => {
    if (!canHave(i, person)) return;
    setClaims((prev) => prev.map((list, idx) => {
      if (idx !== i) return list;
      return list.includes(person) ? list.filter((p) => p !== person) : [...list, person];
    }));
  };

  const toggleAll = (i) => {
    const ok = eligible(i);
    setClaims((prev) => prev.map((list, idx) =>
      idx !== i ? list : (list.length === ok.length ? [] : [...ok])
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

      <View style={styles.dryBox}>
        <Text style={styles.dryLabel}>Not drinking?</Text>
        <View style={styles.chips}>
          {people.map((p) => {
            const dry = nonDrinkers.includes(p);
            return (
              <TouchableOpacity key={p} style={[styles.dryChip, dry && styles.dryChipOn]} onPress={() => toggleDrinking(p)}>
                <Text style={[styles.dryText, dry && styles.dryTextOn]}>{dry ? `🥤 ${p}` : p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView style={styles.list}>
        {items.map((item, i) => {
          const mystery = claims[i].length === 0;
          const k = KINDS[kindOf(item)];
          return (
            <View key={i} style={[styles.card, mystery && styles.mysteryCard]}>
              <View style={styles.cardTop}>
                <TouchableOpacity style={styles.nameTap} onPress={() => setInfo(i)}>
                  <Text style={styles.itemName}>
                    {mystery ? '🕵️ ' : ''}{k.emoji} {item.qty > 1 ? `${item.qty} × ` : ''}{item.name}
                    <Text style={styles.infoIcon}>  🔍</Text>
                  </Text>
                </TouchableOpacity>
                <Text style={styles.itemPrice}>Rs {item.price}</Text>
              </View>

              <View style={styles.chips}>
                {people.map((p) => {
                  const on = claims[i].includes(p);
                  const blocked = !canHave(i, p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, on && styles.chipOn, blocked && styles.chipBlocked]}
                      onPress={() => toggle(i, p)}
                      disabled={blocked}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn, blocked && styles.chipTextBlocked]}>
                        {blocked ? `🥤 ${p}` : p}
                      </Text>
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
        onPress={() => onNext(claims, nonDrinkers)}
      >
        <Text style={styles.buttonText}>See the split</Text>
      </TouchableOpacity>

      {/* What's this? — a private pop-up about one item */}
      <Modal visible={info >= 0} transparent animationType="fade" onRequestClose={() => setInfo(-1)}>
        <TouchableOpacity style={styles.infoOverlay} activeOpacity={1} onPress={() => setInfo(-1)}>
          {info >= 0 && (() => {
            const it = items[info];
            const kind = kindOf(it);
            const tag = kind === 'alcohol'
              ? { text: '🍺 Contains alcohol', style: styles.tagAlcohol }
              : kind === 'soft'
                ? { text: '🥤 No alcohol', style: styles.tagSoft }
                : { text: '🍽️ Food', style: styles.tagFood };
            return (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{it.name}</Text>
                <View style={[styles.infoTag, tag.style]}>
                  <Text style={styles.infoTagText}>{tag.text}</Text>
                </View>
                <Text style={styles.infoAbout}>
                  {it.about ? it.about : "We don't have a description for this one yet."}
                </Text>
                <Text style={styles.infoNote}>AI's best guess from the bill. Ask the staff if you're not sure.</Text>
                <TouchableOpacity style={styles.infoBtn} onPress={() => setInfo(-1)}>
                  <Text style={styles.buttonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 12 },
  dryBox: { backgroundColor: '#F4FBF6', borderRadius: 10, padding: 12, marginBottom: 12 },
  dryLabel: { fontSize: 14, fontWeight: '600', color: '#1E8E3E', marginBottom: 8 },
  dryChip: { borderWidth: 1, borderColor: '#BFE5C8', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 11, marginRight: 8, marginBottom: 6, backgroundColor: '#fff' },
  dryChipOn: { backgroundColor: '#1E8E3E', borderColor: '#1E8E3E' },
  dryText: { color: '#1E8E3E', fontSize: 13 },
  dryTextOn: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  mysteryCard: { borderColor: '#F5C451', backgroundColor: '#FFFBEB' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  nameTap: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 16, fontWeight: '600' },
  infoIcon: { fontSize: 14 },
  itemPrice: { fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#007AFF', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: '#007AFF' },
  chipBlocked: { borderColor: '#ddd', backgroundColor: '#F5F5F5' },
  chipText: { color: '#007AFF', fontSize: 14 },
  chipTextOn: { color: '#fff' },
  chipTextBlocked: { color: '#aaa' },
  chipAll: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  chipAllText: { color: '#666', fontSize: 14 },
  shared: { color: '#888', fontSize: 13, marginTop: 2 },
  count: { color: '#999', textAlign: 'center', marginVertical: 10 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabled: { backgroundColor: '#a0c4f5' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  infoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 28 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 22 },
  infoTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  infoTag: { alignSelf: 'flex-start', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 14 },
  tagAlcohol: { backgroundColor: '#FDEBD3' },
  tagSoft: { backgroundColor: '#E3F6E8' },
  tagFood: { backgroundColor: '#F2F2F7' },
  infoTagText: { fontSize: 14, fontWeight: '600', color: '#333' },
  infoAbout: { fontSize: 16, color: '#333', lineHeight: 22 },
  infoNote: { fontSize: 12, color: '#999', marginTop: 14 },
  infoBtn: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 18 },
});