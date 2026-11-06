// ✍️ Manual Split maths — no receipt needed (groceries, fuel, rent, trips).
//
// Everything is worked out in PAISE (whole numbers) so ₹0.1 + ₹0.2 never goes wrong,
// and every split adds up EXACTLY to the amount typed. Money goes back out in rupees (2 decimals).
//
// Split methods:
//   equal   → everyone in the group shares equally
//   custom  → only the chosen people share, equally
//   exact   → you type each person's ₹ (must add up to the total)
//   percent → you type each person's % (must add up to 100)
//
// A settle-up payment ("Rohan paid me ₹500") is saved as its own tiny expense:
// paid { Rohan: 500 }, shares { Me: 500 }. That way balances always come from one rule: paid − share.

export const METHODS = ['equal', 'custom', 'exact', 'percent'];

// "1,250.5" → 125050 paise. Bad input → NaN.
export function toPaise(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export const toRupees = (p) => Math.round(p) / 100;

// "₹1,234.50" style text (drops .00)
export function fmt(rupees) {
  const p = Math.round(Math.abs(Number(rupees) || 0) * 100);
  const whole = Math.floor(p / 100).toLocaleString('en-IN');
  const dec = p % 100;
  return `₹${whole}${dec ? '.' + String(dec).padStart(2, '0') : ''}`;
}

// Split `paise` by weights so the parts are whole paise and add up exactly.
// Leftover paise go to the biggest remainders; ties → earlier in the list (stable, predictable).
function byWeights(paise, names, weights) {
  const W = weights.reduce((a, b) => a + b, 0);
  if (!(W > 0)) return null;
  const raw = names.map((n, i) => ({ n, i, exact: (paise * weights[i]) / W }));
  raw.forEach((r) => { r.floor = Math.floor(r.exact); r.rem = r.exact - r.floor; });
  let left = paise - raw.reduce((a, r) => a + r.floor, 0);
  [...raw].sort((a, b) => (b.rem - a.rem) || (a.i - b.i)).forEach((r) => {
    if (left > 0) { r.floor += 1; left -= 1; }
  });
  return Object.fromEntries(raw.map((r) => [r.n, r.floor]));
}

// Main split.
//   total:  amount (₹, number or text)
//   people: names sharing (for 'equal' pass the whole group; for 'custom' the chosen ones)
//   inputs: { name: ₹ } for exact, { name: % } for percent
// Returns { ok, shares: { name: ₹ }, sharesPaise, left, error }
//   left = paise still to assign (exact) or % still to assign (percent); 0 when it adds up.
export function splitShares({ total, people, method = 'equal', inputs = {} }) {
  const T = toPaise(total);
  const names = [...new Set((people || []).filter(Boolean))];
  const fail = (error, left = 0) => ({ ok: false, shares: {}, sharesPaise: {}, left, error });
  if (!(T > 0)) return fail('Enter an amount');
  if (!names.length) return fail('Pick at least one person');

  let sp;
  if (method === 'equal' || method === 'custom') {
    sp = byWeights(T, names, names.map(() => 1));
  } else if (method === 'exact') {
    sp = {};
    for (const n of names) {
      const p = inputs[n] === '' || inputs[n] === undefined ? 0 : toPaise(inputs[n]);
      if (!(p >= 0)) return fail(`Check ${n}'s amount`);
      sp[n] = p;
    }
    const left = T - Object.values(sp).reduce((a, b) => a + b, 0);
    if (left !== 0) return fail(left > 0 ? `${fmt(toRupees(left))} left to assign` : `${fmt(toRupees(-left))} too much`, left);
  } else if (method === 'percent') {
    const pct = names.map((n) => (inputs[n] === '' || inputs[n] === undefined ? 0 : Number(String(inputs[n]).replace(/[%\s]/g, ''))));
    if (pct.some((x) => !(x >= 0))) return fail('Check the percentages');
    // compare in hundredths of a percent so 33.33 + 33.33 + 33.34 = 100 exactly
    const leftH = 10000 - pct.reduce((a, b) => a + Math.round(b * 100), 0);
    if (leftH !== 0) return fail(leftH > 0 ? `${leftH / 100}% left to assign` : `${-leftH / 100}% too much`, leftH / 100);
    sp = byWeights(T, names, pct);
  } else {
    return fail('Unknown split');
  }
  // people with ₹0 aren't part of this expense
  Object.keys(sp).forEach((n) => { if (!sp[n]) delete sp[n]; });
  return {
    ok: true,
    sharesPaise: sp,
    shares: Object.fromEntries(Object.entries(sp).map(([n, p]) => [n, toRupees(p)])),
    left: 0,
    error: null,
  };
}

// Who paid. One payer → { name: total }. Several payers → their ₹ must add up to the total.
// Returns { ok, paid: { name: ₹ }, paidPaise, left, error }
export function paidBy({ total, payers }) {
  const T = toPaise(total);
  const list = Object.entries(payers || {});
  if (!(T > 0)) return { ok: false, paid: {}, paidPaise: {}, left: 0, error: 'Enter an amount' };
  if (list.length === 1 && (list[0][1] === null || list[0][1] === undefined || list[0][1] === '')) {
    return { ok: true, paid: { [list[0][0]]: toRupees(T) }, paidPaise: { [list[0][0]]: T }, left: 0, error: null };
  }
  const pp = {};
  for (const [n, v] of list) {
    const p = v === '' || v === undefined || v === null ? 0 : toPaise(v);
    if (!(p >= 0)) return { ok: false, paid: {}, paidPaise: {}, left: 0, error: `Check what ${n} paid` };
    if (p > 0) pp[n] = p;
  }
  if (!Object.keys(pp).length) return { ok: false, paid: {}, paidPaise: {}, left: T, error: 'Who paid?' };
  const left = T - Object.values(pp).reduce((a, b) => a + b, 0);
  if (left !== 0) {
    return { ok: false, paid: {}, paidPaise: {}, left, error: left > 0 ? `${fmt(toRupees(left))} still unpaid` : `${fmt(toRupees(-left))} more than the total` };
  }
  return { ok: true, paidPaise: pp, paid: Object.fromEntries(Object.entries(pp).map(([n, p]) => [n, toRupees(p)])), left: 0, error: null };
}

// Fewest payments that bring everyone to zero. net = { name: paise } (+ gets back, − owes).
export function settleUp(netPaise) {
  const cred = Object.entries(netPaise).filter(([, v]) => v > 0).map(([n, v]) => ({ n, v })).sort((a, b) => (b.v - a.v) || a.n.localeCompare(b.n));
  const debt = Object.entries(netPaise).filter(([, v]) => v < 0).map(([n, v]) => ({ n, v: -v })).sort((a, b) => (b.v - a.v) || a.n.localeCompare(b.n));
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt > 0) out.push({ from: debt[i].n, to: cred[j].n, amount: toRupees(amt), paise: amt });
    debt[i].v -= amt;
    cred[j].v -= amt;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}

