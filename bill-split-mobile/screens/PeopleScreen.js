import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PeopleScreen({ initialPeople, initialNonDrinkers, initialPairs, onBack, onNext }) {
  const [people, setPeople] = useState(
    initialPeople && initialPeople.length ? initialPeople : ['Me']
  );
  const [nonDrinkers, setNonDrinkers] = useState(initialNonDrinkers || []);
  const [pairs, setPairs] = useState(initialPairs || []);
  const [name, setName] = useState('');

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
          value={name}
          onChangeText={setName}
          onSubmitEditing={addPerson}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addPerson}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  inputRow: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, fontSize: 16, marginRight: 10 },
  addBtn: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  list: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, flex: 1 },
  pill: { backgroundColor: '#F2F2F7', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, marginRight: 12 },
  pillDry: { backgroundColor: '#E3F6E8' },
  pillText: { fontSize: 13, color: '#555' },
  pillTextDry: { color: '#1E8E3E', fontWeight: '600' },
  remove: { color: '#FF3B30', fontSize: 15 },

  pairBox: { backgroundColor: '#FFF5F9', borderRadius: 10, padding: 14, marginTop: 16 },
  pairHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pairTitle: { fontSize: 16, fontWeight: 'bold', color: '#D6457F' },
  pairAdd: { fontSize: 15, fontWeight: '600', color: '#D6457F' },
  pairAddOff: { color: '#E8A8C2' },
  pairHint: { color: '#999', fontSize: 13, marginTop: 6 },
  pairRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pairText: { fontSize: 15, color: '#333', flex: 1 },
  pairPayer: { color: '#D6457F', fontWeight: '600' },

  count: { color: '#999', textAlign: 'center', marginVertical: 10 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabled: { backgroundColor: '#a0c4f5' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  sheetSub: { fontSize: 15, fontWeight: '600', color: '#555', marginTop: 10, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#D6457F', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: '#D6457F' },
  chipText: { color: '#D6457F', fontSize: 14 },
  chipTextOn: { color: '#fff' },
  sheetButtons: { flexDirection: 'row', marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', marginRight: 10 },
  cancelText: { color: '#555', fontSize: 16, fontWeight: '600' },
  doneBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#D6457F' },
  doneOff: { backgroundColor: '#E8A8C2' },
});