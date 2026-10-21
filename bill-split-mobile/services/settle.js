// 💳 Who paid the bill → who pays whom (fewest payments)
//
// payment = { mode: 'me' | 'friend' | 'unpaid' | 'multi', who: name, amounts: { name: rupees } }
// dues    = { name: their share of the bill (whole rupees) }

export const MODES = { me: 'me', friend: 'friend', unpaid: 'unpaid', multi: 'multi' };

// How much each person paid the restaurant
export function paidMap(payment, people, total) {
  const t = Math.round(Number(total) || 0);
  const mode = (payment && payment.mode) || 'me';
  if (mode === 'me') {
    const me = people.includes('Me') ? 'Me' : people[0];
    return me ? { [me]: t } : {};
  }
  if (mode === 'friend') return payment.who && people.includes(payment.who) ? { [payment.who]: t } : {};
  if (mode === 'multi') {
    const out = {};
    Object.entries(payment.amounts || {}).forEach(([n, a]) => {
      const v = Math.round(Number(a) || 0);
      if (people.includes(n) && v > 0) out[n] = v;
    });
    return out;
  }
  return {}; // unpaid: nobody has paid yet
}

// Fewest payments so everyone ends up paying exactly their share
export function transfers(dues, paid) {
  const names = [...new Set([...Object.keys(dues), ...Object.keys(paid)])];
  const bal = names.map((n) => ({ n, v: Math.round((Number(paid[n]) || 0) - (Number(dues[n]) || 0)) }));
  const cred = bal.filter((b) => b.v > 0).sort((a, b) => b.v - a.v);
  const debt = bal.filter((b) => b.v < 0).map((b) => ({ n: b.n, v: -b.v })).sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt > 0) out.push({ from: debt[i].n, to: cred[j].n, amount: amt });
    debt[i].v -= amt;
    cred[j].v -= amt;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}

// From a saved bill (old bills = "I paid")
export function savedPayment(bill, participants) {
  const mode = bill.paid_mode || 'me';
  const payers = participants.filter((p) => Number(p.paid_amount) > 0);
  if (mode === 'friend') return { mode, who: payers[0] ? payers[0].name : null, amounts: {} };
  if (mode === 'multi') return { mode, who: null, amounts: Object.fromEntries(payers.map((p) => [p.name, Number(p.paid_amount)])) };
  return { mode, who: null, amounts: {} };
}

export function savedPaidMap(bill, participants) {
  if (!bill.paid_mode) {
    const me = participants.find((p) => p.name === 'Me');
    return me ? { Me: Math.round(Number(bill.total) || 0) } : {};
  }
  return Object.fromEntries(participants.filter((p) => Number(p.paid_amount) > 0).map((p) => [p.name, Number(p.paid_amount)]));
}
