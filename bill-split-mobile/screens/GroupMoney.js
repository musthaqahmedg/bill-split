import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PayUpiSheet from './PayUpiSheet';
import { fmt, groupBalances, SETTLEMENT } from '../services/manualSplit';
import { asBalanceRow, deleteGroupExpense, groupPeople, listGroupExpenses, recordSettlement } from '../services/groupExpenses';
import { C, F } from '../services/theme';

// ✍️ Manual Split money for one group: your balance, settle up (fewest payments), everyone's numbers, all expenses.

const show = (n) => (n === 'Me' ? 'You' : n);
const CAT_EMOJI = { groceries: '🛒', food: '🍕', drinks: '🍻', fuel: '⛽', travel: '🚕', stay: '🏠', tickets: '🎟️', other: '✨', [SETTLEMENT]: '💸' };
const day = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export default function GroupMoney({ group, onAdd, onEdit, onCount }) {
  const [list, setList] = useState(null);
  const [pay, setPay] = useState(null); // { to, amount } when I'm paying someone
  const [busy, setBusy] = useState(false);
  const people = groupPeople(group);

  const load = useCallback(async () => {
    try {
      const l = await listGroupExpenses(group.id);
      setList(l);
      onCount && onCount(l.length);
    } catch (e) {
      setList([]);
    }
  }, [group.id]);
  useEffect(() => { load(); }, [load, group]);

  if (!list) return <ActivityIndicator style={{ marginVertical: 24 }} color={C.accentSoft} />;

  const rows = list.map(asBalanceRow);
  const bal = groupBalances(rows, people);
  const me = bal.people.find((p) => p.name === 'Me') || { paid: 0, share: 0, net: 0 };
  const hasSpend = rows.some((r) => r.category !== SETTLEMENT);

  const settle = (m) => {
    const line = m.to === 'Me' ? `${m.from} paid you ${fmt(m.amount)}?` : m.from === 'Me' ? `You paid ${m.to} ${fmt(m.amount)}?` : `${m.from} paid ${m.to} ${fmt(m.amount)}?`;
    Alert.alert('Mark as paid', line, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, paid', onPress: async () => {
          setBusy(true);
          try {
            await recordSettlement(group.id, m.from, m.to, m.amount);
            await load();
          } catch (e) {
            Alert.alert("Couldn't save", e.message);
          }
          setBusy(false);
        },
      },
    ]);
  };

  const undo = (x) =>
    Alert.alert('Undo this payment?', x.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: async () => { await deleteGroupExpense(x.id).catch(() => {}); load(); } },
    ]);

  const share = () => {
    const lines = [
      `${group.emoji || '👥'} ${group.name} — spent ${fmt(bal.spent)}`,
      '',
      ...(bal.moves.length ? bal.moves.map((m) => `• ${show(m.from) === 'You' ? 'I' : m.from} → ${m.to === 'Me' ? 'me' : m.to}: ${fmt(m.amount)}`) : ['All settled ✅']),
      '',
      'Split on VibeOut',
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <View>
      {/* Your balance */}
      <View style={styles.card}>
        <Text style={styles.kicker}>GROUP TOTAL · {fmt(bal.spent)}</Text>
        {me.net > 0 ? (
          <>
            <Text style={[styles.big, { color: C.lime }]}>{fmt(me.net)}</Text>
            <Text style={styles.bigSub}>you get back</Text>
          </>
        ) : me.net < 0 ? (
          <>
            <Text style={[styles.big, { color: C.pink }]}>{fmt(-me.net)}</Text>
            <Text style={styles.bigSub}>you owe</Text>
          </>
        ) : (
          <>
            <Text style={styles.big}>{!hasSpend ? '₹0' : bal.settled ? 'All settled ✅' : "You're settled ✅"}</Text>
            <Text style={styles.bigSub}>{!hasSpend ? 'add your first expense' : bal.settled ? 'nobody owes anything' : 'others still need to settle'}</Text>
          </>
        )}
        {hasSpend ? <Text style={styles.mine}>You paid {fmt(me.paid)} · your share {fmt(me.share)}</Text> : null}
      </View>

      <TouchableOpacity style={styles.add} onPress={() => onAdd(people)} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.addText}>＋ Add expense</Text>
      </TouchableOpacity>
      {people.length < 2 ? <Text style={styles.hint}>Add people to the group below to split with them.</Text> : null}

      {/* Settle up */}
      {bal.moves.length ? (
        <>
          <View style={styles.headRow}>
            <Text style={styles.label}>SETTLE UP · {bal.moves.length} {bal.moves.length === 1 ? 'payment' : 'payments'}</Text>
            <TouchableOpacity onPress={share} hitSlop={8}><Text style={styles.link}>Share</Text></TouchableOpacity>
          </View>
          <View style={styles.box}>
            {bal.moves.map((m, i) => (
              <View key={`${m.from}-${m.to}-${i}`} style={[styles.move, i > 0 && styles.line]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moveText}>
                    <Text style={styles.bold}>{show(m.from)}</Text> {m.from === 'Me' ? 'pay' : 'pays'} <Text style={styles.bold}>{show(m.to)}</Text>
                  </Text>
                  <Text style={[styles.moveAmt, { color: m.to === 'Me' ? C.lime : m.from === 'Me' ? C.pink : C.text }]}>{fmt(m.amount)}</Text>
                </View>
                {m.from === 'Me' ? (
                  <TouchableOpacity style={styles.payBtn} onPress={() => setPay({ to: m.to, amount: m.amount })}>
                    <Text style={styles.payText}>Pay UPI</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.paidBtn} onPress={() => settle(m)} disabled={busy}>
                  <Text style={styles.paidText}>{m.to === 'Me' ? 'Received' : 'Paid ✓'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Everyone's numbers */}
      {hasSpend ? (
        <>
          <Text style={styles.label}>EVERYONE</Text>
          <View style={styles.box}>
            {bal.people.map((p, i) => (
              <View key={p.name} style={[styles.person, i > 0 && styles.line]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{show(p.name)}</Text>
                  <Text style={styles.pSub}>paid {fmt(p.paid)} · share {fmt(p.share)}</Text>
                </View>
                <Text style={[styles.pNet, { color: p.net > 0 ? C.lime : p.net < 0 ? C.pink : C.faint }]}>
                  {p.net > 0 ? `gets ${fmt(p.net)}` : p.net < 0 ? `owes ${fmt(-p.net)}` : 'settled'}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* All expenses + payments */}
      {list.length ? (
        <>
          <Text style={styles.label}>EXPENSES · tap to edit</Text>
          <View style={styles.box}>
            {list.map((x, i) => {
              const isPay = x.category === SETTLEMENT;
              const r = rows[i];
              const payers = Object.keys(r.paid).map(show);
              const mine = r.shares.Me || 0;
              return (
                <TouchableOpacity key={x.id} style={[styles.exp, i > 0 && styles.line]} onPress={() => (isPay ? undo(x) : onEdit(x, people))} activeOpacity={0.7}>
                  <Text style={styles.expEmoji}>{CAT_EMOJI[x.category] || '🧾'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expTitle} numberOfLines={1}>{isPay ? x.title.replace(/^Me /, 'You ').replace(/ Me$/, ' you') : x.title}</Text>
                    <Text style={styles.expSub} numberOfLines={1}>
                      {day(x.bill_date)}{isPay ? ' · settle-up (tap to undo)' : ` · ${payers.join(' + ')} paid · ${Object.keys(r.shares).length} in`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.expAmt}>{fmt(x.total)}</Text>
                    {!isPay && mine ? <Text style={styles.expMine}>you {fmt(mine)}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      <PayUpiSheet
        visible={!!pay}
        onClose={() => setPay(null)}
        to={pay ? pay.to : ''}
        amount={pay ? pay.amount : 0}
        note={group.name}
        isCreator
        onPaid={async () => {
          const p = pay;
          setPay(null);
          if (!p) return;
          try {
            await recordSettlement(group.id, 'Me', p.to, p.amount);
            load();
          } catch (e) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 18, marginBottom: 12 },
  kicker: { fontFamily: F.pixel, color: C.sub, fontSize: 11 },
  big: { fontFamily: F.display, color: C.text, fontSize: 34, marginTop: 8 },
  bigSub: { color: C.sub, fontSize: 15, fontWeight: '700' },
  mine: { color: C.faint, fontSize: 13, marginTop: 8 },
  add: { backgroundColor: C.lime, borderRadius: 20, paddingVertical: 15, alignItems: 'center', marginBottom: 8 },
  addText: { fontFamily: F.display, color: C.onLime, fontSize: 17 },
  hint: { color: C.faint, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 14, marginBottom: 8 },
  link: { color: C.lime, fontSize: 14, fontWeight: '800' },
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 14, marginBottom: 6 },
  line: { borderTopWidth: 1, borderTopColor: C.border },
  move: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  moveText: { color: C.sub, fontSize: 15 },
  bold: { color: C.text, fontWeight: '800' },
  moveAmt: { fontFamily: F.display, fontSize: 18, marginTop: 2 },
  payBtn: { backgroundColor: C.pink, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginLeft: 8 },
  payText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  paidBtn: { borderWidth: 1, borderColor: C.lime, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginLeft: 8 },
  paidText: { color: C.lime, fontSize: 13, fontWeight: '900' },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  pName: { color: C.text, fontSize: 15, fontWeight: '800' },
  pSub: { color: C.faint, fontSize: 12, marginTop: 2 },
  pNet: { fontSize: 14, fontWeight: '900' },
  exp: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  expEmoji: { fontSize: 24, marginRight: 10 },
  expTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  expSub: { color: C.faint, fontSize: 12, marginTop: 2 },
  expAmt: { color: C.text, fontSize: 15, fontWeight: '900' },
  expMine: { color: C.sub, fontSize: 12, marginTop: 2 },
});
