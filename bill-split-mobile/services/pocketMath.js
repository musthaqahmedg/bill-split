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

// 🧾 After a bill scan: suggest the pocket from the place and what was on the bill
// (bar/pub/club or mostly drinks → Going Out, cafés/restaurants → Eating Out, cabs → Transport)
const GOING_OUT_WORDS = /\b(bar|pub|club|lounge|brew|brewery|tap ?room|toddy|night|disco|beer|wine)\b/i;
const TRANSPORT_WORDS = /\b(uber|ola|rapido|cab|taxi|auto|metro|fuel|petrol|parking)\b/i;
export function suggestBillPocket({ title = '', items = [] }, pockets) {
  const byName = (n) => pockets.find((p) => p.name.toLowerCase() === n);
  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const drinks = items.filter((i) => i.kind === 'alcohol').reduce((s, i) => s + (Number(i.price) || 0), 0);
  let want = 'eating out';
  if (TRANSPORT_WORDS.test(title)) want = 'transport';
  else if (GOING_OUT_WORDS.test(title) || (total > 0 && drinks / total >= 0.4)) want = 'going out';
  const hit = byName(want) || byName('going out') || byName('eating out') || pockets.find((p) => !p.is_savings);
  return hit ? hit.id : null;
}

// 🌙 Tonight Pocket: a slice of Going Out for one night. Only today's Going Out spends count.
export function tonightPocket(amount, goingOutSpends, now = new Date()) {
  const today = dayStr(now);
  const spent = (goingOutSpends || []).filter((e) => dayStr(new Date(e.spent_at)) === today).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const amt = Math.round(Number(amount) || 0);
  return { amount: amt, spent: Math.round(spent), left: amt - Math.round(spent), pct: amt ? Math.min(1, spent / amt) : 0 };
}

// 🎟️ Can I afford this event from Going Out (and tonight's slice, if one is set)?
export function canAfford(price, goingOutLeft, tonightLeft = null) {
  const p = Math.round(Number(price) || 0);
  const room = tonightLeft === null ? goingOutLeft : Math.min(goingOutLeft, tonightLeft);
  if (!(p > 0)) return { ok: true, free: true, short: 0, room };
  return { ok: room >= p, free: false, short: Math.max(0, p - room), room };
}
