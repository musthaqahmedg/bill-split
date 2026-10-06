import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { archiveBill, billToFlow, deleteBill, getBill, setPaid } from '../services/bills';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const money = (n) => 'Rs ' + Number((Number(n) || 0).toFixed(2)).toLocaleString('en-IN');

export default function BillDetailScreen({ billId, onBack, onDeleted, onEdit }) {
  const [bill, setBill] = useState(null);

  useEffect(() => {
    getBill(billId)
      .then(setBill)
      .catch((e) => Alert.alert('Error', e.message));
  }, [billId]);

  if (!bill) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
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
                <Text key={it.id} style={styles.line}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  back: { color: '#007AFF', fontSize: 16 },
  edit: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold' },
  meta: { color: '#999', fontSize: 14, marginTop: 4, marginBottom: 15 },
  list: { flex: 1 },
  summary: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 14, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: '#666', fontSize: 14 },
  sumTotal: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 8, marginTop: 4, marginBottom: 0 },
  sumBold: { fontSize: 16, fontWeight: 'bold' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10 },
  coveredCard: { borderColor: '#F5B8D0', backgroundColor: '#FFF5F9' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold' },
  pay: { fontSize: 22, fontWeight: 'bold', color: '#007AFF' },
  coveredPay: { fontSize: 18, fontWeight: 'bold', color: '#D6457F' },
  line: { color: '#555', fontSize: 14, marginBottom: 3 },
  paidBy: { color: '#D6457F', fontWeight: '600' },
  covering: { color: '#D6457F', fontSize: 14, fontWeight: '600', marginTop: 6 },
  settle: { backgroundColor: '#F4FBF6', borderRadius: 10, padding: 14, marginBottom: 15 },
  settleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settleTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E8E3E' },
  settleCount: { fontSize: 14, fontWeight: '600', color: '#1E8E3E' },
  barBg: { height: 8, backgroundColor: '#D7EEDD', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#34A853', borderRadius: 4 },
  settleNote: { color: '#555', fontSize: 13, marginTop: 8 },
  payRow: { flexDirection: 'row', marginTop: 10 },
  markBtn: { backgroundColor: '#34A853', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  markText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  remindBtn: { borderWidth: 1, borderColor: '#34A853', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  remindText: { color: '#1E8E3E', fontSize: 14, fontWeight: '600' },
  paidBtn: { backgroundColor: '#E3F6E8', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  paidText: { color: '#1E8E3E', fontSize: 14, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: 20, marginBottom: 30 },
  deleteText: { color: '#FF3B30', fontSize: 16 },
  archiveText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  archiveHint: { color: '#999', fontSize: 12, marginTop: 4 },
  archivedBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, padding: 12, marginBottom: 12 },
  archivedText: { fontSize: 15, fontWeight: '600', color: '#555' },
  unarchive: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
});