// One group, many expenses (+ settle-up payments) → everyone's numbers.
//   expenses: [{ total, paid: { name: ₹ }, shares: { name: ₹ }, category? }]
// Returns {
//   spent:   total group spending (settle-up payments not counted)
//   people:  [{ name, paid, share, net }]  (₹; net > 0 gets back, < 0 owes)
//   moves:   [{ from, to, amount }]         fewest payments to settle
//   settled: true when nobody owes anything
// }
export const SETTLEMENT = 'settlement';
export function groupBalances(expenses, members = []) {
  const paid = {};
  const share = {};
  const net = {};
  let spent = 0;
  members.forEach((n) => { paid[n] = 0; share[n] = 0; net[n] = 0; });
  (expenses || []).forEach((e) => {
    const isPay = e.category === SETTLEMENT;
    if (!isPay) spent += toPaise(e.total) || 0;
    Object.entries(e.paid || {}).forEach(([n, v]) => {
      const p = toPaise(v) || 0;
      net[n] = (net[n] || 0) + p;
      if (!isPay) paid[n] = (paid[n] || 0) + p;
      else paid[n] = paid[n] || 0;
      share[n] = share[n] || 0;
    });
    Object.entries(e.shares || {}).forEach(([n, v]) => {
      const p = toPaise(v) || 0;
      net[n] = (net[n] || 0) - p;
      if (!isPay) share[n] = (share[n] || 0) + p;
      else share[n] = share[n] || 0;
      paid[n] = paid[n] || 0;
    });
  });
  const people = Object.keys(net)
    .map((name) => ({ name, paid: toRupees(paid[name]), share: toRupees(share[name]), net: toRupees(net[name]) }))
    .sort((a, b) => (a.name === 'Me' ? -1 : b.name === 'Me' ? 1 : (b.net - a.net) || a.name.localeCompare(b.name)));
  const moves = settleUp(net).map(({ from, to, amount }) => ({ from, to, amount }));
  return { spent: toRupees(spent), people, moves, settled: moves.length === 0 };
}

// A settle-up payment as an expense row: `from` paid `to`.
export function settlementExpense(from, to, amount) {
  const a = toRupees(toPaise(amount));
  return { title: `${from} paid ${to}`, total: a, category: SETTLEMENT, paid: { [from]: a }, shares: { [to]: a } };
}
