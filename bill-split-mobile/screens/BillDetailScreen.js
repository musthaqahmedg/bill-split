import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { archiveBill, billToFlow, deleteBill, getBill, setPaid } from '../services/bills';
import { C } from '../services/theme';
import ItemInfo from './ItemInfo';
import RecapCard from './RecapCard';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const money = (n) => 'Rs ' + Number((Number(n) || 0).toFixed(2)).toLocaleString('en-IN');

export default function BillDetailScreen({ billId, onBack, onDeleted, onEdit }) {
  const [bill, setBill] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [infoItem, setInfoItem] = useState(null); // "What's this?" pop-up

  useEffect(() => {
    getBill(billId)
      .then(setBill)
      .catch((e) => Alert.alert('Error', e.message));
  }, [billId]);

  if (!bill) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={C.accentSoft} />
      </View>
    );
  }

  const items = bill.bill_items || [];
  const participants = bill.bill_participants || [];
  const people = [...participants].sort((a, b) => b.amount_due - a.amount_due);
  const nameOf = Object.fromEntries(participants.map((p) => [p.id, p.name]));
  const itemsTotal = items.reduce((s, it) => s + Number(it.price), 0);
  const extras = Number(bill.total) - itemsTotal;
  const ratio = itemsTotal > 0 ? Number(bill.total) / itemsTotal : 0; // share incl. tax & service

  // Items this person had, and who paid for their part
  const itemsOf = (pid) =>
    items
      .map((it) => {
        const claim = (it.item_claims || []).find((c) => c.participant_id === pid);
        if (!claim) return null;
        return { ...it, ways: it.item_claims.length, paidBy: claim.paid_by || pid };
      })
      .filter(Boolean);

  // Friends this person covered, and how much (incl. tax & service)
  const coversOf = (pid) => {
    const out = {};
    items.forEach((it) => {
      const ways = (it.item_claims || []).length || 1;
      (it.item_claims || []).forEach((c) => {
        if (c.paid_by === pid && c.participant_id !== pid) {
          out[c.participant_id] = (out[c.participant_id] || 0) + (Number(it.price) / ways) * ratio;
        }
      });
    });
    return Object.entries(out);
  };

  // ---- Settle up: who still owes you ----
  const owes = (p) => p.name !== 'Me' && Number(p.amount_due) > 0;
  const toCollect = people.filter(owes);
  const paidList = toCollect.filter((p) => p.paid_at);
  const stillToCollect = toCollect.filter((p) => !p.paid_at).reduce((s, p) => s + Number(p.amount_due), 0);

  const togglePaid = async (p) => {
    const paid = !p.paid_at;
    const stamp = paid ? new Date().toISOString() : null;
    // Update the screen straight away, then save
    setBill((b) => ({
      ...b,
      bill_participants: b.bill_participants.map((x) => (x.id === p.id ? { ...x, paid_at: stamp } : x)),
    }));
    try {
      await setPaid(p.id, paid);
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
      setBill((b) => ({
        ...b,
        bill_participants: b.bill_participants.map((x) => (x.id === p.id ? { ...x, paid_at: p.paid_at } : x)),
      }));
    }
  };

  const remind = (p) =>
    Share.share({
      message: `Hey ${p.name}! 👋 Your share for ${bill.title || 'last night'} is ${inr(p.amount_due)}. Please send it when you can 🙏`,
    });

  const confirmDelete = () =>
    Alert.alert('Delete this bill?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBill(bill.id);
            onDeleted();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);

  // Once anyone has paid, the bill is a money record: archive instead of delete
  const archived = bill.status === 'archived';
  const anyPaid = participants.some((p) => p.paid_at);

  const confirmArchive = () =>
    Alert.alert(
      'Archive this bill?',
      'It moves off your home screen into Archived. Nothing is deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await archiveBill(bill.id, true);
              onDeleted();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );

  const unarchive = async () => {
    try {
      await archiveBill(bill.id, false);
      setBill((b) => ({ ...b, status: 'split' }));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const startEdit = () => onEdit(billToFlow(bill), bill.id);

  const when = new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        {!archived && (
          <TouchableOpacity onPress={startEdit}>
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{bill.title || 'Night out'}</Text>
      <Text style={styles.meta}>
        {when}{bill.bill_no ? `  ·  Bill ${bill.bill_no}` : ''}
      </Text>

      <ScrollView style={styles.list}>
        {archived && (
          <View style={styles.archivedBox}>
            <Text style={styles.archivedText}>📦 Archived</Text>
            <TouchableOpacity onPress={unarchive}>
              <Text style={styles.unarchive}>Move back to home</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Items</Text>
            <Text style={styles.sumLabel}>{money(itemsTotal)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Tax, service & round-off</Text>
            <Text style={styles.sumLabel}>{money(extras)}</Text>
          </View>
          <View style={[styles.sumRow, styles.sumTotal]}>
            <Text style={styles.sumBold}>Bill total</Text>
            <Text style={styles.sumBold}>{money(bill.total)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.recapBtn} onPress={() => setRecapOpen(true)}>
          <Text style={styles.recapText}>🎉 Recap card</Text>
        </TouchableOpacity>

        {toCollect.length > 0 && (
          <View style={styles.settle}>
            <View style={styles.settleTop}>
              <Text style={styles.settleTitle}>💸 Settle up</Text>
              <Text style={styles.settleCount}>{paidList.length} of {toCollect.length} paid</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(paidList.length / toCollect.length) * 100}%` }]} />
            </View>
            <Text style={styles.settleNote}>
              {stillToCollect > 0 ? `${inr(stillToCollect)} still to collect` : "Everyone's paid 🎉"}
            </Text>
          </View>
        )}

        <Text style={styles.tapHint}>Tap any item to see what it is 🔍</Text>

        {people.map((p) => {
          const mine = itemsOf(p.id);
          const covers = coversOf(p.id);
          const fullyCovered = mine.length > 0 && mine.every((it) => it.paidBy !== p.id);
          return (
            <View key={p.id} style={[styles.card, fullyCovered && styles.coveredCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{p.name}</Text>
                {fullyCovered && Number(p.amount_due) === 0
                  ? <Text style={styles.coveredPay}>Covered 💛</Text>
                  : <Text style={styles.pay}>{inr(p.amount_due)}</Text>}
              </View>

              {mine.map((it) => (
                <Text key={it.id} style={styles.line} onPress={() => setInfoItem(it)}>
                  {it.quantity > 1 ? `${it.quantity} × ` : ''}{it.name}
                  {it.ways > 1 ? `  (shared ${it.ways} ways)` : ''}  ·  {money(Number(it.price) / it.ways)}
                  {it.paidBy !== p.id && nameOf[it.paidBy]
                    ? <Text style={styles.paidBy}>{`  ${nameOf[it.paidBy]} pays 💛`}</Text>
                    : null}
                </Text>
              ))}
              {mine.length === 0 && <Text style={styles.line}>Didn't claim anything</Text>}

              {covers.map(([fid, amt]) => (
                <Text key={fid} style={styles.covering}>
                  💛 Covering {nameOf[fid]}  ·  +{money(amt)}
                </Text>
              ))}

              {owes(p) && (
                <View style={styles.payRow}>
                  {p.paid_at ? (
                    <TouchableOpacity style={styles.paidBtn} onPress={() => togglePaid(p)}>
                      <Text style={styles.paidText}>✅ Paid</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.markBtn} onPress={() => togglePaid(p)}>
                        <Text style={styles.markText}>Mark paid</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.remindBtn} onPress={() => remind(p)}>
                        <Text style={styles.remindText}>Remind</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {archived ? null : anyPaid ? (
          <TouchableOpacity onPress={confirmArchive} style={styles.deleteBtn}>
            <Text style={styles.archiveText}>Archive this bill</Text>
            <Text style={styles.archiveHint}>Someone has paid, so this bill can't be deleted</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Delete this bill</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <RecapCard bill={bill} visible={recapOpen} onClose={() => setRecapOpen(false)} />
      <ItemInfo item={infoItem} onClose={() => setInfoItem(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  back: { color: C.accentSoft, fontSize: 16 },
  edit: { color: C.accentSoft, fontSize: 16, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: C.text },
  meta: { color: C.faint, fontSize: 14, marginTop: 4, marginBottom: 15 },
  list: { flex: 1 },
  summary: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: C.sub, fontSize: 14 },
  sumTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 4, marginBottom: 0 },
  sumBold: { fontSize: 16, fontWeight: '800', color: C.text },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  coveredCard: { borderColor: C.pink, backgroundColor: '#3A1532' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '800', color: C.text },
  pay: { fontSize: 22, fontWeight: '800', color: C.accentSoft },
  coveredPay: { fontSize: 18, fontWeight: '800', color: C.pink },
  line: { color: C.sub, fontSize: 14, marginBottom: 3 },
  paidBy: { color: C.pink, fontWeight: '600' },
  covering: { color: C.pink, fontSize: 14, fontWeight: '700', marginTop: 6 },
  settle: { backgroundColor: C.greenBg, borderRadius: 16, padding: 16, marginBottom: 15 },
  settleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settleTitle: { fontSize: 16, fontWeight: '800', color: C.green },
  settleCount: { fontSize: 14, fontWeight: '700', color: C.green },
  barBg: { height: 8, backgroundColor: '#1E5A44', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: C.green, borderRadius: 4 },
  settleNote: { color: C.sub, fontSize: 13, marginTop: 8 },
  payRow: { flexDirection: 'row', marginTop: 10 },
  markBtn: { backgroundColor: C.green, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  markText: { color: '#0B2A1F', fontSize: 14, fontWeight: '800' },
  remindBtn: { borderWidth: 1, borderColor: C.green, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  remindText: { color: C.green, fontSize: 14, fontWeight: '700' },
  paidBtn: { backgroundColor: C.greenBg, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  paidText: { color: C.green, fontSize: 14, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', paddingVertical: 20, marginBottom: 30 },
  deleteText: { color: C.red, fontSize: 16 },
  archiveText: { color: C.accentSoft, fontSize: 16, fontWeight: '700' },
  archiveHint: { color: C.faint, fontSize: 12, marginTop: 4 },
  archivedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 12 },
  archivedText: { fontSize: 15, fontWeight: '700', color: C.sub },
  unarchive: { color: C.accentSoft, fontSize: 15, fontWeight: '700' },
  recapBtn: { backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 15 },
  recapText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  tapHint: { color: C.faint, fontSize: 13, marginBottom: 10, textAlign: 'center' },
});