import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addExpense } from '../services/expenses';
import { EXPENSE_CATS } from '../services/money';
import { C, F } from '../services/theme';

// 💸 Log a spend in 2 taps: pick what, tap an amount (or type), done. Goes into the Vault.
const QUICK = [50, 100, 200, 500];

export default function QuickAdd({ visible, onClose, partyId = null, onSaved, initialCat = null }) {
  const [cat, setCat] = useState('cab');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) {
      setAmount('');
      setNote('');
      if (initialCat) setCat(initialCat);
    }
  }, [visible]);

  const save = async () => {
    if (!(Number(amount) > 0)) return Alert.alert('Amount?', 'Type how much you spent.');
    setSaving(true);
    try {
      await addExpense({ category: cat, amount, note, partyId });
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
      Keyboard.dismiss();
      onSaved && onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>💸 Quick add</Text>
          <Text style={styles.sub}>Log a spend. It goes into your Vault, and only you see it.</Text>
          <View style={styles.cats}>
            {Object.entries(EXPENSE_CATS).map(([k, v]) => (
              <TouchableOpacity key={k} style={[styles.cat, cat === k && styles.catOn]} onPress={() => setCat(k)} activeOpacity={0.8}>
                <Text style={styles.catEmoji}>{v.emoji}</Text>
                <Text style={[styles.catText, cat === k && styles.catTextOn]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amount}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, '').slice(0, 7))}
              placeholder="0"
              placeholderTextColor={C.faint}
              keyboardType="number-pad"
              keyboardAppearance="dark"
            />
          </View>
          <View style={styles.quick}>
            {QUICK.map((q) => (
              <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => setAmount(String(q))}>
                <Text style={styles.quickText}>₹{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.note} value={note} onChangeText={setNote} placeholder="Note (optional), e.g. Auto to Toddy shop" placeholderTextColor={C.faint} keyboardAppearance="dark" maxLength={80} />
          <TouchableOpacity style={styles.save} onPress={save} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color={C.onLime} /> : <Text style={styles.saveText}>Add {amount ? `₹${Number(amount).toLocaleString('en-IN')}` : ''} {EXPENSE_CATS[cat].emoji}</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 12 },
  title: { fontFamily: F.display, color: C.text, fontSize: 18 },
  sub: { color: C.sub, fontSize: 13, marginTop: 4, marginBottom: 14 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cat: { width: '23.5%', alignItems: 'center', backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 10, marginBottom: 8 },
  catOn: { borderColor: C.lime, backgroundColor: C.lime + '22' },
  catEmoji: { fontSize: 22 },
  catText: { color: C.sub, fontSize: 12, fontWeight: '700', marginTop: 3 },
  catTextOn: { color: C.text },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  rupee: { color: C.sub, fontSize: 34, fontWeight: '700', marginRight: 4 },
  amount: { color: C.text, fontSize: 44, fontWeight: '900', minWidth: 80, textAlign: 'center' },
  quick: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  quickBtn: { backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14, marginHorizontal: 4 },
  quickText: { color: C.text, fontSize: 14, fontWeight: '700' },
  note: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, color: C.text, fontSize: 14, marginTop: 14 },
  save: { backgroundColor: C.lime, borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 12, overflow: 'hidden', borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  saveText: { color: C.onLime, fontSize: 16, fontWeight: '800' },
});
