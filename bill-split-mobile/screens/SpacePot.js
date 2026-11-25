import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import PocketPicker from '../components/PocketPicker';
import { alertAfterSpend, getPartyPot, getPockets, potPayIn, setPartyPot, spendFromPocket } from '../services/pockets';
import { C, F } from '../services/theme';

// 🫙 Group pocket (Pockets Build 4): the squad fills one pot for a trip or house party.
// The host sets the target and ticks off who has paid in; friends can add their own on the invite website.
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const STICKER = { borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' };

export default function SpacePot({ party }) {
  const me = (party.party_members || []).find((m) => m.name === 'Me'); // the host
  const token = party.share_token;
  const [pot, setPot] = useState(null);
  const [edit, setEdit] = useState(false);
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [payFor, setPayFor] = useState(null); // { member_id, name }
  const [amount, setAmount] = useState('');
  const [ask, setAsk] = useState(null); // 💰 which of my pockets my own pay-in comes from

  const load = useCallback(() => getPartyPot(token).then(setPot).catch(() => setPot(null)), [token]);
  useEffect(() => { load(); }, [load]);

  if (!pot || !me) return null;
  const has = Number(pot.target) > 0;
  const people = pot.people || [];
  const each = has && people.length ? Math.ceil(pot.target / people.length) : 0;

  const saveTarget = async () => {
    try {
      await setPartyPot(token, me.id, target, note);
      setEdit(false);
      load();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };
  const payIn = async () => {
    const who = payFor;
    const amt = Number(amount);
    try {
      await potPayIn(token, me.id, who.member_id, amt);
      setPayFor(null);
      setAmount('');
      load();
      if (who.is_host) {
        const st = await getPockets().catch(() => null);
        if (st && st.setup && st.pockets.length) setAsk({ amount: amt, pockets: st.pockets });
      }
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };
  const undo = (p) => Alert.alert(`Clear ${p.name}'s pay-ins?`, `${inr(p.paid)} will be removed from the pot.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => potPayIn(token, me.id, p.member_id, -1).then(load).catch((e) => Alert.alert("Couldn't clear", e.message)) },
  ]);

  if (!has && !edit) {
    return (
      <TouchableOpacity style={styles.empty} onPress={() => setEdit(true)} activeOpacity={0.85}>
        <Text style={styles.emptyIcon}>🫙</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>START A GROUP POCKET</Text>
          <Text style={styles.emptySub}>Everyone chips in to one pot for the trip or party. See who's paid in.</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, STICKER]}>
      <View style={styles.top}>
        <Text style={styles.kicker}>🫙 GROUP POCKET{pot.note ? ` · ${pot.note.toUpperCase()}` : ''}</Text>
        <TouchableOpacity onPress={() => { setTarget(has ? String(Math.round(pot.target)) : ''); setNote(pot.note || ''); setEdit(!edit); }} hitSlop={8}>
          <Text style={styles.link}>{edit ? 'Close' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      {edit ? (
        <View style={{ marginTop: 8 }}>
          <View style={styles.inputRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput style={styles.input} value={target} onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="Target, e.g. 12000"
              placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
          </View>
          <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="What's it for? (Goa trip, villa, drinks…)" placeholderTextColor={C.faint} keyboardAppearance="dark" maxLength={80} />
          <TouchableOpacity style={styles.btn} onPress={saveTarget}><Text style={styles.btnText}>{Number(target) > 0 ? 'Save group pocket' : 'Remove group pocket'}</Text></TouchableOpacity>
        </View>
      ) : null}

      {has ? (
        <>
          <Text style={styles.big}>{inr(pot.paid)} <Text style={styles.of}>of {inr(pot.target)}</Text></Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, Math.round((pot.paid / pot.target) * 100))}%` }]} /></View>
          <Text style={styles.sub}>{pot.paid >= pot.target ? 'Pot is full 🎉' : `${inr(pot.target - pot.paid)} to go · about ${inr(each)} each`}</Text>

          {people.map((p) => {
            const done = each > 0 && p.paid >= each;
            return (
              <View key={p.member_id} style={styles.person}>
                <Text style={styles.name} numberOfLines={1}>{done ? '✅' : p.paid > 0 ? '🟡' : '⏳'} {p.is_host ? `${p.name} (you)` : p.name}</Text>
                <TouchableOpacity onLongPress={() => p.paid > 0 && undo(p)} onPress={() => setPayFor(p)} hitSlop={6}>
                  <Text style={[styles.paid, done && { color: C.lime }]}>{p.paid > 0 ? inr(p.paid) : 'Add'} ＋</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <Text style={styles.hint}>Tap ＋ when someone pays in. Long-press to clear. Friends can add their own on the invite link.</Text>

          {payFor ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.kicker}>{payFor.is_host ? 'YOU PAID IN' : `${payFor.name.toUpperCase()} PAID IN`}</Text>
              <View style={[styles.inputRow, { marginTop: 6 }]}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput style={styles.input} value={amount} autoFocus onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, '').slice(0, 7))} placeholder={String(each || '')}
                  placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={[styles.btn, { flex: 1, marginRight: 6 }, !(Number(amount) > 0) && { opacity: 0.45 }]} onPress={payIn} disabled={!(Number(amount) > 0)}>
                  <Text style={styles.btnText}>Add {amount ? inr(amount) : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: C.cardHi }]} onPress={() => { setPayFor(null); setAmount(''); }}>
                  <Text style={[styles.btnText, { color: C.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {ask ? (
        <PocketPicker
          visible amount={ask.amount} pockets={ask.pockets} title="Your pay-in comes from…"
          suggested={(ask.pockets.find((p) => p.name.toLowerCase() === 'going out') || {}).id}
          onPick={async (id) => {
            try { await spendFromPocket({ pocketId: id, amount: ask.amount, note: `Group pocket${pot.note ? ` · ${pot.note}` : ''}` }); alertAfterSpend(id, ask.amount); } catch (e) {}
            setAsk(null);
          }}
          onSkip={() => setAsk(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 20, padding: 14, marginTop: 12 },
  emptyIcon: { fontSize: 30, marginRight: 12 },
  emptyTitle: { fontFamily: F.pixel, color: C.text, fontSize: 12 },
  emptySub: { color: C.sub, fontSize: 13, marginTop: 3 },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 16, marginTop: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontFamily: F.pixel, color: C.sub, fontSize: 10, flex: 1 },
  link: { color: C.lime, fontSize: 14, fontWeight: '800' },
  big: { fontFamily: F.display, color: C.text, fontSize: 28, marginTop: 8 },
  of: { fontSize: 16, color: C.sub },
  track: { height: 10, borderRadius: 5, backgroundColor: C.cardHi, marginTop: 8, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: C.lime },
  sub: { color: C.sub, fontSize: 13, marginTop: 6, marginBottom: 6 },
  person: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border },
  name: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 10 },
  paid: { color: C.text, fontSize: 14, fontWeight: '900' },
  hint: { color: C.faint, fontSize: 12, marginTop: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 12 },
  rupee: { color: C.sub, fontSize: 18, fontWeight: '800' },
  input: { flex: 1, color: C.text, fontSize: 18, fontWeight: '900', paddingVertical: 10, marginLeft: 4 },
  noteInput: { backgroundColor: C.bg, borderRadius: 14, padding: 12, color: C.text, fontSize: 14, marginTop: 8 },
  btn: { backgroundColor: C.lime, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
});
