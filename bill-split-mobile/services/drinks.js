// 🍹 Party drinks: mocktails first, a few classic cocktails (for adults, with care)
// Amounts are per 1 glass; the app multiplies by the number of people.

export const MOCKTAILS = [
  {
    name: 'Virgin Mojito', emoji: '🌿', vibe: 'Fresh & minty',
    ingredients: [['Mint leaves', 8, 'leaves'], ['Lime', 0.5, ''], ['Sugar syrup', 20, 'ml'], ['Soda', 150, 'ml'], ['Ice', 1, 'cup']],
    steps: ['Crush mint, lime and sugar syrup in a glass', 'Fill with ice', 'Top with soda and stir'],
  },
  {
    name: 'Kulukki Sarbath', emoji: '🍋', vibe: 'Kerala street classic',
    ingredients: [['Lime', 0.5, ''], ['Sabja (basil) seeds', 1, 'tsp'], ['Green chilli', 0.25, ''], ['Sugar syrup', 25, 'ml'], ['Cold water', 150, 'ml'], ['Ice', 0.5, 'cup']],
    steps: ['Soak sabja seeds in water for 10 min', 'Add everything to a shaker or closed jar', 'Shake hard (kulukki!) and pour'],
  },
  {
    name: 'Blue Lagoon (zero)', emoji: '💙', vibe: 'Party colours',
    ingredients: [['Blue curaçao syrup', 20, 'ml'], ['Lemon juice', 15, 'ml'], ['Sprite / 7Up', 150, 'ml'], ['Ice', 1, 'cup']],
    steps: ['Fill a glass with ice', 'Add syrup and lemon', 'Top with Sprite and stir gently'],
  },
  {
    name: 'Watermelon Cooler', emoji: '🍉', vibe: 'Summer in a glass',
    ingredients: [['Watermelon cubes', 1, 'cup'], ['Lime', 0.25, ''], ['Mint leaves', 4, 'leaves'], ['Black salt', 0.25, 'tsp'], ['Ice', 0.5, 'cup']],
    steps: ['Blend watermelon with lime and black salt', 'Strain over ice', 'Top with mint'],
  },
  {
    name: 'Mango Fizz', emoji: '🥭', vibe: 'Sweet & bubbly',
    ingredients: [['Mango pulp', 60, 'ml'], ['Lemon juice', 10, 'ml'], ['Soda', 120, 'ml'], ['Ice', 0.5, 'cup']],
    steps: ['Stir mango pulp and lemon in a glass', 'Add ice', 'Top with soda'],
  },
  {
    name: 'Shirley Temple', emoji: '🍒', vibe: 'Retro & pink',
    ingredients: [['Grenadine syrup', 15, 'ml'], ['Ginger ale', 150, 'ml'], ['Cherries', 2, ''], ['Ice', 1, 'cup']],
    steps: ['Fill a glass with ice', 'Pour ginger ale and grenadine', 'Top with cherries'],
  },
  {
    name: 'Cold Coffee', emoji: '☕', vibe: 'Late-night fuel',
    ingredients: [['Instant coffee', 1, 'tsp'], ['Milk', 200, 'ml'], ['Sugar', 2, 'tsp'], ['Ice', 0.5, 'cup']],
    steps: ['Blend everything until frothy', 'Pour over ice'],
  },
  {
    name: 'Masala Soda', emoji: '🧂', vibe: 'Tangy & desi',
    ingredients: [['Lime', 0.5, ''], ['Chaat masala', 0.5, 'tsp'], ['Black salt', 0.25, 'tsp'], ['Soda', 200, 'ml'], ['Ice', 0.5, 'cup']],
    steps: ['Squeeze lime into a glass with the masalas', 'Add ice', 'Top with soda (watch the fizz!)'],
  },
];

export const COCKTAILS = [
  {
    name: 'Mojito', emoji: '🍃', vibe: 'Classic & fresh',
    ingredients: [['White rum', 45, 'ml'], ['Mint leaves', 8, 'leaves'], ['Lime', 0.5, ''], ['Sugar syrup', 20, 'ml'], ['Soda', 100, 'ml'], ['Ice', 1, 'cup']],
    steps: ['Crush mint, lime and syrup', 'Add rum and ice', 'Top with soda'],
  },
  {
    name: 'Cuba Libre', emoji: '🥤', vibe: 'Easy crowd-pleaser',
    ingredients: [['Rum', 45, 'ml'], ['Cola', 120, 'ml'], ['Lime', 0.25, ''], ['Ice', 1, 'cup']],
    steps: ['Fill a glass with ice', 'Add rum and lime', 'Top with cola'],
  },
  {
    name: 'Screwdriver', emoji: '🍊', vibe: 'Two-ingredient hero',
    ingredients: [['Vodka', 45, 'ml'], ['Orange juice', 150, 'ml'], ['Ice', 1, 'cup']],
    steps: ['Fill a glass with ice', 'Add vodka', 'Top with orange juice'],
  },
  {
    name: 'Gin & Tonic', emoji: '🥂', vibe: 'Crisp & simple',
    ingredients: [['Gin', 45, 'ml'], ['Tonic water', 150, 'ml'], ['Lime', 0.25, ''], ['Ice', 1, 'cup']],
    steps: ['Fill a glass with ice', 'Add gin', 'Top with tonic and a lime wedge'],
  },
];

// Total for the party, rounded nicely (e.g. "Mint leaves · 64 leaves", "Soda · 1.2 L")
export function scaled([name, amount, unit], people, glassesEach = 1) {
  const total = amount * people * glassesEach;
  if (unit === 'ml') return `${name} · ${total >= 1000 ? `${Math.ceil(total / 250) / 4} L` : `${Math.ceil(total / 10) * 10} ml`}`;
  if (unit === 'cup') return `${name} · ${Math.ceil(total)} ${Math.ceil(total) === 1 ? 'cup' : 'cups'}`;
  if (unit === 'tsp') return `${name} · ${Math.ceil(total)} tsp`;
  if (unit === 'leaves') return `${name} · ${Math.ceil(total)} leaves`;
  return `${name} · ${Math.ceil(total)}`;
}
