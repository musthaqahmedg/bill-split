// 💰 Pockets maths tests. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleFor, suggestAmounts, leftToAssign, pocketBalances, leftoverFor, previousCycle, DEFAULT_POCKETS } from '../services/pocketMath.js';

test('suggested amounts always add up to the income exactly', () => {
  for (const inc of [1, 999, 25000, 33333, 41777, 150000, 7654321]) {
    const p = suggestAmounts(inc);
    assert.equal(p.reduce((s, x) => s + x.amount, 0), inc);
    assert.equal(leftToAssign(inc, p), 0);
    assert.ok(p.every((x) => x.amount >= 0));
  }
  assert.equal(DEFAULT_POCKETS.reduce((s, d) => s + d.pct, 0), 100);
});

test('monthly cycle runs from payday to the day before next payday', () => {
  const c = cycleFor({ cycle: 'monthly', payday: '2026-10-01' }, new Date(2026, 10, 25));
  assert.equal(c.startStr, '2026-11-01');
  assert.equal(c.endStr, '2026-12-01');
  const c2 = cycleFor({ cycle: 'monthly', payday: '2026-10-28' }, new Date(2026, 10, 25));
  assert.equal(c2.startStr, '2026-10-28');
  assert.equal(c2.endStr, '2026-11-28');
  assert.equal(c2.daysLeft, 3);
});

test('payday on the 31st falls back to the last day of short months', () => {
  const c = cycleFor({ cycle: 'monthly', payday: '2026-01-31' }, new Date(2026, 1, 15));
  assert.equal(c.startStr, '2026-01-31');
  assert.equal(c.endStr, '2026-02-28');
});

test('every-2-weeks cycle steps 14 days from payday', () => {
  const c = cycleFor({ cycle: 'biweekly', payday: '2026-11-06' }, new Date(2026, 10, 25));
  assert.equal(c.startStr, '2026-11-20');
  assert.equal(c.endStr, '2026-12-04');
  const p = previousCycle({ cycle: 'biweekly', payday: '2026-11-06' }, c);
  assert.equal(p.startStr, '2026-11-06');
});

test('spending this cycle comes out of the right pocket; other cycles do not count', () => {
  const cycle = cycleFor({ cycle: 'monthly', payday: '2026-11-01' }, new Date(2026, 10, 25));
  const pockets = [
    { id: 'a', name: 'Going Out', kind: 'variable', amount: 3000 },
    { id: 's', name: 'Savings', kind: 'goal', amount: 5000, is_savings: true },
  ];
  const ex = [
    { pocket_id: 'a', amount: 1200, spent_at: '2026-11-10T20:00:00+05:30' },
    { pocket_id: 'a', amount: 2500, spent_at: '2026-11-20T20:00:00+05:30' },
    { pocket_id: 'a', amount: 999, spent_at: '2026-10-30T20:00:00+05:30' },
    { pocket_id: null, amount: 50, spent_at: '2026-11-20T20:00:00+05:30' },
  ];
  const b = pocketBalances(pockets, ex, cycle, 700);
  const go = b.rows.find((r) => r.id === 'a');
  assert.equal(go.spent, 3700);
  assert.equal(go.left, -700);
  assert.equal(go.empty, true);
  const sv = b.rows.find((r) => r.id === 's');
  assert.equal(sv.left, 5700); // rollover lands in Savings
  assert.equal(b.total, 8700);
  assert.equal(b.left, 5700); // overspent pockets don't make the total negative
});

test('low-pocket flag below 20%', () => {
  const cycle = cycleFor({ cycle: 'monthly', payday: '2026-11-01' }, new Date(2026, 10, 25));
  const b = pocketBalances([{ id: 'a', amount: 1000, kind: 'variable' }], [{ pocket_id: 'a', amount: 850, spent_at: '2026-11-05T10:00:00Z' }], cycle);
  assert.equal(b.rows[0].low, true);
});

test('leftovers roll over from fixed and variable pockets only', () => {
  const cycle = cycleFor({ cycle: 'monthly', payday: '2026-10-01' }, new Date(2026, 9, 20));
  const pockets = [
    { id: 'a', kind: 'variable', amount: 1000 },
    { id: 'b', kind: 'fixed', amount: 500 },
    { id: 'g', kind: 'goal', amount: 2000 },
    { id: 's', kind: 'goal', amount: 3000, is_savings: true },
  ];
  const ex = [{ pocket_id: 'a', amount: 1400, spent_at: '2026-10-05T10:00:00Z' }, { pocket_id: 'b', amount: 200, spent_at: '2026-10-06T10:00:00Z' }];
  assert.equal(leftoverFor(pockets, ex, cycle), 300); // a overspent → 0, b leaves 300
});
