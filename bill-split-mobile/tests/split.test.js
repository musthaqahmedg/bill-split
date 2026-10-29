// 🧮 Money maths tests. Run: npm test
// Every split must add up EXACTLY to the bill, and who-pays-whom must settle everyone to zero.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paidMap, transfers } from '../services/settle.js';
import { computeSplit } from '../services/splitEngine.js';

const sumOf = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const run = (args) => computeSplit(args);

test('₹1,600 + ₹160 charges = ₹1,760, shared by what each person had', () => {
  const r = run({
    people: ['Gautham', 'A', 'B', 'C'],
    items: [
      { name: 'Pizza', price: 500, qty: 1 },
      { name: 'Burger', price: 300, qty: 1 },
      { name: 'Fries', price: 200, qty: 1 },
      { name: 'Burger', price: 300, qty: 1 },
      { name: 'Drinks', price: 300, qty: 4 },
    ],
    claims: [['Gautham'], ['A'], ['B'], ['C'], ['Gautham', 'A', 'B', 'C']],
    bill: { total: 1760 },
  });
  assert.equal(r.sum, 1760);
  // exact values: Gautham (500+75)*1.1 = 632.5, A/C (300+75)*1.1 = 412.5, B (200+75)*1.1 = 302.5
  for (const [n, exact] of Object.entries({ Gautham: 632.5, A: 412.5, B: 302.5, C: 412.5 })) {
    assert.ok(Math.abs(r.finalOf[n] - exact) <= 0.5, `${n} ${r.finalOf[n]} vs ${exact}`);
  }
});

test('one ₹100 item shared by 3 → 34 + 33 + 33', () => {
  const r = run({ people: ['A', 'B', 'C'], items: [{ name: 'Nachos', price: 100, qty: 1 }], claims: [['A', 'B', 'C']], bill: { total: 100 } });
  assert.equal(r.sum, 100);
  assert.deepEqual(Object.values(r.finalOf).sort(), [33, 33, 34]);
});

test('tax and service shared in proportion', () => {
  const r = run({
    people: ['A', 'B'],
    items: [{ name: 'Steak', price: 1000, qty: 1 }, { name: 'Salad', price: 500, qty: 1 }],
    claims: [['A'], ['B']],
    bill: { total: 1650 },
  });
  assert.deepEqual(r.finalOf, { A: 1100, B: 550 });
});

test('🍺 3 beers ₹900: Arun had 2, Bibin 1 → ₹600 / ₹300', () => {
  const r = run({ people: ['Arun', 'Bibin'], items: [{ name: 'Beer', price: 900, qty: 3 }], claims: [['Arun', 'Arun', 'Bibin']], bill: { total: 900 } });
  assert.deepEqual(r.finalOf, { Arun: 600, Bibin: 300 });
});

test('💛 sponsor: Bibin covers Arun’s drink', () => {
  const r = run({
    people: ['Arun', 'Bibin'],
    items: [{ name: 'Whisky', price: 400, qty: 1 }, { name: 'Soda', price: 100, qty: 1 }],
    claims: [['Arun'], ['Bibin']],
    payers: [{ Arun: 'Bibin' }, {}],
    bill: { total: 500 },
  });
  assert.deepEqual(r.finalOf, { Arun: 0, Bibin: 500 });
  assert.equal(Math.round(r.covering.Bibin.Arun), 400);
});

test('🎁 treat: one person pays the whole bill', () => {
  const people = ['Me', 'A', 'B'];
  const r = run({
    people,
    items: [{ name: 'X', price: 300, qty: 1 }, { name: 'Y', price: 200, qty: 1 }],
    claims: [['A'], ['B']],
    payers: [{ A: 'Me' }, { B: 'Me' }],
    bill: { total: 550 },
  });
  assert.deepEqual(r.finalOf, { Me: 550, A: 0, B: 0 });
});

test('discount: bill total lower than the items', () => {
  const r = run({ people: ['A', 'B'], items: [{ name: 'X', price: 600, qty: 1 }, { name: 'Y', price: 400, qty: 1 }], claims: [['A'], ['B']], bill: { total: 900 } });
  assert.deepEqual(r.finalOf, { A: 540, B: 360 });
});

