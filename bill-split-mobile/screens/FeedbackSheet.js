import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';

// 💬 3-tap feedback after saving a bill (testing phase). Shown for a person's first 5 bills, then never again.
const KEY = 'vo_feedback_shown';
const MAX = 5;

export async function shouldAskFeedback() {
  try {
    const n = Number(await AsyncStorage.getItem(KEY)) || 0;
    if (n >= MAX) return false;
    await AsyncStorage.setItem(KEY, String(n + 1));
    return true;
  } catch (e) {
    return false;
  }
}

const QS = [
  ['scan_ok', '📸 Did the scan read the bill right?'],
  ['fair', '⚖️ Did the split feel fair?'],
  ['use_again', '🔁 Would you use this again next time?'],
];

export default function FeedbackSheet({ visible, onClose, billId = null }) {
  const [a, setA] = useState({});
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const done = async (send) => {
    if (send && (Object.keys(a).length || note.trim())) {
      setSending(true);
      try {
        await supabase.from('feedback').insert({ bill_id: billId, ...a, note: note.trim().slice(0, 500) || null });
      } catch (e) {}
      setSending(false);
    }
    setA({});
    setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => done(false)}>
      <Pressable style={styles.overlay} onPress={() => done(false)}>
        <Pressable style={styles.sheet}>
          <Text style={styles.kicker}>SAVED! 🎉 QUICK FEEDBACK</Text>
          <Text style={styles.title}>3 taps, helps us a lot</Text>
          {QS.map(([k, q]) => (
            <View key={k} style={styles.q}>
              <Text style={styles.qText}>{q}</Text>
              <View style={styles.row}>
                {[[true, '👍 Yes'], [false, '👎 No']].map(([v, label]) => (
                  <TouchableOpacity key={label} style={[styles.chip, a[k] === v && (v ? styles.yes : styles.no)]} onPress={() => setA({ ...a, [k]: v })} activeOpacity={0.85}>
                    <Text style={[styles.chipText, a[k] === v && { color: C.onLime }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <TextInput style={styles.note} value={note} onChangeText={setNote} placeholder="Anything confusing? (optional)" placeholderTextColor={C.faint} keyboardAppearance="dark" maxLength={500} multiline />
          <TouchableOpacity style={styles.send} onPress={() => done(true)} disabled={sending} activeOpacity={0.85}>
            <Text style={styles.sendText}>{sending ? 'Sending…' : 'SEND →'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => done(false)} hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 38 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  title: { fontFamily: F.display, color: C.text, fontSize: 22, marginTop: 4, marginBottom: 6 },
  q: { marginTop: 12 },
  qText: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row' },
  chip: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginRight: 8 },
  yes: { backgroundColor: C.lime, borderColor: C.lime },
  no: { backgroundColor: C.pink, borderColor: C.pink },
  chipText: { color: C.text, fontSize: 14, fontWeight: '800' },
  note: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, color: C.text, fontSize: 15, marginTop: 14, minHeight: 60 },
  send: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 14, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  sendText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  skip: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 12 },
});
