// Auto-planner: how much to buy for a party, from the number of guests.
// Each line becomes a "Who brings what" item like "Ice 🧊 · 4 kg".

const up = (n, step = 1) => Math.ceil(n / step) * step;
const kg = (n) => (Number.isInteger(n) ? `${n} kg` : `${n.toFixed(1)} kg`);
const litres = (ml) => `${up(ml / 1000, 0.5)} L`;

const water = (g, per = 2) => ({ label: 'Water 💧', qty: `${g * per} bottles` });
const snacks = (g) => ({ label: 'Snacks 🍿', qty: `${up(g * 0.75)} big packets` }); // 1 big packet ≈ 4 people
const ice = (g) => ({ label: 'Ice 🧊', qty: kg(up(g * 0.5, 0.5)) });
const cups = (g) => ({ label: 'Plates & cups 🥤', qty: `${g * 4} cups, ${g * 2} plates` });
const mixers = (g) => ({ label: 'Mixers & soda 🍋', qty: litres(g * 300) });
const soft = (g) => ({ label: 'Soft drinks 🥤', qty: litres(g * 500) });
const cake = (g) => ({ label: 'Cake 🎂', qty: kg(Math.max(0.5, up(g / 8, 0.5))) }); // 1 kg for 8 people

const PLANS = {
  house: (g) => [water(g), snacks(g), ice(g), mixers(g), soft(g), cups(g)],
  party: (g) => [water(g), snacks(g), ice(g), mixers(g), soft(g), cups(g)],
  bachelor: (g) => [water(g), snacks(g), ice(g), mixers(g), cups(g)],
  birthday: (g) => [cake(g), water(g), snacks(g), soft(g), cups(g)],
  match: (g) => [water(g), snacks(g), soft(g), ice(g), cups(g)],
  trip: (g) => [water(g, 3), snacks(g)],
  daytrip: (g) => [water(g, 3), snacks(g)],
};

export const canPlan = (kind) => !!PLANS[kind];

export function planFor(kind, guests) {
  const make = PLANS[kind];
  if (!make || guests < 1) return [];
  return make(guests).map((p) => ({ ...p, name: `${p.label} · ${p.qty}` }));
}

// "Ice 🧊 · 4 kg" and "ice" are the same item
export const baseName = (name) =>
  (name || '').split(' · ')[0].toLowerCase().replace(/[^a-z& ]/g, '').trim();