test('no total on the bill → items + tax + service − discount', () => {
  const r = run({ people: ['A'], items: [{ name: 'X', price: 1000, qty: 1 }], claims: [['A']], bill: { tax: 50, service_charge: 100, discount: 30 } });
  assert.equal(r.target, 1120);
  assert.equal(r.finalOf.A, 1120);
});

test('decimal total (₹5,226.40) rounds to ₹5,226 and still adds up', () => {
  const r = run({ people: ['A', 'B', 'C'], items: [{ name: 'X', price: 4750, qty: 1 }], claims: [['A', 'B', 'C']], bill: { total: 5226.4 } });
  assert.equal(r.target, 5226);
  assert.equal(r.sum, 5226);
});

test('a person removed from the table is ignored, not lost', () => {
  const r = run({ people: ['A', 'B'], items: [{ name: 'X', price: 300, qty: 1 }], claims: [['A', 'B', 'Gone']], bill: { total: 300 } });
  assert.deepEqual(r.finalOf, { A: 150, B: 150 });
});

test('🕵️ unclaimed item is reported (screen blocks saving)', () => {
  const r = run({ people: ['A'], items: [{ name: 'X', price: 100, qty: 1 }, { name: 'Y', price: 50, qty: 1 }], claims: [['A'], []], bill: { total: 150 } });
  assert.ok(r.unclaimed > 0);
});

test('2,000 random bills always add up exactly, nobody off by ₹1 or more', () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let t = 0; t < 2000; t++) {
    const people = Array.from({ length: 1 + Math.floor(rnd() * 8) }, (_, i) => 'P' + i);
    const items = Array.from({ length: 1 + Math.floor(rnd() * 12) }, (_, i) => ({ name: 'I' + i, price: Math.round(rnd() * 200000) / 100 + 1, qty: 1 + Math.floor(rnd() * 4) }));
    const claims = items.map(() => {
      const list = people.filter(() => rnd() < 0.5);
      if (!list.length) list.push(people[Math.floor(rnd() * people.length)]);
      if (rnd() < 0.3) list.push(list[0]); // someone had more units
      return list;
    });
    const payers = items.map(() => (rnd() < 0.2 && people.length > 1 ? { [people[1]]: people[0] } : {}));
    const itemsTotal = items.reduce((s, it) => s + it.price, 0);
    const total = Math.round(itemsTotal * (0.85 + rnd() * 0.35) * 100) / 100;
    const r = run({ people, items, claims, payers, bill: { total } });
    assert.equal(r.sum, Math.round(total), `bill ${t}`);
    for (const n of people) {
      assert.ok(r.finalOf[n] >= 0, `negative share in bill ${t}`);
      assert.ok(Math.abs(r.finalOf[n] - r.payExact[n]) < 1, `bill ${t}: ${n} ${r.finalOf[n]} vs ${r.payExact[n]}`);
    }
  }
});

// ---- 💳 Who paid → who pays whom ----

test('I paid → friends pay me', () => {
  const dues = { Me: 1500, Shajaaz: 2000, Pranav: 1726 };
  const t = transfers(dues, paidMap({ mode: 'me' }, Object.keys(dues), 5226));
  assert.deepEqual(t, [{ from: 'Shajaaz', to: 'Me', amount: 2000 }, { from: 'Pranav', to: 'Me', amount: 1726 }]);
});

test('a friend paid → everyone (incl. me) pays them', () => {
  const dues = { Me: 1500, Shajaaz: 2000, Pranav: 1726 };
  const t = transfers(dues, paidMap({ mode: 'friend', who: 'Pranav' }, Object.keys(dues), 5226));
  assert.deepEqual(t, [{ from: 'Shajaaz', to: 'Pranav', amount: 2000 }, { from: 'Me', to: 'Pranav', amount: 1500 }]);
});

test('not paid yet → no transfers', () => {
  assert.deepEqual(transfers({ A: 10, B: 20 }, paidMap({ mode: 'unpaid' }, ['A', 'B'], 30)), []);
});

