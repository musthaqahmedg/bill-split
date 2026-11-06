import { supabase } from './supabaseClient';
import { track } from './track';
import { SETTLEMENT, settlementExpense } from './manualSplit';

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

export async function deleteGroupExpense(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}

// "Rohan paid me ₹500" → saved as a settle-up row
export async function recordSettlement(groupId, from, to, amount) {
  const s = settlementExpense(from, to, amount);
  return saveGroupExpense({ groupId, title: s.title, total: s.total, category: SETTLEMENT, paid: s.paid, shares: s.shares, date: new Date().toISOString().slice(0, 10) });
}
