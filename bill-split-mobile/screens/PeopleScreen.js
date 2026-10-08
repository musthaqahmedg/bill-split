import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { recentFriends } from '../services/bills';
import { C } from '../services/theme';

export default function PeopleScreen({ initialPeople, initialNonDrinkers, initialPairs, onBack, onNext }) {
  const [people, setPeople] = useState(
    initialPeople && initialPeople.length ? initialPeople : ['Me']
  );
  const [nonDrinkers, setNonDrinkers] = useState(initialNonDrinkers || []);
  const [pairs, setPairs] = useState(initialPairs || []);
  const [name, setName] = useState('');
  const [recent, setRecent] = useState([]);

  // Friends from your recent bills, for one-tap adding
  useEffect(() => {
    recentFriends().then(setRecent).catch(() => {});
  }, []);

  // Pair-up sheet
  const [pairOpen, setPairOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [payer, setPayer] = useState(null);

  const isPaired = (n) => pairs.some((pr) => pr.a === n || pr.b === n);
  const free = people.filter((p) => !isPaired(p));

  const addPerson = () => {
    const n = name.trim();
    if (!n || people.includes(n)) return;
    setPeople([...people, n]);
    setName('');
  };

  const quickAdd = (n) => {
    if (!people.includes(n)) setPeople([...people, n]);
  };
  const suggestions = recent.filter((n) => !people.includes(n));

  const removePerson = (n) => {
    setPeople(people.filter((p) => p !== n));
    setNonDrinkers(nonDrinkers.filter((p) => p !== n));
    setPairs(pairs.filter((pr) => pr.a !== n && pr.b !== n));
  };

  const toggleDrinking = (n) =>
    setNonDrinkers(nonDrinkers.includes(n) ? nonDrinkers.filter((p) => p !== n) : [...nonDrinkers, n]);

  const openPair = () => {
    setPicked([]);
    setPayer(null);
    setPairOpen(true);
  };

  const togglePick = (n) => {
    if (picked.includes(n)) {
      setPicked(picked.filter((p) => p !== n));
      if (payer === n) setPayer(null);
    } else if (picked.length < 2) {
      setPicked([...picked, n]);
    }
  };

  const savePair = () => {
    if (picked.length !== 2 || !payer) return;
    setPairs([...pairs, { a: picked[0], b: picked[1], payer }]);
    setPairOpen(false);
  };

  const removePair = (i) => setPairs(pairs.filter((_, k) => k !== i));

  const next = () =>
    onNext(
      people,
      nonDrinkers.filter((p) => people.includes(p)),
      pairs.filter((pr) => people.includes(pr.a) && people.includes(pr.b))
    );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Who's at the table?</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Friend's name"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
          value={name}
          onChangeText={setName}
          onSubmitEditing={addPerson}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addPerson}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.recentBox}>
          <Text style={styles.recentLabel}>⚡ Recent friends</Text>
          <View style={styles.recentChips}>
            {suggestions.map((n) => (
              <TouchableOpacity key={n} style={styles.recentChip} onPress={() => quickAdd(n)}>
                <Text style={styles.recentText}>+ {n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {people.map((p) => {
          const dry = nonDrinkers.includes(p);
          return (
            <View key={p} style={styles.row}>
              <Text style={styles.name}>{p}{isPaired(p) ? ' 💑' : ''}</Text>
              <View style={styles.rowRight}>
                <TouchableOpacity
                  style={[styles.pill, dry && styles.pillDry]}
                  onPress={() => toggleDrinking(p)}
                >
                  <Text style={[styles.pillText, dry && styles.pillTextDry]}>
                    {dry ? '🥤 Not drinking' : '🍺 Drinking'}
                  </Text>
                </TouchableOpacity>
                {p !== 'Me' && (
                  <TouchableOpacity onPress={() => removePerson(p)}>
                    <Text style={styles.remove}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Pairs */}
        <View style={styles.pairBox}>
          <View style={styles.pairHead}>
            <Text style={styles.pairTitle}>Pairs 💑</Text>
            <TouchableOpacity onPress={openPair} disabled={free.length < 2}>
              <Text style={[styles.pairAdd, free.length < 2 && styles.pairAddOff]}>+ Pair up</Text>
            </TouchableOpacity>
          </View>
          {pairs.length === 0 && (
            <Text style={styles.pairHint}>Couples or friends where one pays for both</Text>
          )}
          {pairs.map((pr, i) => (
            <View key={i} style={styles.pairRow}>
              <Text style={styles.pairText}>
                {pr.a} & {pr.b}  ·  <Text style={styles.pairPayer}>{pr.payer} pays</Text>
              </Text>
              <TouchableOpacity onPress={() => removePair(i)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.count}>
        {people.length} {people.length === 1 ? 'person' : 'people'}
        {nonDrinkers.length ? `  ·  ${nonDrinkers.length} not drinking` : ''}
        {pairs.length ? `  ·  ${pairs.length} ${pairs.length === 1 ? 'pair' : 'pairs'}` : ''}
      </Text>

      <TouchableOpacity
        style={[styles.button, people.length < 2 && styles.disabled]}
        onPress={next}
        disabled={people.length < 2}
      >
        <Text style={styles.buttonText}>Next: Who had what?</Text>
      </TouchableOpacity>

      {/* Pair-up sheet */}
      <Modal visible={pairOpen} transparent animationType="slide" onRequestClose={() => setPairOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Pair up 💑</Text>

            <Text style={styles.sheetSub}>Pick two people</Text>
            <View style={styles.chips}>
              {free.map((p) => {
                const on = picked.includes(p);
                return (
                  <TouchableOpacity key={p} style={[styles.chip, on && styles.chipOn]} onPress={() => togglePick(p)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {picked.length === 2 && (
              <>
                <Text style={styles.sheetSub}>Who pays?</Text>
                <View style={styles.chips}>
                  {picked.map((p) => {
                    const on = payer === p;
                    return (
                      <TouchableOpacity key={p} style={[styles.chip, on && styles.chipOn]} onPress={() => setPayer(p)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.sheetButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPairOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneBtn, !(picked.length === 2 && payer) && styles.doneOff]}
                onPress={savePair}
                disabled={!(picked.length === 2 && payer)}
              >
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20, color: C.text },
  inputRow: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, fontSize: 16, marginRight: 10, color: C.text },
  addBtn: { backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  recentBox: { marginBottom: 10 },
  recentLabel: { color: C.sub, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap' },
  recentChip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  recentText: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },
  list: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, flex: 1, color: C.text },
  pill: { backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, marginRight: 12 },
  pillDry: { backgroundColor: C.greenBg },
  pillText: { fontSize: 13, color: C.sub },
  pillTextDry: { color: C.green, fontWeight: '700' },
  remove: { color: C.red, fontSize: 15 },

  pairBox: { backgroundColor: '#3A1532', borderRadius: 16, padding: 14, marginTop: 16 },
  pairHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pairTitle: { fontSize: 16, fontWeight: '800', color: C.pink },
  pairAdd: { fontSize: 15, fontWeight: '700', color: C.pink },
  pairAddOff: { color: '#7A4A68' },
  pairHint: { color: C.faint, fontSize: 13, marginTop: 6 },
  pairRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pairText: { fontSize: 15, color: C.text, flex: 1 },
  pairPayer: { color: C.pink, fontWeight: '700' },

  count: { color: C.faint, textAlign: 'center', marginVertical: 10 },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center' },
  disabled: { backgroundColor: '#4B3A73' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10, color: C.text },
  sheetSub: { fontSize: 15, fontWeight: '700', color: C.sub, marginTop: 10, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: C.pink, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.pink },
  chipText: { color: C.pink, fontSize: 14 },
  chipTextOn: { color: '#2A0E22', fontWeight: '700' },
  sheetButtons: { flexDirection: 'row', marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginRight: 10 },
  cancelText: { color: C.sub, fontSize: 16, fontWeight: '700' },
  doneBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', backgroundColor: C.pink },
  doneOff: { backgroundColor: '#7A4A68' },
});