test('more than one paid → fewest payments, everyone ends at zero', () => {
  const dues = { Me: 1500, Shajaaz: 2000, Pranav: 1726 };
  const paid = paidMap({ mode: 'multi', amounts: { Me: '3000', Pranav: '2226' } }, Object.keys(dues), 5226);
  const t = transfers(dues, paid);
  assert.ok(t.length <= 2);
  const bal = { ...Object.fromEntries(Object.keys(dues).map((n) => [n, (paid[n] || 0) - dues[n]])) };
  t.forEach((m) => { bal[m.from] += m.amount; bal[m.to] -= m.amount; });
  assert.ok(Object.values(bal).every((v) => v === 0));
});

test('500 random settle-ups always balance to zero', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 500; k++) {
    const people = Array.from({ length: 2 + Math.floor(rnd() * 7) }, (_, i) => 'P' + i);
    const dues = Object.fromEntries(people.map((n) => [n, Math.floor(rnd() * 3000)]));
    const total = sumOf(dues);
    const payer = people[Math.floor(rnd() * people.length)];
    const t = transfers(dues, { [payer]: total });
    const bal = Object.fromEntries(people.map((n) => [n, (n === payer ? total : 0) - dues[n]]));
    t.forEach((m) => { bal[m.from] += m.amount; bal[m.to] -= m.amount; });
    assert.ok(Object.values(bal).every((v) => v === 0), `case ${k}`);
    assert.ok(t.length <= people.length - 1);
  }
});

// ---- 🏠 Home summary ----
import { billBalance, homeBalance } from '../services/settle.js';

test('🏠 I paid: friends owe me, ticked friends drop off', () => {
  const bill = { total: 1255, paid_mode: 'me', bill_participants: [
    { name: 'Me', amount_due: 419, paid_amount: 1255 },
    { name: 'Shajaaz', amount_due: 418 },
    { name: 'Pranav', amount_due: 418, paid_at: '2026-10-22' },
  ] };
  assert.deepEqual(billBalance(bill), { owed: 418, owe: 0, open: false, settled: false });
});

test('🏠 a friend paid: I owe my share; old bills (no mode) = I paid', () => {
  const a = { total: 900, paid_mode: 'friend', bill_participants: [{ name: 'Me', amount_due: 300 }, { name: 'Arun', amount_due: 600, paid_amount: 900 }] };
  const old = { total: 500, bill_participants: [{ name: 'Me', amount_due: 250 }, { name: 'B', amount_due: 250 }] };
  const unpaid = { total: 100, paid_mode: 'unpaid', bill_participants: [{ name: 'Me', amount_due: 100 }] };
  const arch = { ...old, status: 'archived' };
  assert.deepEqual(homeBalance([a, old, unpaid, arch]), { owed: 250, owe: 300, unpaid: 1 });
  assert.equal(billBalance({ ...a, bill_participants: [{ ...a.bill_participants[0], paid_at: 'x' }, a.bill_participants[1]] }).settled, true);
});

// ---- 🔒 Contacts are scrambled on the phone, same as the server ----
import { createHash } from 'node:crypto';
import { contactHash, sha256 } from '../services/hash.js';

test('🔒 phone SHA-256 matches the server (and node) exactly', () => {
  assert.equal(contactHash('+91 98765-43210'), '7619ee8cea49187f309616e30ecf54be072259b43760f1f550a644945d5572f2');
  for (const s of ['', 'a', 'Musthaq@Gmail.com ', 'x'.repeat(200), 'ഹലോ 🎉']) {
    assert.equal(sha256(s), createHash('sha256').update(s).digest('hex'));
  }
  assert.equal(contactHash(' Musthaq@Gmail.com '), createHash('sha256').update('musthaq@gmail.com').digest('hex'));
});

// ---- 💰 My Money ----
import { budgetStatus, moneySummary, shiftMonth } from '../services/money.js';

