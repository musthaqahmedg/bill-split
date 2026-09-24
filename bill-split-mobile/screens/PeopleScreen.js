import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function PeopleScreen({ initialPeople, onBack, onNext }) {
  const [people, setPeople] = useState(
    initialPeople && initialPeople.length ? initialPeople : ['Me']
  );
  const [name, setName] = useState('');

  const addPerson = () => {
    const n = name.trim();
    if (!n || people.includes(n)) return;
    setPeople([...people, n]);
    setName('');
  };

  const removePerson = (n) => setPeople(people.filter((p) => p !== n));

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
        {people.map((p) => (
          <View key={p} style={styles.row}>
            <Text style={styles.name}>{p}</Text>
            {p !== 'Me' && (
              <TouchableOpacity onPress={() => removePerson(p)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <Text style={styles.count}>
        {people.length} {people.length === 1 ? 'person' : 'people'}
      </Text>

      <TouchableOpacity
        style={[styles.button, people.length < 2 && styles.disabled]}
        onPress={() => onNext(people)}
        disabled={people.length < 2}
      >
        <Text style={styles.buttonText}>Next: Who had what?</Text>
      </TouchableOpacity>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 18 },
  remove: { color: '#FF3B30', fontSize: 15 },
  count: { color: '#999', textAlign: 'center', marginVertical: 10 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  disabled: { backgroundColor: '#a0c4f5' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});