import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';
import NearbyScreen from './NearbyScreen';

const IDEAS = [
  { q: '📍 Where should we go?', o: ['', ''] },
  { q: '🍗 What should we order?', o: ['Biryani', 'Mandi', 'Pizza'] },
  { q: '📅 Which day works?', o: ['Friday', 'Saturday', 'Sunday'] },
  { q: '🕗 What time?', o: ['7 pm', '8 pm', '9 pm'] },
  { q: '🥤 Drinks?', o: ['Mocktails', 'Soft drinks', 'Both'] },
];

// Make a poll for the party chat
export default function NewPollSheet({ visible, onClose, onCreate, initial = null }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false); // 📍 choose places from Discover
  useEffect(() => {
    if (visible && initial) {
      setQuestion(initial.q);
      setOptions(initial.o);
    }
  }, [visible]);
  // put a picked place into the first empty option (or add one, up to 6)
  const addPlace = (name) => {
    setOptions((cur) => {
      if (cur.some((o) => o.trim().toLowerCase() === name.toLowerCase())) return cur;
      const i = cur.findIndex((o) => !o.trim());
      if (i >= 0) return cur.map((o, k) => (k === i ? name : o));
      return cur.length < 6 ? [...cur, name] : cur;
    });
    if (!question.trim()) setQuestion('📍 Where should we go?');
    setPicking(false);
  };

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
  };

  const setOpt = (i, t) => setOptions(options.map((o, k) => (k === i ? t : o)));

  const create = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return Alert.alert('Ask a question', 'e.g. Where should we go?');
    if (opts.length < 2) return Alert.alert('Add options', 'A poll needs at least 2 options');
    setSaving(true);
    try {
      await onCreate(question.trim(), opts);
      reset();
      onClose();
    } catch (e) {
      Alert.alert("Couldn't create poll", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.top}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📊 New poll</Text>
          <TouchableOpacity onPress={create} disabled={saving}>
            <Text style={styles.post}>{saving ? '…' : 'Post'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.label}>Quick ideas</Text>
          <View style={styles.chips}>
            {IDEAS.map((idea) => (
              <TouchableOpacity key={idea.q} style={styles.chip} onPress={() => { setQuestion(idea.q); setOptions(idea.o); }}>
                <Text style={styles.chipText}>{idea.q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Question</Text>
          <TextInput style={styles.input} value={question} onChangeText={setQuestion} maxLength={200}
            placeholder="Ask the group…" placeholderTextColor={C.faint} keyboardAppearance="dark" />

          <Text style={styles.label}>Options</Text>
          {options.map((o, i) => (
            <View key={i} style={styles.optRow}>
              <TextInput style={[styles.input, styles.flex]} value={o} onChangeText={(t) => setOpt(i, t)} maxLength={80}
                placeholder={`Option ${i + 1}`} placeholderTextColor={C.faint} keyboardAppearance="dark" />
              {options.length > 2 && (
                <TouchableOpacity style={styles.remove} onPress={() => setOptions(options.filter((_, k) => k !== i))}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {options.length < 6 && (
            <TouchableOpacity style={styles.add} onPress={() => setOptions([...options, ''])}>
              <Text style={styles.addText}>+ Add option</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.discover} onPress={() => setPicking(true)}>
            <Text style={styles.discoverText}>📍 Add a place from Discover</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <NearbyScreen discover pickLabel="＋ ADD TO VOTE" initialCategory="cafes" onBack={() => setPicking(false)} onPlanHere={addPlace} />
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: C.bg, paddingTop: 16, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cancel: { color: C.sub, fontSize: 16 },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  post: { color: C.lime, fontSize: 16, fontWeight: '800' },
  label: { color: C.sub, fontSize: 14, marginBottom: 6, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  chipText: { color: C.sub, fontSize: 13 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text, marginBottom: 10 },
  optRow: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  remove: { paddingHorizontal: 12, paddingVertical: 12 },
  removeText: { color: C.red, fontSize: 16 },
  add: { paddingVertical: 10 },
  addText: { color: C.lime, fontSize: 15, fontWeight: '800' },
  discover: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.lime, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6, marginBottom: 30 },
  discoverText: { color: C.lime, fontSize: 15, fontWeight: '800' },
});