test('💰 My Money: only MY share, per month, with last month compare', () => {
  const B = (title, date, me, others = []) => ({ title, created_at: date + 'T20:00:00', bill_participants: [{ name: 'Me', amount_due: me }, ...others.map((n) => ({ name: n, amount_due: 100 }))] });
  const bills = [
    B('Toddy Shop', '2026-10-03', 600, ['Arun', 'Bibin']),
    B('Toddy Shop', '2026-10-18', 400, ['Arun']),
    B('Paragon', '2026-10-20', 1000, ['Gautham']),
    B('Cafe', '2026-09-10', 1600, ['Arun']),
    { title: 'Not mine', created_at: '2026-10-05T20:00:00', bill_participants: [{ name: 'X', amount_due: 999 }] },
    { title: 'Dated bill', bill_date: '2026-09-30', created_at: '2026-10-02T10:00:00', bill_participants: [{ name: 'Me', amount_due: 400 }] },
  ];
  const s = moneySummary(bills, '2026-10', new Date('2026-10-21T12:00:00'));
  assert.equal(s.spent, 2000);
  assert.equal(s.nights, 3);
  assert.equal(s.avg, 667);
  assert.equal(s.prevSpent, 2000); // 1600 + the bill dated 30 Sep (saved in Oct)
  assert.equal(s.change, 0);
  assert.deepEqual(s.biggest, { title: 'Paragon', amount: 1000 });
  assert.deepEqual(s.topSpot, { name: 'Toddy Shop', count: 2 });
  assert.equal(s.topFriends[0].name, 'Arun');
  assert.equal(s.months.length, 6);
  assert.equal(s.months[5].spent, 2000);
  assert.deepEqual(s.week, { spent: 1000, nights: 1 }); // week = Mon 19 → Wed 21 Oct: only the 20 Oct bill (18th was a Sunday)
});

