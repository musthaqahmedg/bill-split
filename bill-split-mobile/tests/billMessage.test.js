// 📤 Per-friend WhatsApp bill: message, amounts, links. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBillMessage, personLines, payLink, rupees, unclaimed, waUrl } from '../services/billMessage.js';

const items = [
  { name: 'Chicken Wings', price: 360, item_claims: [{ participant_id: 'v' }, { participant_id: 'a' }, { participant_id: 'm' }] },
  { name: 'Mojito', price: 350, item_claims: [{ participant_id: 'v' }] },
  { name: 'Beer', price: 600, item_claims: [{ participant_id: 'a', units: 2 }, { participant_id: 'm', units: 1 }] },
  { name: 'Fries', price: 200, item_claims: [] },
];

test('lines: shared items split only among who had them, counted items by units', () => {
  const v = personLines(items, 'v');
  assert.deepEqual(v.map((l) => [l.name, l.amount, l.sharedBy]), [['Chicken Wings', 120, 3], ['Mojito', 350, 1]]);
  const a = personLines(items, 'a');
  assert.equal(a.find((l) => l.name === 'Beer').amount, 400);
});

test('message matches the brief: items, tax & service, total, link, UPI', () => {
  const msg = buildBillMessage({
    title: 'Neon Rooftop', date: '27 Nov', name: 'Vijay', lines: personLines(items, 'v'), total: 538,
    link: 'https://bill-split-flax.vercel.app/b/T?p=v', upi: 'payer@upi',
  });
  assert.equal(msg, [
    '🧾 Neon Rooftop · 27 Nov', '', 'Hi Vijay! Your share:',
    '• Chicken Wings (shared by 3) ₹120', '• Mojito ₹350', '• Tax & service ₹68', '─────────', 'Total: ₹538',
    '', 'Pay here 👇', 'https://bill-split-flax.vercel.app/b/T?p=v', 'Or send to UPI ID: payer@upi',
  ].join('\n'));
});

test('amount and UPI ID are always in plain text, even with no link', () => {
  const msg = buildBillMessage({ title: 'X', name: 'A', lines: [], total: 100, upi: 'a@upi' });
  assert.match(msg, /Total: ₹100/);
  assert.match(msg, /Send to UPI ID: a@upi/);
});

test('rounding: never more than 2 decimals', () => {
  assert.equal(rupees(538), '₹538');
  assert.equal(rupees(538.5), '₹538.50');
  assert.equal(rupees(100 / 3), '₹33.33');
  assert.equal(rupees(1234567), '₹12,34,567');
});

test("privacy: only this person's amounts, never anyone else's", () => {
  const msg = buildBillMessage({ title: 'X', name: 'Vijay', lines: personLines(items, 'v'), total: 538 });
  assert.doesNotMatch(msg, /Beer|400|200/);
});

test('if someone covered part of their share, only the total is shown', () => {
  const msg = buildBillMessage({ title: 'X', name: 'Vijay', lines: personLines(items, 'v'), total: 100 });
  assert.doesNotMatch(msg, /Mojito/);
  assert.match(msg, /Total: ₹100/);
});

test('discount shows as a minus line', () => {
  const msg = buildBillMessage({ title: 'X', name: 'V', lines: [{ name: 'Pizza', amount: 500, sharedBy: 1, units: 1, totalUnits: 1 }], total: 450 });
  assert.match(msg, /• Discount −₹50/);
});

test('unclaimed items are found with their amount', () => {
  assert.deepEqual(unclaimed(items), { count: 1, amount: 200 });
});

test('WhatsApp link: +91 for 10-digit numbers, and everything URL-encoded', () => {
  const text = 'Hi! ₹538 & 🧾 here';
  const u = waUrl('98470 12345', text);
  assert.ok(u.startsWith('https://wa.me/919847012345?text='));
  assert.equal(decodeURIComponent(u.split('text=')[1]), text);
  assert.ok(!u.includes(' ') && !u.includes('₹') && !u.split('text=')[1].includes('&'));
  assert.ok(waUrl('+91 98470-12345', 'x').startsWith('https://wa.me/919847012345?'));
  assert.ok(waUrl('09847012345', 'x').startsWith('https://wa.me/919847012345?'));
  assert.ok(waUrl('', 'x').startsWith('https://wa.me/?text='));
});

test('pay link points at the bill page set to that friend', () => {
  assert.equal(payLink('tok', 'p1'), 'https://bill-split-flax.vercel.app/b/tok?p=p1');
});
