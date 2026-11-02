import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { saveBudget, setBudgetWarn } from '../services/budget';
import { C, F, STICK } from '../services/theme';

// 🎯 SET A BUDGET (new UX): Tonight · This week · This month, quick amounts, warn at 80%
const TABS = [
  { key: 'tonight', label: 'Tonight', picks: [500, 1000, 1500, 2000] },
  { key: 'week', label: 'This week', picks: [2000, 3000, 5000, 8000] },
  { key: 'month', label: 'This month', picks: [5000, 10000, 15000, 25000] },
];
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function SetBudgetSheet({ visible, onClose, onSaved, budgets, initialTab = 'tonight' }) {
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState('');
  const [warn, setWarn] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
    setWarn(budgets ? budgets.warn !== false : true);
  }, [visible]);
  useEffect(() => {
    const v = budgets ? budgets[tab] : 0;
    setDraft(v ? String(v) : '');
  }, [tab, visible]);

  const t = TABS.find((x) => x.key === tab);
  const save = async (amount) => {
    setSaving(true);
    try {
      await saveBudget(tab, amount);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet}>
            <Text style={styles.title}>SET A BUDGET</Text>
            <View style={styles.tabs}>
              {TABS.map((x) => (
                <TouchableOpacity key={x.key} style={[styles.tab, tab === x.key && styles.tabOn]} onPress={() => setTab(x.key)} activeOpacity={0.85}>
                  <Text style={[styles.tabText, tab === x.key && { color: C.onLime }]}>{x.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.amount}
                value={draft}
                onChangeText={(v) => setDraft(v.replace(/[^0-9]/g, '').slice(0, 8))}
                placeholder="0"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
                keyboardAppearance="dark"
              />
            </View>
            <Text style={styles.label}>I'LL SPEND UP TO</Text>
            <View style={styles.picks}>
              {t.picks.map((p) => (
                <TouchableOpacity key={p} style={[styles.pick, draft === String(p) && styles.pickOn]} onPress={() => setDraft(String(p))} activeOpacity={0.85}>
                  <Text style={[styles.pickText, draft === String(p) && { color: C.onLime }]}>{p.toLocaleString('en-IN')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.warnRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.warnTitle}>⚠️ Warn me at 80%</Text>
                <Text style={styles.warnSub}>A heads-up at 80% and when it's used up</Text>
              </View>
              <Switch value={warn} trackColor={{ true: C.lime, false: C.border }} onValueChange={(v) => { setWarn(v); setBudgetWarn(v).catch(() => {}); }} />
            </View>
            <TouchableOpacity style={styles.save} onPress={() => save(draft)} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'SET BUDGET'}</Text>
            </TouchableOpacity>
            {budgets && budgets[tab] ? (
              <TouchableOpacity onPress={() => save(0)} hitSlop={8}>
                <Text style={styles.remove}>Remove {t.label.toLowerCase()} budget ({inr(budgets[tab])})</Text>
              </TouchableOpacity>
            ) : null}
            {tab === 'tonight' ? <Text style={styles.note}>Tonight's budget resets at midnight.</Text> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 38 },
  title: { fontFamily: F.display, color: C.text, fontSize: 24, marginBottom: 14 },
  tabs: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 16, padding: 4 },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.lime },
  tabText: { color: C.sub, fontSize: 14, fontWeight: '800' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  rupee: { fontFamily: F.display, color: C.lime, fontSize: 40, marginRight: 4 },
  amount: { fontFamily: F.display, color: C.text, fontSize: 48, minWidth: 120, textAlign: 'center', padding: 0 },
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, textAlign: 'center', marginTop: 4 },
  picks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  pick: { flex: 1, marginHorizontal: 3, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  pickOn: { backgroundColor: C.lime, borderColor: C.lime },
  pickText: { color: C.text, fontSize: 14, fontWeight: '800' },
  warnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  warnTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  warnSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  save: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 18, ...STICK },
  saveText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  remove: { color: C.pink, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  note: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
