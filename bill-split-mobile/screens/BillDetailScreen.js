import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { applySelfClaims, archiveBill, billToFlow, deleteBill, dismissSelfClaims, getBill, getSelfClaims, setNote, setPaid, setPayer } from '../services/bills';
import { savedPaidMap, transfers } from '../services/settle';
import { getProfile } from '../services/profile';
import { show } from '../services/names';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import { C } from '../services/theme';
import ItemInfo from './ItemInfo';
import RecapCard from './RecapCard';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const money = (n) => 'Rs ' + Number((Number(n) || 0).toFixed(2)).toLocaleString('en-IN');

export default function BillDetailScreen({ billId, onBack, onDeleted, onEdit, onAddRound }) {
  const [bill, setBill] = useState(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [infoItem, setInfoItem] = useState(null); // "What's this?" pop-up
  const [myUpi, setMyUpi] = useState(''); // your UPI ID, added to Remind messages
  const [note, setNoteText] = useState(''); // a short note on the bill
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    getProfile().then((p) => setMyUpi((p && p.upi_id) || '')).catch(() => {});
  }, []);

  // 🙋 friends who tagged their own items on the share link
  const [picks, setPicks] = useState([]);
  useEffect(() => {
    getSelfClaims(billId).then(setPicks).catch(() => {});
  }, [billId]);

  useEffect(() => {
    getBill(billId)
      .then((b) => {
        setBill(b);
        setNoteText(b.note || '');
      })
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
        const total = it.item_claims.reduce((s, c) => s + (c.units || 1), 0) || 1;
        const units = claim.units || 1;
        return { ...it, ways: it.item_claims.length, units, totalUnits: total, counted: total !== it.item_claims.length, share: (Number(it.price) * units) / total, paidBy: claim.paid_by || pid };
      })
      .filter(Boolean);

  // Friends this person covered, and how much (incl. tax & service)
  const coversOf = (pid) => {
    const out = {};
    items.forEach((it) => {
      const ways = (it.item_claims || []).reduce((s, c) => s + (c.units || 1), 0) || 1;
      (it.item_claims || []).forEach((c) => {
        if (c.paid_by === pid && c.participant_id !== pid) {
          out[c.participant_id] = (out[c.participant_id] || 0) + ((Number(it.price) * (c.units || 1)) / ways) * ratio;
        }
      });
    });
    return Object.entries(out);
  };

  // ---- 💳 Settle up: who paid the bill → who pays whom ----
  const notPaidYet = bill.paid_mode === 'unpaid';
  const dues = Object.fromEntries(participants.map((p) => [p.name, Number(p.amount_due) || 0]));
  const moves = notPaidYet ? [] : transfers(dues, savedPaidMap(bill, participants));
  const byName = Object.fromEntries(participants.map((p) => [p.name, p]));
  const outOf = (name) => moves.filter((m) => m.from === name);
  const inOf = (name) => moves.filter((m) => m.to === name);
  const owes = (p) => outOf(p.name).length > 0;
  const toCollect = people.filter(owes);
  const paidList = toCollect.filter((p) => p.paid_at);
  const stillToCollect = moves.filter((m) => !(byName[m.from] && byName[m.from].paid_at)).reduce((s, m) => s + m.amount, 0);
  const who = (n) => (n === 'Me' ? 'you' : n);

  const markPayer = async (name) => {
    try {
      await setPayer(bill.id, participants, name, bill.total);
      setBill(await getBill(bill.id));
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };

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

  const remind = (p) => {
    const lines = outOf(p.name).map((m) =>
      m.to === 'Me'
        ? `${inr(m.amount)} to me${myUpi ? ` (UPI: ${myUpi})` : ''}`
        : `${inr(m.amount)} to ${m.to}`
    );
    Share.share({
      message: `Hey ${p.name}! 👋 For ${bill.title || 'last night'}, please pay ${lines.join(' and ')} 🙏`,
    });
  };

  // Guest link: friends open it in the browser, see their share and pay with UPI
  const shareLink = () =>
    Share.share({
      message: `🌙 ${bill.title || 'Our night out'}: see what you had and pay your share here 👇\nhttps://bill-split-flax.vercel.app/b/${bill.share_token}\n\nSomething wrong? Tap your name → 🙋 Tag what you had`,
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

  // Note: save only when it changed
  const noteChanged = note.trim() !== (bill.note || '');
  const saveNote = async () => {
    setSavingNote(true);
    try {
      await setNote(bill.id, note);
      setBill((b) => ({ ...b, note: note.trim() || null }));
    } catch (e) {
      Alert.alert("Couldn't save note", e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const startEdit = () => onEdit(billToFlow(bill), bill.id);
  const taggers = [...new Set(picks.map((p) => (participants.find((x) => x.id === p.participant_id) || {}).name).filter(Boolean))];
  const reviewPicks = () => onEdit(applySelfClaims(billToFlow(bill), bill, picks), bill.id, 'items');
  const dismissPicks = () =>
    Alert.alert('Ignore their picks?', 'The bill stays as it is.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Ignore', style: 'destructive', onPress: () => dismissSelfClaims(bill.id).then(() => setPicks([])).catch((e) => Alert.alert('Error', e.message)) },
    ]);

  const when = new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {archived && (
          <View style={styles.archivedBox}>
            <Text style={styles.archivedText}>📦 Archived</Text>
            <TouchableOpacity onPress={unarchive}>
              <Text style={styles.unarchive}>Move back to home</Text>
            </TouchableOpacity>
          </View>
        )}

        {taggers.length > 0 && !archived ? (
          <View style={styles.tagBox}>
            <Text style={styles.tagTitle}>🙋 {taggers.map(show).join(', ')} tagged what they had</Text>
            <Text style={styles.tagSub}>Review it, and the split updates with their picks. Nothing changes until you save.</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={styles.markBtn} onPress={reviewPicks}>
                <Text style={styles.markText}>Review & update</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.remindBtn} onPress={dismissPicks}>
                <Text style={styles.remindText}>Ignore</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>📝 Note</Text>
          <TextInput
          inputAccessoryViewID={DONE_ID}
            style={styles.noteInput}
            value={note}
            onChangeText={setNoteText}
            placeholder="e.g. Arun's birthday 🎂, pay by Sunday"
            placeholderTextColor={C.faint}
            keyboardAppearance="dark"
            multiline
            maxLength={300}
          />
          {noteChanged && (
            <TouchableOpacity style={styles.noteSave} onPress={saveNote} disabled={savingNote}>
              <Text style={styles.noteSaveText}>{savingNote ? 'Saving…' : 'Save note'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.recapBtn, styles.half]} onPress={shareLink}>
            <Text style={styles.recapText}>🔗 Share link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.recapBtn, styles.half, styles.recapAlt]} onPress={() => setRecapOpen(true)}>
            <Text style={styles.recapText}>🎉 Recap card</Text>
          </TouchableOpacity>
        </View>

        {!archived && (
          <TouchableOpacity style={styles.roundBtn} onPress={() => onAddRound(billToFlow(bill), bill.id)}>
            <Text style={styles.roundText}>➕ Add a round</Text>
            <Text style={styles.roundHint}>Scan another receipt from the same night</Text>
          </TouchableOpacity>
        )}

        {notPaidYet ? (
          <View style={styles.settle}>
            <Text style={styles.settleTitle}>⏳ Not paid yet</Text>
            <Text style={styles.settleNote}>Once the bill is paid, tap who paid it:</Text>
            <View style={styles.payerChips}>
              {participants.map((p) => (
                <TouchableOpacity key={p.id} style={styles.payerChip} onPress={() => markPayer(p.name)}>
                  <Text style={styles.payerChipText}>💳 {show(p.name)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : toCollect.length > 0 ? (
          <View style={styles.settle}>
            <View style={styles.settleTop}>
              <Text style={styles.settleTitle}>💸 Settle up</Text>
              <Text style={styles.settleCount}>{paidList.length} of {toCollect.length} paid</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(paidList.length / toCollect.length) * 100}%` }]} />
            </View>
            {moves.map((m) => {
              const done = byName[m.from] && byName[m.from].paid_at;
              return (
                <Text key={m.from + m.to} style={[styles.move, done && styles.moveDone]}>
                  {done ? '✅' : '⏳'} {show(m.from)} → {who(m.to)} · {inr(m.amount)}
                </Text>
              );
            })}
            <Text style={styles.settleNote}>
              {stillToCollect > 0 ? `${inr(stillToCollect)} still to settle` : "Everyone's settled 🎉"}
            </Text>
          </View>
        ) : null}

        <Text style={styles.tapHint}>Tap any item to see what it is 🔍</Text>

        {people.map((p) => {
          const mine = itemsOf(p.id);
          const covers = coversOf(p.id);
          const fullyCovered = mine.length > 0 && mine.every((it) => it.paidBy !== p.id);
          return (
            <View key={p.id} style={[styles.card, fullyCovered && styles.coveredCard]}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{show(p.name)}</Text>
                {fullyCovered && Number(p.amount_due) === 0
                  ? <Text style={styles.coveredPay}>Covered 💛</Text>
                  : <Text style={styles.pay}>{inr(p.amount_due)}</Text>}
              </View>

              {inOf(p.name).length > 0 ? (
                <Text style={styles.gets}>💳 Paid the bill · gets back {inr(inOf(p.name).reduce((a, m) => a + m.amount, 0))}</Text>
              ) : null}
              {outOf(p.name).map((m) => (
                <Text key={m.to} style={styles.owesLine}>→ {p.name === 'Me' ? 'You pay' : 'Pays'} {who(m.to)} {inr(m.amount)}</Text>
              ))}

              {mine.map((it) => (
                <Text key={it.id} style={styles.line} onPress={() => setInfoItem(it)}>
                  {it.quantity > 1 ? `${it.quantity} × ` : ''}{it.name}
                  {it.counted ? `  (had ${it.units} of ${it.totalUnits})` : it.ways > 1 ? `  (shared ${it.ways} ways)` : ''}  ·  {money(it.share)}
                  {it.paidBy !== p.id && nameOf[it.paidBy]
                    ? <Text style={styles.paidBy}>{`  ${show(nameOf[it.paidBy])} ${nameOf[it.paidBy] === 'Me' ? 'pay' : 'pays'} 💛`}</Text>
                    : null}
                </Text>
              ))}
              {mine.length === 0 && <Text style={styles.line}>Didn't claim anything</Text>}

              {covers.map(([fid, amt]) => (
                <Text key={fid} style={styles.covering}>
                  💛 Covering {show(nameOf[fid])}  ·  +{money(amt)}
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
                        <Text style={styles.markText}>{p.name === 'Me' ? "I've paid" : 'Mark paid'}</Text>
                      </TouchableOpacity>
                      {p.name !== 'Me' ? (
                        <TouchableOpacity style={styles.remindBtn} onPress={() => remind(p)}>
                          <Text style={styles.remindText}>Remind</Text>
                        </TouchableOpacity>
                      ) : null}
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
      <KeyboardDone />
    </KeyboardAvoidingView>
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
  coveredCard: { borderColor: C.pink, backgroundColor: '#2A1621' },
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
  tagBox: { backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.accent, borderRadius: 16, padding: 14, marginBottom: 15 },
  tagTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  tagSub: { color: C.sub, fontSize: 13, marginTop: 4 },
  move: { color: C.text, fontSize: 14, marginTop: 6 },
  moveDone: { color: C.faint, textDecorationLine: 'line-through' },
  payerChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  payerChip: { backgroundColor: C.green, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  payerChipText: { color: '#0B2A1F', fontSize: 14, fontWeight: '800' },
  gets: { color: C.green, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  owesLine: { color: C.amber, fontSize: 14, fontWeight: '700', marginBottom: 6 },
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
  actionRow: { flexDirection: 'row', marginBottom: 15 },
  half: { flex: 1, marginBottom: 0 },
  recapAlt: { backgroundColor: C.cardHi, marginLeft: 10 },
  roundBtn: { borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 15 },
  roundText: { color: C.accentSoft, fontSize: 16, fontWeight: '800' },
  roundHint: { color: C.faint, fontSize: 12, marginTop: 4 },
  noteBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 15 },
  noteTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 8 },
  noteInput: { color: C.text, fontSize: 15, minHeight: 40, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  noteSave: { alignSelf: 'flex-end', backgroundColor: C.accent, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, marginTop: 10 },
  noteSaveText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  tapHint: { color: C.faint, fontSize: 13, marginBottom: 10, textAlign: 'center' },
});