import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { billsForParty } from '../services/bills';
import { billBalance, spaceNet } from '../services/settle';
import { show } from '../services/names';
import PayUpiSheet from './PayUpiSheet';
import { C, F } from '../services/theme';

// 🗂️ Pieces of a Space: its bills (tap to open) and its money (spent so far vs the budget)
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const mine = (b) => {
  const me = (b.bill_participants || []).find((p) => p.name === 'Me');
  return me ? Number(me.amount_due) || 0 : 0;
};

function useSpaceBills(partyId) {
  const [bills, setBills] = useState(null);
  useEffect(() => {
    billsForParty(partyId).then(setBills).catch(() => setBills([]));
  }, [partyId]);
  return bills;
}

// 🤝 Everyone's total across all this Space's bills (one number per friend), with Pay with UPI
export function SpaceBalances({ partyId }) {
  const bills = useSpaceBills(partyId);
  const [pay, setPay] = useState(null);
  if (!bills || bills.length < 1) return null;
  const rows = spaceNet(bills);
  if (!rows.length) return null;
  const payee = (name) => {
    const b = bills.find((x) => (x.bill_participants || []).some((p) => p.name === name));
    const pt = b && b.bill_participants.find((p) => p.name === name);
    return { participantId: pt ? pt.id : null, shareToken: b ? b.share_token : null };
  };
  return (
    <View style={styles.money}>
      <Text style={styles.kicker}>IN THIS SPACE · ALL BILLS TOGETHER</Text>
      {rows.map((r) => (
        <View key={r.name} style={styles.netRow}>
          <Text style={styles.netText} numberOfLines={1}>
            {r.net > 0 ? `${show(r.name)} owes you ` : `You owe ${show(r.name)} `}
            <Text style={{ color: r.net > 0 ? C.lime : C.pink, fontWeight: '900' }}>{inr(Math.abs(r.net))}</Text>
          </Text>
          {r.net < 0 ? (
            <TouchableOpacity style={styles.payBtn} onPress={() => setPay({ to: r.name, amount: -r.net, ...payee(r.name) })} activeOpacity={0.85}>
              <Text style={styles.payText}>💸 Pay</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      <Text style={styles.netHint}>One payment per friend instead of one per bill.</Text>
      <PayUpiSheet
        visible={!!pay}
        onClose={() => setPay(null)}
        to={pay ? pay.to : ''}
        amount={pay ? pay.amount : 0}
        note="VibeOut Space"
        participantId={pay ? pay.participantId : null}
        shareToken={pay ? pay.shareToken : null}
        isCreator
      />
    </View>
  );
}

export function SpaceBills({ partyId, onOpenBill }) {
  const bills = useSpaceBills(partyId);
  if (!bills || !bills.length) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.kicker}>BILLS IN THIS SPACE · {bills.length}</Text>
      {bills.map((b) => {
        const bal = billBalance(b);
        const status = bal.open ? '⏳ Not paid yet' : bal.owed ? `${inr(bal.owed)} to collect` : bal.owe ? `You owe ${inr(bal.owe)}` : '✅ Settled';
        return (
          <TouchableOpacity key={b.id} style={styles.row} onPress={() => onOpenBill && onOpenBill(b.id)} disabled={!onOpenBill} activeOpacity={0.85}>
            <Text style={styles.emoji}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{b.restaurant || b.title || 'Bill'}</Text>
              <Text style={styles.meta} numberOfLines={1}>{inr(b.total)} · your share {inr(mine(b))} · {status}</Text>
            </View>
            <Text style={styles.go}>›</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SpaceMoney({ party }) {
  const bills = useSpaceBills(party.id);
  if (!bills) return null;
  const spent = bills.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const my = bills.reduce((s, b) => s + mine(b), 0);
  const budget = Number(party.budget) || 0;
  const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return (
    <View style={styles.money}>
      <Text style={styles.kicker}>SPENT IN THIS SPACE</Text>
      <View style={styles.moneyRow}>
        <Text style={styles.big}>{inr(spent)}</Text>
        <Text style={styles.meta}>{budget ? `of ${inr(budget)} budget` : `${bills.length} ${bills.length === 1 ? 'bill' : 'bills'}`}</Text>
      </View>
      {budget ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(3, pct)}%` }, spent > budget && { backgroundColor: C.red }]} />
        </View>
      ) : null}
      <Text style={styles.mine}>Your share so far: <Text style={{ color: C.lime }}>{inr(my)}</Text>{budget && spent > budget ? '  ·  over budget' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  emoji: { fontSize: 24, marginRight: 10 },
  name: { color: C.text, fontSize: 15, fontWeight: '800' },
  meta: { color: C.sub, fontSize: 13, marginTop: 2 },
  go: { color: C.faint, fontSize: 22, marginLeft: 8 },
  money: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginTop: 12, marginBottom: 4, borderWidth: 1, borderColor: C.border },
  moneyRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  big: { fontFamily: F.display, color: C.text, fontSize: 28 },
  track: { height: 8, borderRadius: 4, backgroundColor: C.cardHi, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', backgroundColor: C.lime, borderRadius: 4 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  netText: { flex: 1, color: C.text, fontSize: 15, fontWeight: '700' },
  payBtn: { backgroundColor: C.lime, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, marginLeft: 8 },
  payText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  netHint: { color: C.faint, fontSize: 13, marginTop: 10 },
  mine: { color: C.sub, fontSize: 14, fontWeight: '700', marginTop: 10 },
});
