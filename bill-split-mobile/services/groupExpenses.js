import { supabase } from './supabaseClient';
import { track } from './track';
import { SETTLEMENT, groupBalances, settlementExpense } from './manualSplit';

// ✍️ Manual Split: typed expenses inside a friend group.
// Each expense is saved as a bill with kind = 'manual' and no items, so UPI pay,
// share links and "I've paid" keep working. "Me" is you, like on scanned bills.

const FIELDS = 'id, title, total, bill_date, category, split_method, note, created_at, paid_mode, share_token, bill_participants(id, name, amount_due, paid_amount, share_input)';

// Everyone in the group, you first
export function groupPeople(group) {
  const names = (group && group.group_members ? group.group_members : []).map((m) => m.name).filter((n) => n && n !== 'Me');
  return ['Me', ...new Set(names)];
}

export async function listGroupExpenses(groupId) {
  const { data, error } = await supabase
    .from('bills')
    .select(FIELDS)
    .eq('group_id', groupId)
    .eq('kind', 'manual')
    .order('bill_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Saved row → { total, paid, shares, category } for groupBalances()
export function asBalanceRow(b) {
  const ps = b.bill_participants || [];
  const paid = {};
  const shares = {};
  ps.forEach((p) => {
    if (Number(p.paid_amount) > 0) paid[p.name] = Number(p.paid_amount);
    if (Number(p.amount_due) > 0) shares[p.name] = Number(p.amount_due);
  });
  return { id: b.id, title: b.title, total: Number(b.total) || 0, paid, shares, category: b.category };
}

const modeOf = (paid) => {
  const names = Object.keys(paid);
  if (names.length > 1) return 'multi';
  return names[0] === 'Me' ? 'me' : 'friend';
};

// Add or edit one expense.
//   e = { id?, groupId, title, total, date ('YYYY-MM-DD'), note, category, method, shares: {name: ₹}, inputs: {name: typed}, paid: {name: ₹} }
export async function saveGroupExpense(e) {
  const row = {
    title: (e.title || '').trim().slice(0, 60) || 'Expense',
    total: Number(e.total) || 0,
    bill_date: e.date || null,
    note: (e.note || '').trim().slice(0, 200) || null,
    category: e.category || null,
    split_method: e.category === SETTLEMENT ? null : e.method || 'equal',
    paid_mode: modeOf(e.paid),
    status: 'split',
    kind: 'manual',
    group_id: e.groupId,
  };
  let billId = e.id;
  if (billId) {
    const { error } = await supabase.from('bills').update(row).eq('id', billId);
    if (error) throw error;
    // simplest safe edit: replace who-paid / who-shares rows
    const { error: d } = await supabase.from('bill_participants').delete().eq('bill_id', billId);
    if (d) throw d;
  } else {
    const { data, error } = await supabase.from('bills').insert(row).select('id').single();
    if (error) throw error;
    billId = data.id;
    track('split', e.category === SETTLEMENT ? 'recorded a settle-up' : 'added a manual expense');
  }
  const names = [...new Set([...Object.keys(e.shares || {}), ...Object.keys(e.paid || {})])];
  const inputs = e.inputs || {};
  const { error: e3 } = await supabase.from('bill_participants').insert(
    names.map((name) => ({
      bill_id: billId,
      name,
      amount_due: (e.shares && e.shares[name]) || 0,
      paid_amount: (e.paid && e.paid[name]) || 0,
      share_input: inputs[name] === '' || inputs[name] === undefined || inputs[name] === null || Number.isNaN(Number(inputs[name])) ? null : Number(inputs[name]),
    }))
  );
  if (e3) throw e3;
  return billId;
}

// 💰 For the Me page: your share of group expenses (as spends) + where you stand in each group
export async function myGroupMoney() {
  const { data, error } = await supabase
    .from('bills')
    .select('id, title, total, bill_date, created_at, category, group_id, friend_groups(id, name, emoji), bill_participants(name, amount_due, paid_amount)')
    .eq('kind', 'manual')
    .not('group_id', 'is', null)
    .limit(1000);
  if (error) throw error;
  const rows = data || [];
  const spends = rows
    .filter((b) => b.category !== SETTLEMENT)
    .map((b) => {
      const me = (b.bill_participants || []).find((p) => p.name === 'Me');
      return { id: `split-${b.id}`, spent_at: `${b.bill_date || String(b.created_at).slice(0, 10)}T12:00:00`, amount: me ? Number(me.amount_due) || 0 : 0, category: 'split', note: b.title };
    })
    .filter((x) => x.amount > 0);
  const byGroup = {};
  rows.forEach((b) => {
    const g = b.friend_groups || { id: b.group_id, name: 'Group', emoji: '👥' };
    (byGroup[g.id] = byGroup[g.id] || { group: g, list: [] }).list.push(asBalanceRow(b));
  });
  const groups = Object.values(byGroup)
    .map(({ group, list }) => {
      const me = groupBalances(list).people.find((p) => p.name === 'Me');
      return { id: group.id, name: group.name, emoji: group.emoji || '👥', net: me ? me.net : 0 };
    })
    .filter((g) => Math.abs(g.net) >= 0.01)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  return {
    spends,
    groups,
    owed: groups.filter((g) => g.net > 0).reduce((s, g) => s + g.net, 0),
    owe: groups.filter((g) => g.net < 0).reduce((s, g) => s - g.net, 0),
  };
}

export async function deleteGroupExpense(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}

// "Rohan paid me ₹500" → saved as a settle-up row
export async function recordSettlement(groupId, from, to, amount) {
  const s = settlementExpense(from, to, amount);
  return saveGroupExpense({ groupId, title: s.title, total: s.total, category: SETTLEMENT, paid: s.paid, shares: s.shares, date: new Date().toISOString().slice(0, 10) });
}
