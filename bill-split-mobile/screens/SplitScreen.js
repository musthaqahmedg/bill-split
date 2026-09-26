import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { saveBill, updateBill } from '../services/bills';

const inr = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
const money = (n) => 'Rs ' + Number(n.toFixed(2)).toLocaleString('en-IN');

export default function SplitScreen({
  items, people, claims, payers = [], onPayersChange, bill, editingBillId, onBack, onDone,
}) {
  const [saving, setSaving] = useState(false);
  const [coverFor, setCoverFor] = useState(null); // the friend being covered
  const [sponsor, setSponsor] = useState(null);   // who is covering them
  const [picked, setPicked] = useState([]);       // which of their items (by index)
  const [wholeOpen, setWholeOpen] = useState(false);

  const payerOf = (i, name) => {
    const p = payers[i] && payers[i][name];
    return p && people.includes(p) ? p : name;
  };

  const itemsTotal = items.reduce((s, it) => s + it.price, 0);
  const billTotal = bill && bill.total > 0
    ? bill.total
    : itemsTotal + (bill?.tax || 0) + (bill?.service_charge || 0) - (bill?.discount || 0);
  const extras = billTotal - itemsTotal; // tax + service - discount + round-off
  const withExtras = (amt) => (itemsTotal > 0 ? amt + extras * (amt / itemsTotal) : 0);

  // What each person had
  const shares = people.map((name) => {
    const mine = [];
    items.forEach((it, i) => {
      const who = claims[i] || [];
      if (who.includes(name)) {
        mine.push({
          i, name: it.name, qty: it.qty,
          amount: it.price / who.length, ways: who.length,
          paidBy: payerOf(i, name),
        });
      }
    });
    const subtotal = mine.reduce((s, m) => s + m.amount, 0);
    return { name, mine, subtotal, ownExact: withExtras(subtotal) };
  });

  // What each person actually pays: their own uncovered items + anything they cover
  const payExact = Object.fromEntries(people.map((n) => [n, 0]));
  const covering = Object.fromEntries(people.map((n) => [n, {}]));
  shares.forEach((s) => s.mine.forEach((m) => {
    const amt = withExtras(m.amount);
    payExact[m.paidBy] += amt;
    if (m.paidBy !== s.name) covering[m.paidBy][s.name] = (covering[m.paidBy][s.name] || 0) + amt;
  }));

  // Round to whole rupees so everyone adds up exactly to the bill
  const target = Math.round(billTotal);
  const exacts = people.map((n) => payExact[n]);
  const final = exacts.map((e) => Math.floor(e));
  let left = target - final.reduce((a, b) => a + b, 0);
  exacts
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach((o) => { if (left > 0) { final[o.i] += 1; left -= 1; } });
  const finalOf = Object.fromEntries(people.map((n, i) => [n, final[i]]));

  const rows = shares
    .map((s) => ({ ...s, pay: finalOf[s.name], covers: covering[s.name] }))
    .sort((a, b) => b.pay - a.pay);
  const sum = final.reduce((a, b) => a + b, 0);

  // ---- Sponsor sheet ----
  const mineOf = (name) => (shares.find((s) => s.name === name) || { mine: [] }).mine;

  const chooseSponsor = (sp, name) => {
    setSponsor(sp);
    if (!sp) { setPicked([]); return; }
    const idx = mineOf(name).map((m) => m.i);
    const already = idx.filter((i) => payers[i] && payers[i][name] === sp);
    setPicked(already.length ? already : idx.filter((i) => !(payers[i] && payers[i][name])));
  };

  const openCover = (name) => {
    const idx = mineOf(name).map((m) => m.i);
    if (!idx.length) return;
    const current = idx.map((i) => payers[i] && payers[i][name]).find(Boolean) || null;
    setCoverFor(name);
    chooseSponsor(current, name);
  };

  const closeCover = () => { setCoverFor(null); setSponsor(null); setPicked([]); };

  const togglePick = (i) =>
    setPicked((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const applyCover = () => {
    const idx = mineOf(coverFor).map((m) => m.i);
    const next = items.map((_, i) => {
      const m = { ...(payers[i] || {}) };
      if (!idx.includes(i)) return m;
      if (!sponsor) { delete m[coverFor]; return m; }
      if (picked.includes(i)) m[coverFor] = sponsor;
      else if (m[coverFor] === sponsor) delete m[coverFor];
      return m;
    });
    onPayersChange(next);
    closeCover();
  };

  const wholeBill = (p) => {
    onPayersChange(items.map((_, i) =>
      Object.fromEntries((claims[i] || []).filter((n) => n !== p).map((n) => [n, p]))
    ));
    setWholeOpen(false);
  };

  const resetAll = () => {
    onPayersChange(items.map(() => ({})));
    setWholeOpen(false);
  };

  // ---- Save ----
  const save = async () => {
    setSaving(true);
    try {
      const payload = { bill: { ...bill, total: billTotal }, items, people, claims, payers, amounts: finalOf };
      if (editingBillId) {
        await updateBill(editingBillId, payload);
        Alert.alert('Updated! ✏️', 'Your changes are saved.', [{ text: 'OK', onPress: onDone }]);
      } else {
        await saveBill(payload);
        Alert.alert('Saved! 🎉', 'You can find this bill on your home screen.', [{ text: 'OK', onPress: onDone }]);
      }
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const coverItems = coverFor ? mineOf(coverFor) : [];
  const allPicked = coverItems.length > 0 && coverItems.every((m) => picked.includes(m.i));

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>The split 🎉</Text>
      <Text style={styles.hint}>Tap someone to have a friend cover them 💛</Text>

      <View style={styles.summary}>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Items</Text>
          <Text style={styles.sumValue}>{money(itemsTotal)}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Tax, service & round-off</Text>
          <Text style={styles.sumValue}>{money(extras)}</Text>
        </View>
        <View style={[styles.sumRow, styles.sumTotal]}>
          <Text style={styles.sumBold}>Bill total</Text>
          <Text style={styles.sumBold}>{money(billTotal)}</Text>
        </View>
      </View>

      <ScrollView style={styles.list}>
        {rows.map((r) => {
          const extra = r.ownExact - r.subtotal;
          const fullyCovered = r.mine.length > 0 && r.mine.every((m) => m.paidBy !== r.name);
          const coverList = Object.entries(r.covers);
          return (
            <TouchableOpacity
              key={r.name}
              style={[styles.card, fullyCovered && styles.coveredCard]}
              onPress={() => openCover(r.name)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <Text style={styles.name}>{r.name}</Text>
                {fullyCovered && r.pay === 0
                  ? <Text style={styles.coveredPay}>Covered 💛</Text>
                  : <Text style={styles.pay}>{inr(r.pay)}</Text>}
              </View>

              {r.mine.length === 0 && <Text style={styles.line}>Didn't claim anything</Text>}

              {r.mine.map((m, j) => (
                <Text key={j} style={styles.line}>
                  {m.qty > 1 ? `${m.qty} × ` : ''}{m.name}
                  {m.ways > 1 ? `  (shared ${m.ways} ways)` : ''}  ·  {money(m.amount)}
                  {m.paidBy !== r.name ? <Text style={styles.paidBy}>{`  ${m.paidBy} pays 💛`}</Text> : null}
                </Text>
              ))}

              {r.mine.length > 0 && (
                <Text style={styles.extra}>
                  {extra >= 0 ? '+' : '−'} {money(Math.abs(extra))} share of tax & service
                </Text>
              )}

              {coverList.map(([friend, amt]) => (
                <Text key={friend} style={styles.covering}>
                  💛 Covering {friend}  ·  +{money(amt)}
                </Text>
              ))}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.check}>
        Everyone adds up to {inr(sum)} {sum === target ? '✓' : ''}
      </Text>

      <TouchableOpacity style={styles.wholeBtn} onPress={() => setWholeOpen(true)}>
        <Text style={styles.wholeText}>🎉 I've got the whole bill</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>{editingBillId ? 'Save changes' : 'Save bill'}</Text>}
      </TouchableOpacity>

      {/* Who's covering this friend? */}
      <Modal visible={!!coverFor} transparent animationType="slide" onRequestClose={closeCover}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Who's covering {coverFor}?</Text>

            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !sponsor && styles.chipOn]}
                onPress={() => chooseSponsor(null, coverFor)}
              >
                <Text style={[styles.chipText, !sponsor && styles.chipTextOn]}>Nobody</Text>
              </TouchableOpacity>
              {people.filter((p) => p !== coverFor).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, sponsor === p && styles.chipOn]}
                  onPress={() => chooseSponsor(p, coverFor)}
                >
                  <Text style={[styles.chipText, sponsor === p && styles.chipTextOn]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {sponsor && (
              <>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetSub}>Which items?</Text>
                  <TouchableOpacity
                    onPress={() => setPicked(allPicked ? [] : coverItems.map((m) => m.i))}
                  >
                    <Text style={styles.link}>{allPicked ? 'Clear' : 'Everything'}</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.sheetList}>
                  {coverItems.map((m) => {
                    const on = picked.includes(m.i);
                    return (
                      <TouchableOpacity key={m.i} style={styles.pickRow} onPress={() => togglePick(m.i)}>
                        <View style={[styles.box, on && styles.boxOn]}>
                          {on && <Text style={styles.tick}>✓</Text>}
                        </View>
                        <Text style={styles.pickName}>
                          {m.qty > 1 ? `${m.qty} × ` : ''}{m.name}
                        </Text>
                        <Text style={styles.pickAmt}>{money(m.amount)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <View style={styles.sheetButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeCover}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} onPress={applyCover}>
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Whole bill */}
      <Modal visible={wholeOpen} transparent animationType="slide" onRequestClose={() => setWholeOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Who's paying the whole bill? 🎉</Text>
            {people.map((p) => (
              <TouchableOpacity key={p} style={styles.wholeRow} onPress={() => wholeBill(p)}>
                <Text style={styles.wholeName}>{p}</Text>
                <Text style={styles.wholeAmt}>{inr(billTotal)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.wholeRow} onPress={resetAll}>
              <Text style={styles.resetText}>Everyone pays their own</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 10 }]} onPress={() => setWholeOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold' },
  hint: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 15 },
  summary: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 14, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: '#666', fontSize: 14 },
  sumValue: { color: '#666', fontSize: 14 },
  sumTotal: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 8, marginTop: 4, marginBottom: 0 },
  sumBold: { fontSize: 16, fontWeight: 'bold' },
  list: { flex: 1 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  coveredCard: { borderColor: '#F5B8D0', backgroundColor: '#FFF5F9' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold' },
  pay: { fontSize: 22, fontWeight: 'bold', color: '#007AFF' },
  coveredPay: { fontSize: 18, fontWeight: 'bold', color: '#D6457F' },
  line: { color: '#555', fontSize: 14, marginBottom: 3 },
  paidBy: { color: '#D6457F', fontWeight: '600' },
  extra: { color: '#999', fontSize: 13, marginTop: 4 },
  covering: { color: '#D6457F', fontSize: 14, fontWeight: '600', marginTop: 6 },
  check: { color: '#34A853', textAlign: 'center', marginVertical: 10, fontWeight: '600' },
  wholeBtn: { borderWidth: 1, borderColor: '#D6457F', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 10 },
  wholeText: { color: '#D6457F', fontSize: 16, fontWeight: 'bold' },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 14 },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 },
  sheetSub: { fontSize: 15, fontWeight: '600', color: '#555' },
  link: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  sheetList: { maxHeight: 280 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#D6457F', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: '#D6457F' },
  chipText: { color: '#D6457F', fontSize: 14 },
  chipTextOn: { color: '#fff' },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: '#D6457F', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  boxOn: { backgroundColor: '#D6457F' },
  tick: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pickName: { flex: 1, fontSize: 15, color: '#333' },
  pickAmt: { fontSize: 15, color: '#555' },
  sheetButtons: { flexDirection: 'row', marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', marginRight: 10 },
  cancelText: { color: '#555', fontSize: 16, fontWeight: '600' },
  doneBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#D6457F' },
  wholeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  wholeName: { fontSize: 17, fontWeight: '600' },
  wholeAmt: { fontSize: 17, color: '#D6457F', fontWeight: '600' },
  resetText: { fontSize: 16, color: '#007AFF' },
});