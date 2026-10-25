import { kindOf } from './kinds.js';
// 💰 My Money: what YOU spent going out, from bills you saved (your share only). Pure maths, tested.
const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthLabel = (key, long = false) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', long ? { month: 'long', year: 'numeric' } : { month: 'short' });
};
export const shiftMonth = (key, by) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
};

// When the night happened: the bill's own date if it's a real date, else when it was saved
export function billDate(b) {
  if (b.bill_date && /^\d{4}-\d{2}-\d{2}/.test(b.bill_date)) {
    const d = new Date(b.bill_date.slice(0, 10) + 'T12:00:00');
    if (!isNaN(d)) return d;
  }
  return new Date(b.created_at);
}
export const myShare = (b) => {
  const me = (b.bill_participants || []).find((p) => p.name === 'Me');
  return me ? Math.round(Number(me.amount_due) || 0) : 0;
};

// 💸 Quick-add expense categories
export const EXPENSE_CATS = {
  cab: { emoji: '🚕', label: 'Cab' },
  snacks: { emoji: '🍿', label: 'Snacks' },
  entry: { emoji: '🎟️', label: 'Entry' },
  drinks: { emoji: '🍹', label: 'Drinks' },
  smoke: { emoji: '🚬', label: 'Smoke' },
  gift: { emoji: '🎁', label: 'Gift' },
  parking: { emoji: '🅿️', label: 'Parking' },
  other: { emoji: '➕', label: 'Other' },
};

export function moneySummary(bills, key, now = new Date(), expenses = []) {
  const billRows = (bills || []).map((b) => ({ b, d: billDate(b), amt: myShare(b) })).filter((r) => r.amt > 0);
  // quick-add expenses count towards spend (but not as "nights out")
  const extraRows = (expenses || []).map((e) => ({ e, d: new Date(e.spent_at), amt: Math.round(Number(e.amount) || 0) })).filter((r) => r.amt > 0);
  const rows = billRows;
  const inMonth = (k) => rows.filter((r) => monthKey(r.d) === k);
  const mine = inMonth(key);
  const extrasIn = (k) => extraRows.filter((r) => monthKey(r.d) === k);
  const sumIn = (k) => inMonth(k).reduce((s, r) => s + r.amt, 0) + extrasIn(k).reduce((s, r) => s + r.amt, 0);
  const spent = sumIn(key);
  const prevSpent = sumIn(shiftMonth(key, -1));
  const byCat = {};
  extrasIn(key).forEach((r) => { byCat[r.e.category] = (byCat[r.e.category] || 0) + r.amt; });
  const extras = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));
  const nights = mine.length;

  const biggest = mine.reduce((top, r) => (!top || r.amt > top.amount ? { title: r.b.title || 'Night out', amount: r.amt } : top), null);
  const count = (list) => Object.entries(list.reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const spots = count(mine.map((r) => (r.b.title || '').trim()).filter((t) => t && t !== 'Night out'));
  const friends = count(mine.flatMap((r) => (r.b.bill_participants || []).map((p) => p.name).filter((n) => n && n !== 'Me')));

  // last 6 months, oldest first (for the bar chart)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(key, -i);
    months.push({ key: k, label: monthLabel(k), spent: sumIn(k) });
  }

  // this week (Mon–today) for the weekly check-in, only for the current month view
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = rows.filter((r) => r.d >= monday && r.d <= now);
  const weekExtra = extraRows.filter((r) => r.d >= monday && r.d <= now).reduce((s, r) => s + r.amt, 0);

  return {
    spent,
    nights,
    avg: nights ? Math.round(spent / nights) : 0,
    extras,
    prevSpent,
    change: prevSpent ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null,
    biggest,
    topSpot: spots[0] ? { name: spots[0][0], count: spots[0][1] } : null,
    topFriends: friends.slice(0, 3).map(([name, n]) => ({ name, count: n })),
    months,
    week: { spent: week.reduce((s, r) => s + r.amt, 0) + weekExtra, nights: week.length },
  };
}

// Budget meter: how much is left, and a friendly status
export function budgetStatus(spent, budget, now = new Date()) {
  if (!(budget > 0)) return null;
  const left = budget - spent;
  const pct = Math.min(spent / budget, 1);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayPct = now.getDate() / days; // how far through the month we are
  let mood;
  if (left < 0) mood = { emoji: '🚨', text: `Over by ₹${Math.abs(left).toLocaleString('en-IN')}` };
  else if (pct > dayPct + 0.15) mood = { emoji: '⚠️', text: 'Spending fast this month' };
  else mood = { emoji: '✅', text: 'On track' };
  return { left, pct, mood };
}

// 🍺🚬 Habits: what part of MY spend went on drinks and smoking (private, for motivation, never shared)
const SMOKE = /(^|[^a-z])(cig|cigs|cigarette|cigarettes|smoke|smokes|hookah|hukka|sheesha|shisha|beedi|bidi|vape|marlboro|gold flake|wills|classic milds|benson)([^a-z]|$)/i;
export const habitOf = (item) => (SMOKE.test(String(item.name || '')) ? 'smoke' : kindOf(item) === 'alcohol' ? 'drinks' : 'other');

