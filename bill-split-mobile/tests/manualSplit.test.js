// ✍️ Manual Split maths tests. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitShares, paidBy, groupBalances, settleUp, settlementExpense, toPaise, fmt } from '../services/manualSplit.js';

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const FIVE = ['A', 'B', 'C', 'D', 'E'];

test('brief: ₹7,000 equally among 5 → ₹1,400 each', () => {
  const r = splitShares({ total: 7000, people: FIVE, method: 'equal' });
  assert.ok(r.ok);
  FIVE.forEach((n) => assert.equal(r.shares[n], 1400));
});

test('₹100 among 3 → 33.34 + 33.33 + 33.33, adds up exactly', () => {
  const r = splitShares({ total: 100, people: ['A', 'B', 'C'], method: 'equal' });
  assert.deepEqual(r.sharesPaise, { A: 3334, B: 3333, C: 3333 });
  assert.equal(sum(r.sharesPaise), 10000);
});

test('decimals and text input: "1,250.50" among 2', () => {
  const r = splitShares({ total: '1,250.50', people: ['A', 'B'], method: 'equal' });
  assert.deepEqual(r.shares, { A: 625.25, B: 625.25 });
});

test('brief: unequal (exact) split ₹7,000', () => {
  const r = splitShares({ total: 7000, people: FIVE, method: 'exact', inputs: { A: 2000, B: 1500, C: 1000, D: 1500, E: 1000 } });
  assert.ok(r.ok);
  assert.equal(r.shares.A, 2000);
});

test('exact split that does not add up says how much is left / too much', () => {
  const short = splitShares({ total: 1000, people: ['A', 'B'], method: 'exact', inputs: { A: 600, B: 200 } });
  assert.equal(short.ok, false);
  assert.equal(short.error, '₹200 left to assign');
  const over = splitShares({ total: 1000, people: ['A', 'B'], method: 'exact', inputs: { A: 600, B: 450.5 } });
  assert.equal(over.error, '₹50.50 too much');
});

test('exact: a person on ₹0 is left out of the expense', () => {
  const r = splitShares({ total: 500, people: ['A', 'B', 'C'], method: 'exact', inputs: { A: 500, B: '', C: 0 } });
  assert.deepEqual(r.shares, { A: 500 });
});

test('percent: 50/30/20 of ₹999', () => {
  const r = splitShares({ total: 999, people: ['A', 'B', 'C'], method: 'percent', inputs: { A: 50, B: 30, C: 20 } });
  assert.ok(r.ok);
  assert.equal(sum(r.sharesPaise), 99900);
  assert.deepEqual(r.shares, { A: 499.5, B: 299.7, C: 199.8 });
});

test('percent: 33.33 + 33.33 + 33.34 is accepted; 90% is not', () => {
  assert.ok(splitShares({ total: 10, people: ['A', 'B', 'C'], method: 'percent', inputs: { A: 33.33, B: 33.33, C: 33.34 } }).ok);
  const bad = splitShares({ total: 10, people: ['A', 'B'], method: 'percent', inputs: { A: 60, B: 30 } });
  assert.equal(bad.error, '10% left to assign');
});

test('brief: custom — groceries shared by 3, decorations by all 5', () => {
  const g = splitShares({ total: 2000, people: ['A', 'B', 'C'], method: 'custom' });
  const d = splitShares({ total: 500, people: FIVE, method: 'custom' });
  assert.equal(Object.keys(g.shares).length, 3);
  assert.equal(d.shares.E, 100);
});

test('bad input is refused', () => {
  assert.equal(splitShares({ total: 0, people: ['A'] }).ok, false);
  assert.equal(splitShares({ total: 'abc', people: ['A'] }).ok, false);
  assert.equal(splitShares({ total: 100, people: [] }).ok, false);
  assert.equal(splitShares({ total: 100, people: ['A'], method: 'exact', inputs: { A: -5 } }).ok, false);
});

test('paid by one person, or several who must add up', () => {
  assert.deepEqual(paidBy({ total: 3000, payers: { A: null } }).paid, { A: 3000 });
  assert.deepEqual(paidBy({ total: 3000, payers: { A: 2000, B: 1000 } }).paid, { A: 2000, B: 1000 });
  assert.equal(paidBy({ total: 3000, payers: { A: 2000, B: 500 } }).error, '₹500 still unpaid');
  assert.equal(paidBy({ total: 3000, payers: { A: 2000, B: 1500 } }).error, '₹500 more than the total');
});