test('💰 budget meter: on track / fast / over', () => {
  const mid = new Date('2026-10-15T12:00:00');
  assert.equal(budgetStatus(0, 0), null);
  assert.equal(budgetStatus(2000, 5000, mid).mood.text, 'On track');
  assert.equal(budgetStatus(4500, 5000, mid).mood.text, 'Spending fast this month');
  assert.equal(budgetStatus(6000, 5000, mid).mood.text, 'Over by ₹1,000');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

// ---- 🍺🚬 Habits in My Money ----
import { habitsSummary, myHabitSplit, swapsFor } from '../services/money.js';

test('🍺🚬 habits: my share of drinks / smoke, tax included, adds up', () => {
  const bill = {
    created_at: '2026-10-10T21:00:00',
    bill_participants: [{ id: 'me', name: 'Me', amount_due: 1100 }, { id: 'a', name: 'Arun', amount_due: 550 }],
    bill_items: [
      { name: 'Kingfisher Pint', price: 600, item_claims: [{ participant_id: 'me', units: 2 }, { participant_id: 'a', units: 1 }] }, // me 400
      { name: 'Hookah - mint', price: 400, item_claims: [{ participant_id: 'me' }, { participant_id: 'a' }] }, // me 200
      { name: 'Chicken 65', price: 500, item_claims: [{ participant_id: 'me' }, { participant_id: 'a' }] }, // me 250
      { name: 'Fresh lime soda', price: 150, item_claims: [{ participant_id: 'me' }] }, // me 150
    ],
  };
  const h = myHabitSplit(bill); // my subtotal 1000 → ×1.1 = 1100
  assert.deepEqual(h, { drinks: 440, smoke: 220, other: 440, total: 1100 });
  const dry = { created_at: '2026-10-12T21:00:00', bill_participants: [{ id: 'me', name: 'Me', amount_due: 300 }], bill_items: [{ name: 'Virgin mojito', price: 300, item_claims: [{ participant_id: 'me' }] }] };
  const s = habitsSummary([bill, dry], '2026-10');
  assert.equal(s.habit, 660);
  assert.equal(s.nights, 2);
  assert.equal(s.dry, 1);
  assert.equal(s.pct, 47);
  assert.equal(s.yearly, 7920);
});

test('💡 motivation swaps rotate, always affordable, max 3', () => {
  const seen = new Set();
  for (let seed = 0; seed < 30; seed++) {
    const sw = swapsFor(7920, seed);
    assert.ok(sw.length === 3);
    sw.forEach((x) => assert.ok(x.count >= 1 && x.count * x.price <= 7920));
    seen.add(sw.map((x) => x.what).join());
  }
  assert.ok(seen.size > 5); // it really changes
  assert.equal(swapsFor(50, 1).length, 0);
});

// ---- 📍 Live location distance ----
test('📍 distance between friends', async () => {
  const { km, distText } = await import('../services/distance.js');
  assert.ok(Math.abs(km({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.19) < 0.1);
  assert.equal(distText(0.153), '150 m away');
  assert.equal(distText(2.46), '2.5 km away');
});

// ---- 💸 Quick-add expenses in My Money ----
test('💸 quick-add expenses count in spend, week and habits (not as nights)', () => {
  const bills = [{ title: 'Toddy', created_at: '2026-10-20T21:00:00', bill_participants: [{ name: 'Me', amount_due: 1000 }] }];
  const ex = [
    { category: 'cab', amount: 250, spent_at: '2026-10-20T23:40:00' },
    { category: 'smoke', amount: 150, spent_at: '2026-10-20T22:00:00' },
    { category: 'snacks', amount: 99, spent_at: '2026-09-30T20:00:00' },
  ];
  const s = moneySummary(bills, '2026-10', new Date('2026-10-21T12:00:00'), ex);
  assert.equal(s.spent, 1400);
  assert.equal(s.nights, 1);
  assert.equal(s.prevSpent, 99);
  assert.deepEqual(s.extras, [{ category: 'cab', amount: 250 }, { category: 'smoke', amount: 150 }]);
  assert.equal(s.week.spent, 1400);
  const h = habitsSummary([], '2026-10', ex);
  assert.equal(h.smoke, 150);
  assert.equal(h.total, 400);
});

test('plan dates: read "Sat, 18 Oct", sort into live / upcoming / past, countdown', async () => {
  const { planDay, planBucket, countdown } = await import('../services/when.js');
  const now = new Date(2026, 9, 25, 18, 0); // 25 Oct 2026, 6 PM
  const made = new Date(2026, 9, 20).toISOString();
  assert.equal(+planDay('Sun, 25 Oct', made, now), +new Date(2026, 9, 25));
  assert.equal(+planDay('2026-11-02', made, now), +new Date(2026, 10, 2));
  assert.equal(+planDay('Fri, 2 Jan', made, now), +new Date(2027, 0, 2)); // made in Oct → next January
  assert.equal(planDay('this weekend', made, now), null);
  assert.equal(planBucket({ party_date: 'Sun, 25 Oct', created_at: made }, now), 'live');
  assert.equal(planBucket({ party_date: 'Tue, 27 Oct', created_at: made }, now), 'upcoming');
  assert.equal(planBucket({ party_date: 'Wed, 21 Oct', created_at: made }, now), 'past');
  assert.equal(planBucket({ party_date: null, created_at: made }, now), 'upcoming');
  assert.equal(planBucket({ party_date: 'Sat, 24 Oct', created_at: made, party_members: [{ live_status: 'here' }] }, now), 'live');
  assert.equal(countdown({ party_date: 'Sun, 25 Oct', created_at: made }, now), 'Tonight');
  assert.equal(countdown({ party_date: 'Mon, 26 Oct', created_at: made }, now), 'Tomorrow');
  assert.equal(countdown({ party_date: 'Thu, 29 Oct', created_at: made }, now), 'In 4 days');
  assert.equal(countdown({ party_date: null, created_at: made }, now), 'Date TBD');
});

test('plan dates: a night logged 2 days after it happened stays in the past', async () => {
  const { planBucket, countdown } = await import('../services/when.js');
  const now = new Date(2026, 9, 27, 12, 0);
  const p = { party_date: 'Tue, 20 Oct', created_at: new Date(2026, 9, 22).toISOString() };
  assert.equal(planBucket(p, now), 'past');
  assert.equal(countdown(p, now), '7 days ago');
});

test("today's allowance: what's left of the budget, shared over the days left", async () => {
  const { todaySummary } = await import('../services/money.js');
  const now = new Date(2026, 9, 27, 20, 0); // 27 Oct, 5 days left incl. today
  const ex = [
    { spent_at: new Date(2026, 9, 10).toISOString(), amount: 3000, category: 'cab' },
    { spent_at: new Date(2026, 9, 27, 19).toISOString(), amount: 400, category: 'snacks' },
    { spent_at: new Date(2026, 8, 30).toISOString(), amount: 9999, category: 'cab' }, // last month: ignored
  ];
  const t = todaySummary([], ex, 10000, now);
  assert.equal(t.daysLeft, 5);
  assert.equal(t.before, 3000);
  assert.equal(t.today, 400);
  assert.equal(t.allowance, 1400); // (10000 - 3000) / 5
  assert.equal(t.left, 1000);
  assert.equal(todaySummary([], ex, 0, now).allowance, 0);
});

test('morning recap: night length from first status to last home', async () => {
  const { nightLength } = await import('../services/when.js');
  const t = (h, m) => new Date(2026, 9, 24, h, m).toISOString();
  const n = (h, m) => new Date(2026, 9, 25, h, m).toISOString();
  assert.equal(nightLength([{ live_at: t(20, 15), home_at: n(1, 30) }, { live_at: t(21, 0), home_at: n(2, 57) }]), '6h 42m');
  assert.equal(nightLength([{ live_at: t(20, 0) }]), null);
  assert.equal(nightLength([{ live_at: t(20, 0), home_at: t(20, 40) }]), '40m');
});

test('tip: added on top of the printed bill, shared like tax, still adds up exactly', async () => {
  const items = [{ name: 'Biryani', price: 300, qty: 1 }, { name: 'Lime soda', price: 100, qty: 1 }];
  const people = ['Me', 'Arun'];
  const claims = [['Me'], ['Arun']];
  const r = computeSplit({ items, people, claims, bill: { total: 420, tip: 42 } });
  assert.equal(r.billTotal, 462);
  assert.equal(r.tip, 42);
  assert.equal(r.finalOf.Me + r.finalOf.Arun, 462);
  assert.equal(r.finalOf.Me, 347); // 300/400 of 462 = 346.5 → biggest remainder rounds up
  const none = computeSplit({ items, people, claims, bill: { total: 420 } });
  assert.equal(none.billTotal, 420);
});

test('your nights: weekday chart, favourite day and squad', async () => {
  const { nightsStats } = await import('../services/when.js');
  const now = new Date(2026, 9, 27, 12);
  const made = new Date(2026, 9, 1).toISOString();
  const plans = [
    { party_date: 'Fri, 23 Oct', created_at: made, party_members: [{ name: 'Me' }, { name: 'Arun', rsvp: 'in' }, { name: 'Bibin', rsvp: 'out' }] },
    { party_date: 'Fri, 16 Oct', created_at: made, party_members: [{ name: 'Me' }, { name: 'Arun', rsvp: 'in' }, { name: 'Bibin', rsvp: 'in' }] },
    { party_date: 'Sat, 3 Oct', created_at: made, party_members: [{ name: 'Me' }, { name: 'Gautham', rsvp: 'in' }] },
    { party_date: 'Sat, 31 Oct', created_at: made, party_members: [{ name: 'Me' }] }, // upcoming: not counted
  ];
  const s = nightsStats(plans, now);
  assert.equal(s.nights, 3);
  assert.equal(s.month, 3);
  assert.equal(s.favDay, 'Fri');
  assert.deepEqual(s.week.find((w) => w.day === 'Fri'), { day: 'Fri', count: 2 });
  assert.deepEqual(s.squad[0], { name: 'Arun', count: 2 });
  assert.equal(s.squad.length, 3);
});

test('doors open in: countdown from the first stop time', async () => {
  const { startTime, untilStart } = await import('../services/when.js');
  const now = new Date(2026, 9, 29, 19, 15, 51);
  const p = { party_date: 'Thu, 29 Oct', created_at: new Date(2026, 9, 20).toISOString(), stops: [{ name: 'Neon Rooftop', time: '9:30 PM' }] };
  assert.equal(+startTime(p, now), +new Date(2026, 9, 29, 21, 30));
  assert.deepEqual(untilStart(p, now), { h: '02', m: '14', s: '09' });
  assert.equal(untilStart({ ...p, stops: [{ name: 'x' }] }, now), null);
  assert.equal(untilStart(p, new Date(2026, 9, 29, 22, 0)), null); // already started
});
