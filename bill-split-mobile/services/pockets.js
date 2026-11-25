import { supabase } from './supabaseClient';
import { cycleFor, leftoverFor, previousCycle } from './pocketMath';

export * from './pocketMath';

// ---------- database ----------

export async function getPockets() {
  const [{ data: setup, error: e1 }, { data: pockets, error: e2 }, { data: rolls, error: e3 }] = await Promise.all([
    supabase.from('pocket_setup').select('income, cycle, payday, rollover').maybeSingle(),
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
  const exps = await pocketExpenses(prev.startStr);
  const amount = leftoverFor(pockets, exps, prev);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('pocket_rollovers').insert({ user_id: user.id, cycle_start: cyc.startStr, amount });
  if (error && error.code !== '23505') throw error;
  return amount;
}