test('brief: Weekend Party — 4 expenses, A/B/C paid, settles to zero with few payments', () => {
  const eq = (t) => splitShares({ total: t, people: FIVE }).shares;
  const ex = [
    { title: 'Groceries', total: 2000, paid: { A: 2000 }, shares: eq(2000) },
    { title: 'Drinks', total: 3000, paid: { B: 2000, C: 1000 }, shares: eq(3000) },
    { title: 'Food', total: 1500, paid: { A: 1000, C: 500 }, shares: eq(1500) },
    { title: 'Decorations', total: 500, paid: { C: 500 }, shares: eq(500) },
  ];
  const r = groupBalances(ex, FIVE);
  assert.equal(r.spent, 7000);
  const by = Object.fromEntries(r.people.map((p) => [p.name, p]));
  assert.equal(by.A.paid, 3000);
  assert.equal(by.A.share, 1400);
  assert.equal(by.A.net, 1600);
  assert.equal(by.D.net, -1400);
  assert.equal(sum(Object.fromEntries(r.people.map((p) => [p.name, toPaise(p.net)]))), 0);
  assert.ok(r.moves.length <= 4); // 5 people → at most 4 payments
  // applying the moves settles everyone
  const after = groupBalances([...ex, ...r.moves.map((m) => settlementExpense(m.from, m.to, m.amount))], FIVE);
  assert.equal(after.settled, true);
  assert.equal(after.spent, 7000); // settle-ups are not spending
});

test('settle-up payment counts toward balance but not spending', () => {
  const ex = [{ total: 1000, paid: { Me: 1000 }, shares: { Me: 500, Rohan: 500 } }];
  assert.deepEqual(groupBalances(ex).moves, [{ from: 'Rohan', to: 'Me', amount: 500 }]);
  const half = groupBalances([...ex, settlementExpense('Rohan', 'Me', 200)]);
  assert.deepEqual(half.moves, [{ from: 'Rohan', to: 'Me', amount: 300 }]);
  assert.equal(half.spent, 1000);
});

test('editing an expense recalculates (balances come only from the current list)', () => {
  const a = [{ total: 900, paid: { A: 900 }, shares: splitShares({ total: 900, people: ['A', 'B', 'C'] }).shares }];
  const b = [{ total: 600, paid: { A: 600 }, shares: splitShares({ total: 600, people: ['A', 'B', 'C'] }).shares }];
  assert.equal(groupBalances(a).moves.reduce((s, m) => s + m.amount, 0), 600);
  assert.equal(groupBalances(b).moves.reduce((s, m) => s + m.amount, 0), 400);
  assert.equal(groupBalances([]).settled, true);
});

test('2,000 random groups always settle exactly to zero', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const names = ['Me', 'A', 'B', 'C', 'D', 'E', 'F'];
  for (let k = 0; k < 2000; k++) {
    const ppl = names.slice(0, 2 + Math.floor(rnd() * 6));
    const ex = [];
    for (let e = 0; e < 1 + Math.floor(rnd() * 6); e++) {
      const total = Math.round(rnd() * 500000) / 100 + 1;
      const who = ppl.filter(() => rnd() > 0.3);
      const inn = who.length ? who : [ppl[0]];
      const s = splitShares({ total, people: inn, method: 'equal' });
      ex.push({ total, paid: { [ppl[Math.floor(rnd() * ppl.length)]]: total }, shares: s.shares });
      assert.equal(sum(s.sharesPaise), toPaise(total));
    }
    const r = groupBalances(ex, ppl);
    const after = groupBalances([...ex, ...r.moves.map((m) => settlementExpense(m.from, m.to, m.amount))], ppl);
    assert.equal(after.settled, true);
    assert.ok(r.moves.length <= ppl.length - 1);
  }
});

test('settleUp and fmt basics', () => {
  assert.deepEqual(settleUp({ A: 500, B: -500 }), [{ from: 'B', to: 'A', amount: 5, paise: 500 }]);
  assert.equal(fmt(1234.5), '₹1,234.50');
  assert.equal(fmt(1400), '₹1,400');
});

// 📅 Year view (money tracker)
import { yearSummary } from '../services/money.js';
test('year view: 12 months, total, biggest month, average so far', () => {
  const bill = (date, amt) => ({ bill_date: date, created_at: `${date}T20:00:00`, total: amt, bill_participants: [{ name: 'Me', amount_due: amt }] });
  const bills = [bill('2026-01-10', 1000), bill('2026-03-05', 3000), bill('2025-12-31', 999)];
  const expenses = [{ spent_at: '2026-03-06T10:00:00', amount: 500 }];
  const y = yearSummary(bills, 2026, new Date('2026-04-15T12:00:00'), expenses);
  assert.equal(y.months.length, 12);
  assert.equal(y.total, 4500);
  assert.equal(y.nights, 2);
  assert.equal(y.biggest.key, '2026-03');
  assert.equal(y.biggest.spent, 3500);
  assert.equal(y.avgMonth, 1125); // 4500 over Jan–Apr
  assert.equal(yearSummary(bills, 2025, new Date('2026-04-15'), expenses).avgMonth, 83); // 999 / 12
});
