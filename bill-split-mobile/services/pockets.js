import { supabase } from './supabaseClient';
import { billDate, myShare } from './money';
import { Alert } from 'react-native';
import { crossedAlert, cycleFor, leftoverFor, pocketBalances as balances, previousCycle } from './pocketMath';

export * from './pocketMath';

// ---------- database ----------

export async function getPockets() {
  const [{ data: setup, error: e1 }, { data: pockets, error: e2 }, { data: rolls, error: e3 }] = await Promise.all([
    supabase.from('pocket_setup').select('income, cycle, payday, rollover, lock, created_at').maybeSingle(),
    supabase.from('pockets').select('id, name, emoji, kind, amount, is_savings, sort').order('sort'),
    supabase.from('pocket_rollovers').select('cycle_start, amount'),
  ]);
  if (e1 || e2 || e3) throw e1 || e2 || e3;
  return { setup, pockets: pockets || [], rollovers: rolls || [] };
}

export async function pocketExpenses(sinceStr) {
  const { data, error } = await supabase
    .from('expenses').select('id, category, amount, note, spent_at, pocket_id')
    .not('pocket_id', 'is', null).gte('spent_at', sinceStr).order('spent_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return data || [];
}

// First-time setup: income, cycle, payday + the pocket list
export async function saveSetup({ income, cycle, payday, rollover = true }, pockets) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pocket_setup').upsert({
    user_id: user.id, income: Math.round(income), cycle, payday, rollover, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  if (pockets) {
    const keep = pockets.filter((p) => p.id).map((p) => p.id);
    const { data: old } = await supabase.from('pockets').select('id');
    const drop = (old || []).map((o) => o.id).filter((id) => !keep.includes(id));
    if (drop.length) await supabase.from('pockets').delete().in('id', drop);
    const rows = pockets.map((p, i) => ({
      ...(p.id ? { id: p.id } : {}),
      user_id: user.id, name: String(p.name).trim().slice(0, 40) || 'Pocket', emoji: p.emoji || '💰', kind: p.kind || 'variable',
      amount: Math.max(0, Math.round(Number(p.amount) || 0)), is_savings: !!p.is_savings, sort: i,
    }));
    const { error: e2 } = await supabase.from('pockets').upsert(rows);
    if (e2) throw e2;
  }
}

export async function spendFromPocket({ pocketId, amount, note }) {
  const { error } = await supabase.from('expenses').insert({
    category: 'pocket', amount: Math.round(Number(amount) || 0), note: (note || '').trim().slice(0, 80) || null, pocket_id: pocketId, // 'pocket' = everyday spend (rent, groceries…), kept out of the going-out tracker
  });
  if (error) throw error;
}

