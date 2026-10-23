// 🧮 The split engine: pure maths, no screens, no database. Tested in tests/split.test.js
//
// items  = [{ name, price, qty }]          price = the line total on the bill
// people = ['Me', 'Arun', ...]
// claims = one list per item, a name once per unit they had (['Arun','Arun','Bibin'] = Arun 2, Bibin 1)
// payers = one map per item: { Arun: 'Bibin' } = Bibin pays for Arun's part of this item (sponsor / pair)
// bill   = { total, tax, service_charge, discount }   total > 0 wins; otherwise items + tax + service − discount
//
// Rules:
// - Each person's items are shared by how many units they had
// - Tax, service, discount and round-off are shared in proportion to what each person had
// - Final amounts are whole rupees and ALWAYS add up exactly to the (rounded) bill total

export function computeSplit({ items = [], people = [], claims = [], payers = [], bill = null }) {
  const price = (it) => Number(it && it.price) || 0;
  const itemsTotal = items.reduce((s, it) => s + price(it), 0);
  const billTotal =
    bill && Number(bill.total) > 0
      ? Number(bill.total)
      : itemsTotal + (Number(bill && bill.tax) || 0) + (Number(bill && bill.service_charge) || 0) - (Number(bill && bill.discount) || 0);
  const extras = billTotal - itemsTotal; // tax + service − discount + round-off
  const withExtras = (amt) => (itemsTotal !== 0 ? amt + extras * (amt / itemsTotal) : 0);

  // Only people at the table count (a removed person's units are ignored, not lost)
  const claimsOf = (i) => (claims[i] || []).filter((n) => people.includes(n));
  const payerOf = (i, name) => {
    const p = payers[i] && payers[i][name];
    return p && people.includes(p) ? p : name;
  };

  // What each person had
  const shares = people.map((name) => {
    const mine = [];
    items.forEach((it, i) => {
      const who = claimsOf(i);
      if (!who.includes(name)) return;
      const units = who.filter((n) => n === name).length;
      mine.push({
        i,
        name: it.name,
        qty: it.qty,
        amount: (price(it) * units) / who.length,
        ways: new Set(who).size,
        units,
        totalUnits: who.length,
        counted: new Set(who).size !== who.length,
        paidBy: payerOf(i, name),
      });
    });
    const subtotal = mine.reduce((s, m) => s + m.amount, 0);
    return { name, mine, subtotal, ownExact: withExtras(subtotal) };
  });

  // What each person actually pays: their own uncovered items + anything they cover
  const payExact = Object.fromEntries(people.map((n) => [n, 0]));
  const covering = Object.fromEntries(people.map((n) => [n, {}]));
  shares.forEach((s) =>
    s.mine.forEach((m) => {
      const amt = withExtras(m.amount);
      payExact[m.paidBy] += amt;
      if (m.paidBy !== s.name) covering[m.paidBy][s.name] = (covering[m.paidBy][s.name] || 0) + amt;
    })
  );

  // Items nobody claimed (🕵️ mystery items): the screen blocks this, but never lose money if it happens
  const unclaimed = items.reduce((s, it, i) => (claimsOf(i).length ? s : s + withExtras(price(it))), 0);

  // Whole rupees, adding up exactly to the bill. Work in paise to avoid floating-point drift.
  const target = Math.round(billTotal);
  const paise = people.map((n) => Math.round(payExact[n] * 100));
  const final = paise.map((p) => Math.floor(p / 100));
  let left = target - final.reduce((a, b) => a + b, 0);
  if (people.length && !unclaimed) {
    const order = paise
      .map((p, i) => ({ i, frac: p - Math.floor(p / 100) * 100 }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    // hand out leftover rupees one at a time (biggest remainders first); take back if over
    let k = 0;
    while (left > 0) {
      final[order[k % order.length].i] += 1;
      left -= 1;
      k++;
    }
    k = order.length - 1;
    while (left < 0) {
      final[order[((k % order.length) + order.length) % order.length].i] -= 1;
      left += 1;
      k--;
    }
  }
  const finalOf = Object.fromEntries(people.map((n, i) => [n, final[i]]));
  const sum = final.reduce((a, b) => a + b, 0);

  return { itemsTotal, billTotal, extras, target, shares, payExact, covering, finalOf, sum, unclaimed };
}
