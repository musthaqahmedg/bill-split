// 💰 Pockets = envelope budgeting. Every rupee of income goes into a pocket, spending comes out
// of a pocket, and you always see what's left this cycle. Private to you (row-level security).

export const POCKET_KINDS = {
  fixed: { label: 'Fixed', emoji: '📌' },
  variable: { label: 'Variable', emoji: '🔄' },
  goal: { label: 'Goals', emoji: '🎯' },
};

// Starting split of income (percent). Savings gets whatever rounding leaves over.
export const DEFAULT_POCKETS = [
  { name: 'Rent', emoji: '🏠', kind: 'fixed', pct: 30 },
  { name: 'Groceries', emoji: '🛒', kind: 'variable', pct: 12 },
  { name: 'Transport', emoji: '🚕', kind: 'variable', pct: 8 },
  { name: 'Phone & Internet', emoji: '📱', kind: 'fixed', pct: 4 },
  { name: 'Personal Care', emoji: '🧴', kind: 'variable', pct: 4 },
  { name: 'Eating Out', emoji: '🍽️', kind: 'variable', pct: 8 },
  { name: 'Going Out', emoji: '🪩', kind: 'variable', pct: 10 },
  { name: 'Unexpected', emoji: '🧯', kind: 'variable', pct: 6 },
  { name: 'Savings', emoji: '🐷', kind: 'goal', pct: 18, is_savings: true },
];

const pad = (n) => String(n).padStart(2, '0');
export const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const atDay = (y, m, day) => new Date(y, m, Math.min(day, daysIn(y, m)));

// The cycle that contains `now`: monthly from the payday date each month, or every 14 days from payday
export function cycleFor(setup, now = new Date()) {
  const pay = parseDay(setup.payday);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start;
  let end;
  if (setup.cycle === 'biweekly') {
    const k = Math.floor((today - pay) / (14 * 86400000));
    start = new Date(pay.getFullYear(), pay.getMonth(), pay.getDate() + 14 * k);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 14);
  } else {
    const day = pay.getDate();
    start = atDay(today.getFullYear(), today.getMonth(), day);
    if (start > today) start = atDay(today.getFullYear(), today.getMonth() - 1, day);
    end = atDay(start.getFullYear(), start.getMonth() + 1, day);
  }
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  const daysLeft = Math.round((end - today) / 86400000);
  return { start, end, startStr: dayStr(start), endStr: dayStr(end), label: `${fmt(start)} – ${fmt(last)}`, daysLeft };
}

export function previousCycle(setup, cycle) {
  const before = new Date(cycle.start.getFullYear(), cycle.start.getMonth(), cycle.start.getDate() - 1);
  return cycleFor(setup, before);
}

// Split the income across the default pockets; the amounts always add up to the income exactly
export function suggestAmounts(income, defs = DEFAULT_POCKETS) {
  const total = Math.max(0, Math.round(Number(income) || 0));
  const out = defs.map((d) => ({ ...d, amount: d.is_savings ? 0 : Math.floor((total * d.pct) / 100) }));
  const used = out.reduce((s, p) => s + p.amount, 0);
  const sav = out.find((p) => p.is_savings);
  if (sav) sav.amount = total - used;
  return out;
}

export const assigned = (pockets) => pockets.reduce((s, p) => s + (Math.round(Number(p.amount)) || 0), 0);
export const leftToAssign = (income, pockets) => Math.round(Number(income) || 0) - assigned(pockets);

const inCycle = (e, cycle) => {
  const d = new Date(e.spent_at);
  return d >= cycle.start && d < cycle.end;
};

// What's left in each pocket this cycle. `extra` = per-pocket spends from other places (Build 2: bill shares)
export function pocketBalances(pockets, expenses, cycle, rolloverTotal = 0) {
  const spentBy = {};
  for (const e of expenses || []) {
    if (!e.pocket_id || !inCycle(e, cycle)) continue;
    spentBy[e.pocket_id] = (spentBy[e.pocket_id] || 0) + (Number(e.amount) || 0);
  }
  const rows = pockets.map((p) => {
    const bonus = p.is_savings ? rolloverTotal : 0;
    const budget = (Number(p.amount) || 0) + bonus;
    const spent = Math.round(spentBy[p.id] || 0);
    const left = budget - spent;
    const fill = budget > 0 ? Math.max(0, Math.min(1, left / budget)) : 0;
    return { ...p, budget, spent, left, fill, low: budget > 0 && left > 0 && fill < 0.2, empty: budget > 0 && left <= 0 };
  });
  const total = rows.reduce((s, r) => s + r.budget, 0);
  const left = rows.reduce((s, r) => s + Math.max(0, r.left), 0);
  return { rows, total, left, spent: rows.reduce((s, r) => s + r.spent, 0) };
}

// Leftovers at the end of a cycle (fixed + variable pockets, not goals) that move into Savings
export function leftoverFor(pockets, expenses, cycle) {
  const { rows } = pocketBalances(pockets.filter((p) => p.kind !== 'goal' && !p.is_savings), expenses, cycle);
  return rows.reduce((s, r) => s + Math.max(0, r.left), 0);
}


// Quick Add category → the pocket it most likely comes out of (the user can change it)
const CAT_POCKET = { cab: 'transport', parking: 'transport', snacks: 'going out', drinks: 'going out', entry: 'going out', smoke: 'going out', gift: 'unexpected', other: null };
export function pocketFor(cat, pockets) {
  const want = CAT_POCKET[cat];
  const hit = want && pockets.find((p) => p.name.toLowerCase() === want);
  if (hit) return hit.id;
  const any = pockets.find((p) => p.name.toLowerCase() === 'unexpected') || pockets.find((p) => !p.is_savings);
  return any ? any.id : null;
}
