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

export function moneySummary(bills, key, now = new Date()) {
  const rows = (bills || []).map((b) => ({ b, d: billDate(b), amt: myShare(b) })).filter((r) => r.amt > 0);
  const inMonth = (k) => rows.filter((r) => monthKey(r.d) === k);
  const mine = inMonth(key);
  const spent = mine.reduce((s, r) => s + r.amt, 0);
  const prevSpent = inMonth(shiftMonth(key, -1)).reduce((s, r) => s + r.amt, 0);
  const nights = mine.length;

  const biggest = mine.reduce((top, r) => (!top || r.amt > top.amount ? { title: r.b.title || 'Night out', amount: r.amt } : top), null);
  const count = (list) => Object.entries(list.reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const spots = count(mine.map((r) => (r.b.title || '').trim()).filter((t) => t && t !== 'Night out'));
  const friends = count(mine.flatMap((r) => (r.b.bill_participants || []).map((p) => p.name).filter((n) => n && n !== 'Me')));

  // last 6 months, oldest first (for the bar chart)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(key, -i);
    months.push({ key: k, label: monthLabel(k), spent: inMonth(k).reduce((s, r) => s + r.amt, 0) });
  }

  // this week (Mon–today) for the weekly check-in, only for the current month view
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = rows.filter((r) => r.d >= monday && r.d <= now);

  return {
    spent,
    nights,
    avg: nights ? Math.round(spent / nights) : 0,
    prevSpent,
    change: prevSpent ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null,
    biggest,
    topSpot: spots[0] ? { name: spots[0][0], count: spots[0][1] } : null,
    topFriends: friends.slice(0, 3).map(([name, n]) => ({ name, count: n })),
    months,
    week: { spent: week.reduce((s, r) => s + r.amt, 0), nights: week.length },
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