export async function removeSpend(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// 💸 Payday: when a new cycle starts, last cycle's leftovers move into Savings once
export async function rollOverIfNeeded(state, now = new Date()) {
  const { setup, pockets, rollovers } = state;
  if (!setup || !setup.rollover || !pockets.length) return null;
  const cyc = cycleFor(setup, now);
  if (rollovers.some((r) => r.cycle_start === cyc.startStr)) return null;
  const prev = previousCycle(setup, cyc);
  // nothing to roll before the user set up pockets
  const { data: s } = await supabase.from('pocket_setup').select('created_at').maybeSingle();
  if (!s || new Date(s.created_at) >= cyc.start) return null;
  const { spends } = await cycleSpends(prev.startStr);
  const amount = leftoverFor(pockets, spends, prev);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pocket_rollovers').insert({ user_id: user.id, cycle_start: cyc.startStr, amount });
  if (error && error.code !== '23505') throw error;
  return amount;
}

// ---------- Build 2: scanned-bill shares come out of a pocket ----------

// Tag (or untag) your share of a bill to a pocket
export async function tagBill(billId, pocketId) {
  if (!pocketId) {
    const { error } = await supabase.from('bill_pockets').delete().eq('bill_id', billId);
    if (error) throw error;
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('bill_pockets').upsert({ user_id: user.id, bill_id: billId, pocket_id: pocketId });
  if (error) throw error;
}

export async function billPocketOf(billId) {
  const { data } = await supabase.from('bill_pockets').select('pocket_id').eq('bill_id', billId).maybeSingle();
  return data ? data.pocket_id : null;
}

// Your real share of each scanned bill since a date (what you had, never an even split),
// returned like expenses so the pocket maths treats them the same. Untagged bills come back too.
export async function billShares(sinceStr) {
  const since = new Date(sinceStr + 'T00:00:00');
  const [{ data: bills, error: e1 }, { data: tags, error: e2 }] = await Promise.all([
    supabase.from('bills').select('id, title, bill_date, created_at, bill_participants(name, amount_due)').eq('kind', 'scan')
      .gte('created_at', new Date(since.getTime() - 40 * 86400000).toISOString()).order('created_at', { ascending: false }),
    supabase.from('bill_pockets').select('bill_id, pocket_id'),
  ]);
  if (e1 || e2) throw e1 || e2;
  const tagOf = Object.fromEntries((tags || []).map((t) => [t.bill_id, t.pocket_id]));
  return (bills || [])
    .map((b) => ({ id: `bill:${b.id}`, bill_id: b.id, bill: true, note: b.title || 'Bill', amount: myShare(b), spent_at: billDate(b).toISOString(), pocket_id: tagOf[b.id] || null }))
    .filter((r) => r.amount > 0 && new Date(r.spent_at) >= since);
}

// Everything that comes out of pockets this cycle: pocket spends + tagged bill shares
export async function cycleSpends(sinceStr) {
  const [exps, shares] = await Promise.all([pocketExpenses(sinceStr), billShares(sinceStr).catch(() => [])]);
  return { spends: [...exps, ...shares.filter((s) => s.pocket_id)], untagged: shares.filter((s) => !s.pocket_id) };
}

// ---------- Build 3: alerts and the optional pocket lock ----------

// Everything about your pockets right now, in one call
export async function pocketSnapshot() {
  const st = await getPockets();
  if (!st.setup) return { ...st, rows: [] };
  const cyc = cycleFor(st.setup);
  const { spends, untagged } = await cycleSpends(cyc.startStr);
  const roll = st.rollovers.reduce((a, r) => a + Number(r.amount || 0), 0);
  return { ...st, cyc, spends, untagged, ...balances(st.pockets, spends, cyc, roll) };
}

// ⚠️ After money comes out of a pocket: warn once when it drops below 20% or hits zero
export async function alertAfterSpend(pocketId, amount) {
  try {
    if (!pocketId) return;
    const snap = await pocketSnapshot();
    const after = snap.rows.find((r) => r.id === pocketId);
    if (!after) return;
    const left = after.left + Math.round(Number(amount) || 0);
    const before = { left, fill: after.budget ? Math.max(0, Math.min(1, left / after.budget)) : 0 };
    const a = crossedAlert(before, after);
    if (a) setTimeout(() => Alert.alert(a.kind === 'empty' ? 'Pocket empty' : 'Pocket running low ⚠️', a.text), 500);
  } catch (e) {}
}

export async function setPocketLock(on) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pocket_setup').update({ lock: !!on }).eq('user_id', user.id);
  if (error) throw error;
}

// 🔒 Pocket lock: before a ticket, a table booking or a new bill, warn if Going Out is empty.
// Resolves true to go ahead, false to stop. Never blocks people who haven't turned the lock on.
export async function goingOutGuard(what = 'this') {
  try {
    const { data: s } = await supabase.from('pocket_setup').select('lock').maybeSingle();
    if (!s || !s.lock) return true;
    const snap = await pocketSnapshot();
    const go = snap.rows.find((r) => r.name.toLowerCase() === 'going out');
    if (!go || go.left > 0) return true;
    return await new Promise((resolve) =>
      Alert.alert('🔒 Going Out is empty', `You've spent this cycle's Going Out pocket${go.left < 0 ? ` (₹${Math.round(-go.left).toLocaleString('en-IN')} over)` : ''}. Still go ahead with ${what}?`, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Go anyway', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) })
    );
  } catch (e) {
    return true;
  }
}
