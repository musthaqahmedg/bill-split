import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { saveBill, updateBill } from '../services/bills';
import { paidMap, transfers } from '../services/settle';
import { computeSplit } from '../services/splitEngine';
import { show } from '../services/names';
import { C } from '../services/theme';
import BillSteps from './BillSteps';

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const money = (n) => '₹' + Number(n.toFixed(2)).toLocaleString('en-IN');

export default function SplitScreen({
  items, people, nonDrinkers = [], pairs = [], claims, payers = [], onPayersChange, bill, editingBillId, onBack, onDone,
  payment = { mode: 'me' }, onPaymentChange = () => {}, partyId = null,
}) {
  const [saving, setSaving] = useState(false);
  const [coverFor, setCoverFor] = useState(null); // the friend being covered
  const [sponsor, setSponsor] = useState(null);   // who is covering them
  const [picked, setPicked] = useState([]);       // which of their items (by index)
  const [wholeOpen, setWholeOpen] = useState(false);

  // Pairs: who is this person paired with?
  const partnerOf = (name) => {
    const pr = pairs.find((x) => x.a === name || x.b === name);
    return pr ? (pr.a === name ? pr.b : pr.a) : null;
  };

  // 🧮 All the maths lives in the tested split engine
  const { itemsTotal, billTotal, extras, target, shares, covering, finalOf, sum } = computeSplit({ items, people, claims, payers, bill });
  const final = people.map((n) => finalOf[n]);

  const rows = shares
    .map((s) => ({ ...s, pay: finalOf[s.name], covers: covering[s.name] }))
    .sort((a, b) => b.pay - a.pay);

  // ---- 💳 Who paid the bill → who pays whom ----
  // a payer who was removed from the table no longer counts
  const mode = payment.mode === 'friend' && !people.includes(payment.who) ? 'friend-missing' : payment.mode || 'me';
  const paid = paidMap(payment, people, target);
  const paidSum = Object.values(paid).reduce((a, b) => a + b, 0);
  const multiLeft = mode === 'multi' ? target - paidSum : 0;
  const moves = mode === 'unpaid' || mode === 'friend-missing' || (mode === 'multi' && multiLeft !== 0) ? [] : transfers(finalOf, paid);
  const outOf = (n) => moves.filter((m) => m.from === n);
  const inOf = (n) => moves.filter((m) => m.to === n);
  const pickPayer = (key) => {
    if (key === 'unpaid' || key === 'multi') onPaymentChange({ mode: key, who: null, amounts: key === 'multi' ? payment.amounts || {} : {} });
    else if (key === 'Me') onPaymentChange({ mode: 'me', who: null, amounts: {} });
    else onPaymentChange({ mode: 'friend', who: key, amounts: {} });
  };
  const payerKey = mode === 'me' ? 'Me' : mode === 'friend' ? payment.who : mode === 'friend-missing' ? null : mode;
  const setMultiAmount = (n, v) =>
    onPaymentChange({ ...payment, amounts: { ...(payment.amounts || {}), [n]: v.replace(/[^\d]/g, '') } });

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
    if (mode === 'friend-missing') return Alert.alert('Who paid?', 'Pick who paid the bill.');
    if (mode === 'multi' && multiLeft !== 0) {
      return Alert.alert('Amounts don’t match', `What everyone paid should add up to ${inr(target)} (${multiLeft > 0 ? inr(multiLeft) + ' missing' : inr(-multiLeft) + ' too much'}).`);
    }
    setSaving(true);
    try {
      const payload = {
        bill: { ...bill, total: billTotal }, items, people, nonDrinkers, claims, payers, amounts: finalOf,
        paidMode: payment.mode || 'me', paid, partyId,
      };
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
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <BillSteps at={4} />
      <Text style={styles.title}>The split 🎉</Text>
      <Text style={styles.tagline}>No awkward maths. Everyone pays for what they had.</Text>
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
        {/* 💳 Who paid the bill? */}
        <View style={styles.paidBox}>
          <Text style={styles.paidTitle}>💳 Who paid the bill?</Text>
          <View style={styles.chips}>
            {people.map((p) => (
              <TouchableOpacity key={p} style={[styles.payChip, payerKey === p && styles.payChipOn]} onPress={() => pickPayer(p)}>
                <Text style={[styles.payChipText, payerKey === p && styles.payChipTextOn]}>{show(p)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.payChip, mode === 'unpaid' && styles.payChipOn]} onPress={() => pickPayer('unpaid')}>
              <Text style={[styles.payChipText, mode === 'unpaid' && styles.payChipTextOn]}>⏳ Not yet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.payChip, mode === 'multi' && styles.payChipOn]} onPress={() => pickPayer('multi')}>
              <Text style={[styles.payChipText, mode === 'multi' && styles.payChipTextOn]}>👥 More than one</Text>
            </TouchableOpacity>
          </View>
          {mode === 'multi' ? (
            <View style={{ marginTop: 6 }}>
              {people.map((p) => (
                <View key={p} style={styles.multiRow}>
                  <Text style={styles.multiName}>{show(p)} paid</Text>
                  <Text style={styles.multiRs}>Rs</Text>
                  <TextInput
                    style={styles.multiInput}
                    keyboardType="number-pad"
                    keyboardAppearance="dark"
                    value={String((payment.amounts || {})[p] || '')}
                    onChangeText={(v) => setMultiAmount(p, v)}
                    placeholder="0"
                    placeholderTextColor={C.faint}
                  />
                </View>
              ))}
              <Text style={[styles.multiLeft, multiLeft === 0 && { color: C.green }]}>
                {multiLeft === 0 ? `✓ Adds up to ${inr(target)}` : multiLeft > 0 ? `${inr(multiLeft)} left to add` : `${inr(-multiLeft)} too much`}
              </Text>
            </View>
          ) : (
            <Text style={styles.paidHint}>
              {mode === 'unpaid'
                ? 'Not paid yet: everyone hands over their share below.'
                : mode === 'me'
                  ? 'You paid, so friends pay you back 👇'
                  : mode === 'friend' ? `${payment.who} paid, so everyone pays ${payment.who} back 👇` : 'Pick who paid 👆'}
            </Text>
          )}
        </View>

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
                <Text style={styles.name}>
                  {show(r.name)}{nonDrinkers.includes(r.name) ? ' 🥤' : ''}
                </Text>
                {fullyCovered && r.pay === 0
                  ? <Text style={styles.coveredPay}>Covered 💛</Text>
                  : <Text style={styles.pay}>{inr(r.pay)}</Text>}
              </View>

              {/* who pays whom */}
              {inOf(r.name).length > 0 ? (
                <Text style={styles.gets}>💳 Paid the bill · gets back {inr(inOf(r.name).reduce((a, m) => a + m.amount, 0))}</Text>
              ) : null}
              {outOf(r.name).map((m) => (
                <Text key={m.to} style={styles.owes}>→ Pays {m.to === 'Me' ? 'you' : m.to} {inr(m.amount)}</Text>
              ))}
              {mode === 'unpaid' && r.pay > 0 ? <Text style={styles.owes}>⏳ Hands over {inr(r.pay)}</Text> : null}
              {paid[r.name] && !inOf(r.name).length && mode !== 'unpaid' ? <Text style={styles.gets}>💳 Paid their share ✓</Text> : null}

              {partnerOf(r.name) && (
                <Text style={styles.pairTag}>💑 with {partnerOf(r.name)}</Text>
              )}

              {r.mine.length === 0 && <Text style={styles.line}>Didn't claim anything</Text>}

              {r.mine.map((m, j) => (
                <Text key={j} style={styles.line}>
                  {m.qty > 1 ? `${m.qty} × ` : ''}{m.name}
                  {m.counted ? `  (had ${m.units} of ${m.totalUnits})` : m.ways > 1 ? `  (shared ${m.ways} ways)` : ''}  ·  {money(m.amount)}
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
        <Text style={styles.wholeText}>🎁 It's a treat (one person pays for all)</Text>
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
                  <Text style={[styles.chipText, sponsor === p && styles.chipTextOn]}>{show(p)}</Text>
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
            <Text style={styles.sheetTitle}>Who's treating everyone? 🎁</Text>
            {people.map((p) => (
              <TouchableOpacity key={p} style={styles.wholeRow} onPress={() => wholeBill(p)}>
                <Text style={styles.wholeName}>{show(p)}</Text>
                <Text style={styles.wholeAmt}>{inr(billTotal)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.wholeRow} onPress={resetAll}>
              <Text style={styles.resetText}>Everyone pays their own</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.wholeCancel} onPress={() => setWholeOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: C.text },
  tagline: { color: C.accentSoft, fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 4 },
  hint: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 15 },
  summary: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: C.sub, fontSize: 14 },
  sumValue: { color: C.sub, fontSize: 14 },
  sumTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 4, marginBottom: 0 },
  sumBold: { fontSize: 16, fontWeight: '800', color: C.text },
  list: { flex: 1 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 10 },
  coveredCard: { borderColor: C.pink, backgroundColor: '#2A1621' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '800', color: C.text },
  pay: { fontSize: 22, fontWeight: '800', color: C.accentSoft },
  coveredPay: { fontSize: 18, fontWeight: '800', color: C.pink },
  pairTag: { color: C.pink, fontSize: 13, fontWeight: '700', marginTop: -4, marginBottom: 6 },
  line: { color: C.sub, fontSize: 14, marginBottom: 3 },
  paidBy: { color: C.pink, fontWeight: '600' },
  extra: { color: C.faint, fontSize: 13, marginTop: 4 },
  covering: { color: C.pink, fontSize: 14, fontWeight: '700', marginTop: 6 },
  check: { color: C.green, textAlign: 'center', marginVertical: 10, fontWeight: '700' },
  paidBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.accent, borderRadius: 16, padding: 14, marginBottom: 12 },
  paidTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  payChip: { borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  payChipOn: { backgroundColor: C.accent, borderColor: C.accent },
  payChipText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  payChipTextOn: { color: '#fff' },
  paidHint: { color: C.faint, fontSize: 13, marginTop: 2 },
  multiRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  multiName: { flex: 1, color: C.text, fontSize: 15 },
  multiRs: { color: C.faint, fontSize: 14, marginRight: 6 },
  multiInput: { width: 100, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, color: C.text, fontSize: 15, textAlign: 'right' },
  multiLeft: { color: C.amber, fontSize: 13, fontWeight: '700', marginTop: 4 },
  gets: { color: C.green, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  owes: { color: C.amber, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  wholeBtn: { borderWidth: 1, borderColor: C.pink, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 10 },
  wholeText: { color: C.pink, fontSize: 16, fontWeight: '800' },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 14, color: C.text },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 6 },
  sheetSub: { fontSize: 15, fontWeight: '700', color: C.sub },
  link: { color: C.accentSoft, fontSize: 15, fontWeight: '700' },
  sheetList: { maxHeight: 280 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: C.pink, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.pink },
  chipText: { color: C.pink, fontSize: 14 },
  chipTextOn: { color: '#0E0E13', fontWeight: '700' },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: C.pink, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  boxOn: { backgroundColor: C.pink },
  tick: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  pickName: { flex: 1, fontSize: 15, color: C.text },
  pickAmt: { fontSize: 15, color: C.sub },
  sheetButtons: { flexDirection: 'row', marginTop: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginRight: 10 },
  cancelText: { color: C.sub, fontSize: 16, fontWeight: '700' },
  doneBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', backgroundColor: C.pink },
  wholeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  wholeName: { fontSize: 17, fontWeight: '700', color: C.text },
  wholeAmt: { fontSize: 17, color: C.pink, fontWeight: '700' },
  resetText: { fontSize: 16, color: C.accentSoft },
  wholeCancel: { padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginTop: 12 },
});