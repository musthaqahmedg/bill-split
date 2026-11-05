// 🏠 House Party "What's the plan?": what to get for N guests, a rough cost, where to buy it, and prep tips.
// Costs are rough Indian prices (₹) to help set a budget — everyone can edit them.
export const NEEDS = [
  { key: 'food', emoji: '🍕', label: 'Food', shop: 'restaurants food delivery', item: (n) => { const k = Math.max(1, Math.ceil(n / 3)); return `${k} large pizza${k > 1 ? 's' : ''} or biryani`; }, cost: (n) => n * 220 },
  { key: 'snacks', emoji: '🍿', label: 'Snacks', shop: 'supermarket', item: (n) => `Chips, nachos & dips for ${n}`, cost: (n) => n * 80 },
  { key: 'drinks', emoji: '🥤', label: 'Soft drinks & mixers', shop: 'supermarket', item: (n) => `${Math.max(2, Math.ceil(n * 0.75))} L soft drinks & juices`, cost: (n) => Math.max(2, Math.ceil(n * 0.75)) * 60 },
  { key: 'ice', emoji: '🧊', label: 'Ice', shop: 'supermarket ice', item: (n) => `${Math.max(2, Math.ceil(n / 2))} kg ice`, cost: (n) => Math.max(2, Math.ceil(n / 2)) * 40 },
  { key: 'cups', emoji: '🥂', label: 'Cups & plates', shop: 'supermarket party supplies', item: (n) => `Cups, plates & tissues for ${n}`, cost: (n) => 100 + n * 15 },
  { key: 'decor', emoji: '🎈', label: 'Decor', shop: 'party supplies shop', item: () => 'Balloons, fairy lights & a banner', cost: () => 400 },
  { key: 'cake', emoji: '🎂', label: 'Cake', shop: 'bakery', item: (n) => `${n > 10 ? '2 kg' : '1 kg'} cake`, cost: (n) => (n > 10 ? 1400 : 750) },
  { key: 'games', emoji: '🎮', label: 'Games', shop: null, item: () => 'Cards, board games (bring yours) + party games in the app', cost: () => 0 },
  { key: 'music', emoji: '🎵', label: 'Music', shop: null, item: () => 'Speaker + a shared playlist', cost: () => 0 },
];

export const needOf = (key) => NEEDS.find((x) => x.key === key);

// the list items that go into the party's shared "who brings what" list (cost kept in the name)
export function planItems(keys, guests) {
  const n = Math.max(1, guests || 1);
  return keys
    .map(needOf)
    .filter(Boolean)
    .map((x) => {
      const c = Math.round(x.cost(n));
      return { key: x.key, name: `${x.emoji} ${x.item(n)}${c ? ` · ~₹${c.toLocaleString('en-IN')}` : ''}`, cost: c };
    });
}

export const planTotal = (keys, guests) => planItems(keys, guests).reduce((s, x) => s + x.cost, 0);

// rough cost back out of a list item name ("… · ~₹900")
export const costIn = (name) => {
  const m = String(name || '').match(/~₹([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};

// smart prep tips from the headcount and what was picked
export function prepTips(keys, guests) {
  const n = Math.max(1, guests || 1);
  const tips = [];
  if (keys.includes('ice')) tips.push(`🧊 Get ice last — about ${Math.max(2, Math.ceil(n / 2))} kg for ${n} people.`);
  if (keys.includes('food')) tips.push(`🍕 Order food ~45 min before people arrive; ${Math.max(1, Math.ceil(n / 3))} large pizza${Math.ceil(n / 3) > 1 ? 's' : ''} feed ${n}.`);
  if (keys.includes('drinks')) tips.push(`🥤 Plan ~750 ml of soft drinks or water per person.`);
  if (n >= 8) tips.push('🗑️ Pick a cleanup crew now so nobody is stuck at the end.');
  tips.push('💬 Share the party link so friends can say who brings what.');
  return tips.slice(0, 3);
}

// "where to buy" → a map search near you (opens Google Maps; no API key needed)
export const shopLink = (q) => `https://www.google.com/maps/search/${encodeURIComponent(`${q} near me`)}`;
