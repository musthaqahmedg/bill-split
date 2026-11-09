import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import KeyboardDone from './KeyboardDone';
import { fmt, paidBy, splitShares } from '../services/manualSplit';
import { deleteGroupExpense, saveGroupExpense } from '../services/groupExpenses';
import { C, F } from '../services/theme';

// ✍️ Add / edit one typed expense in a group: what, how much, who paid, when, who's in, how to split.

const CATS = [
  { key: 'groceries', emoji: '🛒', label: 'Groceries' },
  { key: 'food', emoji: '🍕', label: 'Food' },
  { key: 'drinks', emoji: '🍻', label: 'Drinks' },
  { key: 'fuel', emoji: '⛽', label: 'Fuel' },
  { key: 'travel', emoji: '🚕', label: 'Travel' },
  { key: 'stay', emoji: '🏠', label: 'Rent / Stay' },
  { key: 'tickets', emoji: '🎟️', label: 'Tickets' },
  { key: 'other', emoji: '✨', label: 'Other' },
];
const HOW = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: 'Exact ₹' },
  { key: 'percent', label: 'Percent %' },
];

const show = (n) => (n === 'Me' ? 'You' : n);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const yesterday = () => ymd(new Date(Date.now() - 86400000));
const prettyDate = (s) => {
  if (s === today()) return 'Today';
  if (s === yesterday()) return 'Yesterday';
  const d = new Date(`${s}T12:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Saved row → form values (for editing)
function fromSaved(x, people) {
  const ps = x.bill_participants || [];
  const inn = ps.filter((p) => Number(p.amount_due) > 0).map((p) => p.name);
  const payers = ps.filter((p) => Number(p.paid_amount) > 0);
  const method = x.split_method === 'custom' ? 'equal' : x.split_method || 'equal';
  return {
    title: x.title || '',
    category: x.category || null,
    amount: String(Number(x.total) || ''),
    date: x.bill_date || today(),
    note: x.note || '',
    how: method,
    inn: inn.length ? inn : people,
    payer: payers.length === 1 ? payers[0].name : 'Me',
    multi: payers.length > 1,
    paidInputs: payers.length > 1 ? Object.fromEntries(payers.map((p) => [p.name, String(Number(p.paid_amount))])) : {},
    inputs: method === 'exact' || method === 'percent'
      ? Object.fromEntries(ps.filter((p) => p.share_input !== null && p.share_input !== undefined).map((p) => [p.name, String(Number(p.share_input))]))
      : {},
  };
}

export default function AddExpenseScreen({ groupId, groupName, people, expense, onBack, onSaved }) {
  const start = useMemo(() => (expense ? fromSaved(expense, people) : null), [expense, people]);
  const [title, setTitle] = useState(start ? start.title : '');
  const [category, setCategory] = useState(start ? start.category : null);
  const [amount, setAmount] = useState(start ? start.amount : '');
  const [date, setDate] = useState(start ? start.date : today());
  const [showCal, setShowCal] = useState(false);
  const [note, setNote] = useState(start ? start.note : '');
  const [payer, setPayer] = useState(start ? start.payer : 'Me');
  const [multi, setMulti] = useState(start ? start.multi : false);
  const [paidInputs, setPaidInputs] = useState(start ? start.paidInputs : {});
  const [how, setHow] = useState(start ? start.how : 'equal');
  const [inn, setInn] = useState(start ? start.inn.filter((n) => people.includes(n)) : people);
  const [inputs, setInputs] = useState(start ? start.inputs : {});
  const [busy, setBusy] = useState(false);

  // keep the order of the group list
  const inList = people.filter((n) => inn.includes(n));
  const method = how === 'equal' ? (inList.length === people.length ? 'equal' : 'custom') : how;
  const split = splitShares({ total: amount, people: inList, method, inputs });
  const pay = paidBy({ total: amount, payers: multi ? paidInputs : { [payer]: null } });
  const ok = split.ok && pay.ok && !busy;

  const toggle = (n) => setInn((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const pickCat = (c) => {
    const was = CATS.find((x) => x.key === category);
    setCategory(c.key === category ? null : c.key);
    if (!title.trim() || (was && title === was.label)) setTitle(c.key === category ? '' : c.label);
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert('What was it for?', 'e.g. Groceries, Fuel, Airbnb');
    if (!ok) return;
    setBusy(true);
    try {
      const keepInputs = how === 'equal' ? {} : Object.fromEntries(inList.map((n) => [n, inputs[n]]));
      await saveGroupExpense({
        id: expense ? expense.id : null,
        groupId, title, total: Number(String(amount).replace(/[,₹\s]/g, '')), date, note, category,
        method, shares: split.shares, inputs: keepInputs, paid: pay.paid,
      });
      onSaved();
    } catch (e) {
      setBusy(false);
      Alert.alert("Couldn't save", e.message);
    }
  };

  const remove = () => {
    Alert.alert('Delete this expense?', 'Balances update straight away.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteGroupExpense(expense.id);
            onSaved();
          } catch (e) {
            Alert.alert("Couldn't delete", e.message);
          }
        },
      },
    ]);
  };

  const unit = how === 'percent' ? '%' : '₹';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{expense ? 'Edit expense' : 'Add expense'}</Text>
        {groupName ? <Text style={styles.sub}>in {groupName}</Text> : null}

        {/* What */}
        <Text style={styles.label}>What for</Text>
        <View style={styles.chips}>
          {CATS.map((c) => (
            <TouchableOpacity key={c.key} style={[styles.chip, category === c.key && styles.chipOn]} onPress={() => pickCat(c)}>
              <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.emoji} {c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={60}
          placeholder="Groceries, Fuel, Airbnb…" placeholderTextColor={C.faint} keyboardAppearance="dark" />

        {/* How much */}
        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountBox}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput style={styles.amount} value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint} keyboardAppearance="dark" />
        </View>

        {/* Who paid */}
        <Text style={styles.label}>Paid by</Text>
        <View style={styles.chips}>
          {people.map((n) => (
            <TouchableOpacity key={n} style={[styles.chip, !multi && payer === n && styles.chipOn]} onPress={() => { setMulti(false); setPayer(n); }}>
              <Text style={[styles.chipText, !multi && payer === n && styles.chipTextOn]}>{show(n)}</Text>
            </TouchableOpacity>
          ))}
          {people.length > 1 ? (
            <TouchableOpacity style={[styles.chip, multi && styles.chipOn]} onPress={() => setMulti(!multi)}>
              <Text style={[styles.chipText, multi && styles.chipTextOn]}>👥 Several people</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {multi ? (
          <View style={styles.box}>
            {people.map((n) => (
              <View key={n} style={styles.row}>
                <Text style={styles.rowName}>{show(n)}</Text>
                <Text style={styles.unit}>₹</Text>
                <TextInput style={styles.small} value={paidInputs[n] || ''} keyboardType="decimal-pad" placeholder="0"
                  placeholderTextColor={C.faint} keyboardAppearance="dark"
                  onChangeText={(t) => setPaidInputs({ ...paidInputs, [n]: t.replace(/[^0-9.,]/g, '') })} />
              </View>
            ))}
            {amount && !pay.ok ? <Text style={styles.warn}>{pay.error}</Text> : null}
          </View>
        ) : null}

        {/* When */}
        <Text style={styles.label}>When</Text>
        <View style={styles.chips}>
          <TouchableOpacity style={[styles.chip, date === today() && styles.chipOn]} onPress={() => { setDate(today()); setShowCal(false); }}>
            <Text style={[styles.chipText, date === today() && styles.chipTextOn]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, date === yesterday() && styles.chipOn]} onPress={() => { setDate(yesterday()); setShowCal(false); }}>
            <Text style={[styles.chipText, date === yesterday() && styles.chipTextOn]}>Yesterday</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, date !== today() && date !== yesterday() && styles.chipOn]} onPress={() => setShowCal(!showCal)}>
            <Text style={[styles.chipText, date !== today() && date !== yesterday() && styles.chipTextOn]}>
              📅 {date !== today() && date !== yesterday() ? prettyDate(date) : 'Pick a date'}
            </Text>
          </TouchableOpacity>
        </View>
        {showCal ? (
          <View style={Platform.OS === 'ios' ? styles.calBox : null}>
            <DateTimePicker
              value={new Date(`${date}T12:00:00`)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              themeVariant="dark"
              accentColor={C.lime}
              onChange={(ev, d) => {
                if (Platform.OS !== 'ios') setShowCal(false);
                if (ev.type !== 'dismissed' && d) setDate(ymd(d));
              }}
            />
            {Platform.OS === 'ios' ? (
              <TouchableOpacity style={styles.calDone} onPress={() => setShowCal(false)}>
                <Text style={styles.calDoneText}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* How to split */}
        <Text style={styles.label}>Split</Text>
        <View style={styles.seg}>
          {HOW.map((h) => (
            <TouchableOpacity key={h.key} style={[styles.segBtn, how === h.key && styles.segOn]} onPress={() => setHow(h.key)}>
              <Text style={[styles.segText, how === h.key && styles.segTextOn]}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>Tap a name to leave them out of this expense</Text>
        <View style={styles.box}>
          {people.map((n) => {
            const on = inn.includes(n);
            const share = split.ok ? split.shares[n] : null;
            return (
              <View key={n} style={[styles.row, !on && { opacity: 0.45 }]}>
                <TouchableOpacity style={styles.tick} onPress={() => toggle(n)} hitSlop={6} accessibilityLabel={`${on ? 'Remove' : 'Add'} ${show(n)}`}>
                  <Text style={styles.tickText}>{on ? '✅' : '⬜'}</Text>
                </TouchableOpacity>
                <Text style={styles.rowName} onPress={() => toggle(n)}>{show(n)}</Text>
                {on && how !== 'equal' ? (
                  <>
                    <Text style={styles.unit}>{unit}</Text>
                    <TextInput style={styles.small} value={inputs[n] || ''} keyboardType="decimal-pad" placeholder="0"
                      placeholderTextColor={C.faint} keyboardAppearance="dark"
                      onChangeText={(t) => setInputs({ ...inputs, [n]: t.replace(/[^0-9.,]/g, '') })} />
                  </>
                ) : null}
                <Text style={styles.share}>{on && share ? fmt(share) : on ? '—' : 'out'}</Text>
              </View>
            );
          })}
          {amount && !split.ok ? <Text style={styles.warn}>{split.error}</Text> : null}
        </View>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} maxLength={200}
          placeholder="e.g. Big Bazaar run" placeholderTextColor={C.faint} keyboardAppearance="dark" />

        <TouchableOpacity style={[styles.save, !ok && styles.saveOff]} onPress={save} disabled={!ok} accessibilityRole="button">
          {busy ? <ActivityIndicator color={C.onLime} /> : <Text style={styles.saveText}>{expense ? 'Save changes' : 'Add expense'}</Text>}
        </TouchableOpacity>
        {expense ? (
          <TouchableOpacity style={styles.del} onPress={remove}>
            <Text style={styles.delText}>Delete expense</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  body: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 80 },
  back: { color: C.lime, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  title: { fontFamily: F.display, color: C.text, fontSize: 30 },
  sub: { color: C.sub, fontSize: 15, fontWeight: '600', marginTop: 2 },
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 22, marginBottom: 8 },
  hint: { color: C.faint, fontSize: 12, marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { color: C.text, fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: C.onLime },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16 },
  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 16 },
  rupee: { fontFamily: F.display, color: C.lime, fontSize: 30, marginRight: 6 },
  amount: { flex: 1, fontFamily: F.display, color: C.text, fontSize: 32, paddingVertical: 12 },
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  tick: { marginRight: 8 },
  tickText: { fontSize: 20 },
  rowName: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700' },
  unit: { color: C.sub, fontSize: 15, marginRight: 4 },
  small: { width: 80, backgroundColor: C.cardHi, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: C.text, fontSize: 15, textAlign: 'right', marginRight: 10 },
  share: { width: 86, textAlign: 'right', color: C.lime, fontSize: 15, fontWeight: '800' },
  warn: { color: C.amber, fontSize: 14, fontWeight: '700', paddingVertical: 10 },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: C.border },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  segOn: { backgroundColor: C.lime },
  segText: { color: C.sub, fontSize: 14, fontWeight: '800' },
  segTextOn: { color: C.onLime },
  calBox: { backgroundColor: C.card, borderRadius: 18, marginTop: 6, paddingBottom: 8 },
  calDone: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  calDoneText: { color: C.lime, fontSize: 16, fontWeight: '800' },
  save: { backgroundColor: C.lime, borderRadius: 20, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  saveOff: { backgroundColor: C.disabled },
  saveText: { fontFamily: F.display, color: C.onLime, fontSize: 17 },
  del: { alignItems: 'center', paddingVertical: 16 },
  delText: { color: C.red, fontSize: 15, fontWeight: '700' },
});
