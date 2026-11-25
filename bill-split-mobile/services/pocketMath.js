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
export function pocketBalances(pockets, expenses, cycle, rolloverTotal = 0, moves = []) {
  // ↔️ money moved between pockets this cycle (quick-move, round-ups) shifts their budgets
  const moved = {};
  for (const m of moves || []) {
    const d = new Date(m.created_at);
    if (d < cycle.start || d >= cycle.end) continue;
    const a = Number(m.amount) || 0;
    if (m.from_pocket) moved[m.from_pocket] = (moved[m.from_pocket] || 0) - a;
    if (m.to_pocket) moved[m.to_pocket] = (moved[m.to_pocket] || 0) + a;
  }
  const spentBy = {};
  for (const e of expenses || []) {
    if (!e.pocket_id || !inCycle(e, cycle)) continue;
    spentBy[e.pocket_id] = (spentBy[e.pocket_id] || 0) + (Number(e.amount) || 0);
  }
  const rows = pockets.map((p) => {
    const bonus = (p.is_savings ? rolloverTotal : 0) + Math.round(moved[p.id] || 0);
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
export function leftoverFor(pockets, expenses, cycle, moves = []) {
  const { rows } = pocketBalances(pockets.filter((p) => p.kind !== 'goal' && !p.is_savings), expenses, cycle, 0, moves);
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

// ---------- Build 3: coaching ----------
const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// 📈 Forecast: at this pace, when does the pocket run out? (null = it lasts the cycle)
export function forecast(row, cycle, now = new Date()) {
  if (!row || row.kind === 'goal' || row.is_savings || !(row.spent > 0) || !(row.left > 0)) return null;
  const daysIn = Math.max(1, Math.round((startOfDay(now) - cycle.start) / DAY) + 1);
  const perDay = row.spent / daysIn;
  const daysToEmpty = Math.floor(row.left / perDay);
  const runOut = new Date(startOfDay(now).getTime() + daysToEmpty * DAY);
  if (runOut >= cycle.end) return null;
  const date = runOut.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return { runOut, date, perDay: Math.round(perDay), text: `At this pace, ${row.name} runs out on ${date}` };
}

// 📅 Weekly check-in: pockets spending faster than the cycle is passing, and pockets with room
export function weeklyCheck(rows, cycle, now = new Date()) {
  const total = Math.max(1, Math.round((cycle.end - cycle.start) / DAY));
  const passed = Math.min(1, (Math.round((startOfDay(now) - cycle.start) / DAY) + 1) / total);
  const live = rows.filter((r) => r.kind !== 'goal' && !r.is_savings && r.budget > 0);
  const used = (r) => r.spent / r.budget;
  const over = live.filter((r) => used(r) > passed + 0.15).sort((a, b) => used(b) - used(a));
  const room = live.filter((r) => used(r) < passed - 0.2).sort((a, b) => used(a) - used(b));
  return { passed, over, room };
}

// 🧾 End of cycle: what happened and a tip for next cycle
export function cycleSummary(rows) {
  const live = rows.filter((r) => r.kind !== 'goal' && !r.is_savings && r.budget > 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const saved = live.reduce((s, r) => s + Math.max(0, r.left), 0);
  const over = live.filter((r) => r.left < 0).sort((a, b) => a.left - b.left);
  const under = live.filter((r) => r.left > 0 && r.spent < r.budget * 0.6).sort((a, b) => b.left - a.left);
  let tip = null;
  if (over.length && under.length) {
    const move = Math.min(-over[0].left, Math.round(under[0].left / 2));
    tip = `Move ₹${move.toLocaleString('en-IN')} from ${under[0].name} to ${over[0].name} next cycle.`;
  } else if (over.length) tip = `${over[0].name} went over by ₹${(-over[0].left).toLocaleString('en-IN')}. Give it a bit more next cycle.`;
  else if (saved > 0) tip = `Every pocket held up. ₹${saved.toLocaleString('en-IN')} goes to Savings. 🔥`;
  return { spent, saved, over, under, tip };
}

// ⚠️ After a spend: did this pocket just drop below 20% or hit zero?
export function crossedAlert(before, after) {
  if (!before || !after || !(after.budget > 0)) return null;
  if (after.left <= 0 && before.left > 0) return { kind: 'empty', text: `${after.emoji} ${after.name} is empty, no party tonight 😅` };
  if (after.fill < 0.2 && before.fill >= 0.2) return { kind: 'low', text: `${after.emoji} ${after.name} is under 20%: ₹${Math.round(after.left).toLocaleString('en-IN')} left` };
  return null;
}

// ---------- Build 4: squad & fun ----------

// 🪙 Round-up: ₹347 → ₹350, the ₹3 goes to Savings
export const roundUp = (amount) => {
  const a = Math.round(Number(amount) || 0);
  return a > 0 ? (10 - (a % 10)) % 10 : 0;
};

// 🐣 Pocket mascot: its mood follows how full the pocket is
export function moodFor(row) {
  if (!row || !(row.budget > 0)) return { face: '😴', word: 'sleepy' };
  if (row.left <= 0) return { face: '😵', word: 'empty' };
  if (row.fill < 0.2) return { face: '😰', word: 'worried' };
  if (row.fill < 0.45) return { face: '😬', word: 'careful' };
  if (row.fill < 0.75) return { face: '🙂', word: 'chill' };
  return { face: '🤩', word: 'thriving' };
}

// How many cycles a pocket has been filled since it was made (the current one included)
export function cyclesSince(setup, createdAt, now = new Date()) {
  const first = cycleFor(setup, new Date(createdAt));
  const cur = cycleFor(setup, now);
  let n = 1;
  let c = first;
  while (c.startStr < cur.startStr && n < 400) {
    c = cycleFor(setup, c.end);
    n++;
  }
  return n;
}

// 🎯 Goal pocket: everything put in so far vs the target, and whether it's on track for the date
export function goalProgress(pocket, setup, { spends = [], moves = [], rolloverTotal = 0 }, now = new Date()) {
  const fills = cyclesSince(setup, pocket.created_at || now, now) * (Number(pocket.amount) || 0);
  const inOut = moves.reduce((s, m) => s + (m.to_pocket === pocket.id ? Number(m.amount) : 0) - (m.from_pocket === pocket.id ? Number(m.amount) : 0), 0);
  const out = spends.filter((e) => e.pocket_id === pocket.id).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const saved = Math.round(fills + inOut - out + (pocket.is_savings ? rolloverTotal : 0));
  const target = Number(pocket.target) || 0;
  if (!target) return { saved, target: 0, pct: 0 };
  const pct = Math.max(0, Math.min(1, saved / target));
  let onTrack = null;
  let perCycleNeeded = null;
  if (pocket.target_date) {
    const end = new Date(String(pocket.target_date).slice(0, 10) + 'T23:59:59');
    const cur = cycleFor(setup, now);
    let cyclesLeft = 0;
    let c = cur;
    while (c.end <= end && cyclesLeft < 400) { cyclesLeft++; c = cycleFor(setup, c.end); }
    const need = Math.max(0, target - saved);
    perCycleNeeded = cyclesLeft ? Math.ceil(need / cyclesLeft) : need;
    onTrack = need === 0 || (Number(pocket.amount) || 0) >= perCycleNeeded;
  }
  return { saved, target, pct, onTrack, perCycleNeeded, done: saved >= target };
}

// 🔥 Under-budget streak: finished cycles in a row where no pocket went over
export function cleanStreak(rollovers) {
  const done = (rollovers || []).filter((r) => r.clean !== null && r.clean !== undefined).sort((a, b) => (a.cycle_start < b.cycle_start ? 1 : -1));
  let n = 0;
  for (const r of done) { if (r.clean) n++; else break; }
  return n;
}

export function badgesFor(streak) {
  const out = [];
  if (streak >= 1) out.push({ emoji: '🔥', name: `Under budget streak · ${streak}` });
  if (streak >= 3) out.push({ emoji: '🧠', name: 'Money brain' });
  if (streak >= 6) out.push({ emoji: '👑', name: 'Pocket royalty' });
  return out;
}