// My share of one detailed bill, split by habit. Tax/service included (same proportion as my bill share).
export function myHabitSplit(bill) {
  const me = (bill.bill_participants || []).find((p) => p.name === 'Me');
  if (!me) return { drinks: 0, smoke: 0, other: 0, total: 0 };
  const raw = { drinks: 0, smoke: 0, other: 0 };
  for (const it of bill.bill_items || []) {
    const claims = it.item_claims || [];
    const units = (c) => (Number(c.units) > 0 ? Number(c.units) : 1);
    const all = claims.reduce((s, c) => s + units(c), 0);
    const mine = claims.filter((c) => c.participant_id === me.id).reduce((s, c) => s + units(c), 0);
    if (all && mine) raw[habitOf(it)] += (Number(it.price) || 0) * (mine / all);
  }
  const sub = raw.drinks + raw.smoke + raw.other;
  const total = Math.round(Number(me.amount_due) || 0);
  if (!sub) return { drinks: 0, smoke: 0, other: total, total };
  const k = total / sub;
  const drinks = Math.round(raw.drinks * k);
  const smoke = Math.round(raw.smoke * k);
  return { drinks, smoke, other: total - drinks - smoke, total };
}

// What that money could have been instead (gentle motivation, not judgement). Rotates so it stays fresh.
export const SWAPS = [
  { emoji: '🎬', what: 'movie tickets', one: 'movie ticket', price: 250 },
  { emoji: '🎧', what: 'months of Spotify', one: 'month of Spotify', price: 119 },
  { emoji: '🍕', what: 'pizzas', one: 'pizza', price: 400 },
  { emoji: '☕', what: 'fancy coffees', one: 'fancy coffee', price: 220 },
  { emoji: '📚', what: 'books', one: 'book', price: 350 },
  { emoji: '🏋️', what: 'months of gym', one: 'month of gym', price: 1500 },
  { emoji: '🎮', what: 'new games', one: 'new game', price: 2500 },
  { emoji: '🎤', what: 'concert tickets', one: 'concert ticket', price: 2000 },
  { emoji: '👟', what: 'pairs of sneakers', one: 'pair of sneakers', price: 3500 },
  { emoji: '🎧', what: 'pairs of AirPods', one: 'pair of AirPods', price: 12000 },
  { emoji: '✈️', what: 'flights to Goa', one: 'flight to Goa', price: 5000 },
  { emoji: '🏝️', what: 'weekend trips', one: 'weekend trip', price: 8000 },
  { emoji: '🎁', what: 'birthday gifts for friends', one: 'birthday gift for a friend', price: 1000 },
  { emoji: '👪', what: 'family dinners', one: 'family dinner', price: 2500 },
  { emoji: '📱', what: 'new phones', one: 'new phone', price: 20000 },
  { emoji: '💻', what: 'laptops', one: 'laptop', price: 50000 },
  { emoji: '🏍️', what: 'months of bike EMI', one: 'month of bike EMI', price: 4000 },
];

export const MOTIVATION = [
  'Small cuts add up fast 💪',
  'Skip one round, fund a weekend trip ✈️',
  'Your future self says thanks 🙏',
  'Fun nights don’t need to cost more 🌿',
  'Every dry night is money in your pocket 💸',
  'Same vibe, smaller bill 😎',
  'Treat yourself to something that lasts 🎁',
];

// pick up to 3 swaps you could afford, in a different order each time (seed = any number)
export function swapsFor(amount, seed = 0) {
  const fits = SWAPS.filter((s) => Math.floor(amount / s.price) >= 1);
  const out = [];
  const pool = fits.slice();
  let x = (Math.abs(Math.floor(seed)) * 9301 + 49297) % 233280;
  while (pool.length && out.length < 3) {
    x = (x * 9301 + 49297) % 233280;
    const s = pool.splice(x % pool.length, 1)[0];
    const count = Math.floor(amount / s.price);
    out.push({ ...s, count, what: count === 1 ? s.one : s.what });
  }
  return out;
}

export function habitsSummary(detailedBills, key, expenses = []) {
  let drinks = 0;
  let smoke = 0;
  let total = 0;
  let nights = 0;
  let dry = 0;
  for (const b of detailedBills || []) {
    if (monthKey(billDate(b)) !== key) continue;
    const h = myHabitSplit(b);
    if (!h.total) continue;
    nights++;
    if (!h.drinks && !h.smoke) dry++;
    drinks += h.drinks;
    smoke += h.smoke;
    total += h.total;
  }
  for (const e of expenses || []) {
    if (monthKey(new Date(e.spent_at)) !== key) continue;
    const a = Math.round(Number(e.amount) || 0);
    if (e.category === 'drinks') drinks += a;
    if (e.category === 'smoke') smoke += a;
    total += a;
  }
  const habit = drinks + smoke;
  return { drinks, smoke, habit, total, nights, dry, pct: total ? Math.round((habit / total) * 100) : 0, yearly: habit * 12 };
}
