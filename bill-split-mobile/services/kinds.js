// Item types: what each item is, for drinking/eating toggles
export const KINDS = {
  alcohol: { label: 'Alcohol', emoji: '🍺' },
  soft: { label: 'Soft drink', emoji: '🥤' },
  food: { label: 'Food', emoji: '🍽️' },
};

// Tap to cycle: alcohol → soft drink → food → alcohol
export const nextKind = (k) => (k === 'alcohol' ? 'soft' : k === 'soft' ? 'food' : 'alcohol');

const has = (text, words) =>
  words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i').test(text));

// Definitely not alcohol, even if an alcohol word appears ("virgin mojito", "ginger ale")
const SOFT_FIRST = [
  'virgin', 'mocktail', 'mocktails', 'non alcoholic', 'non-alcoholic', 'alcohol free',
  'zero alcohol', 'ginger ale', 'ginger beer',
];

const ALCOHOL = [
  'beer', 'beers', 'pint', 'pints', 'pitcher', 'bucket', 'tower', 'lager', 'ale', 'stout', 'ipa',
  'draught', 'draft', 'wheat', 'cider',
  'whisky', 'whiskey', 'scotch', 'bourbon', 'single malt', 'malt',
  'rum', 'vodka', 'gin', 'tequila', 'brandy', 'cognac', 'liqueur', 'shot', 'shots',
  'wine', 'red wine', 'white wine', 'rose', 'champagne', 'prosecco', 'sangria', 'sparkling',
  'cocktail', 'cocktails', 'mojito', 'margarita', 'martini', 'cosmopolitan', 'daiquiri',
  'long island', 'liit', 'sex on the beach', 'pina colada', 'bloody mary', 'breezer',
  'bira', 'kingfisher', 'budweiser', 'bud', 'heineken', 'corona', 'hoegaarden', 'tuborg',
  'carlsberg', 'simba', 'old monk', 'bacardi', 'smirnoff', 'absolut', 'jack daniels',
  'jack daniel', 'black label', 'red label', 'blenders pride', 'royal stag', 'mcdowell',
  'teachers', 'jameson', 'glenfiddich', 'jagermeister', 'jager', 'toddy', 'feni',
];

const SOFT = [
  'water', 'soda', 'coke', 'cola', 'pepsi', 'sprite', 'fanta', '7up', 'thums up', 'limca',
  'mirinda', 'mountain dew', 'red bull', 'energy drink', 'tonic', 'juice', 'lime',
  'lemonade', 'nimbu', 'crush', 'cooler', 'iced tea', 'tea', 'coffee', 'cappuccino', 'latte',
  'lassi', 'buttermilk', 'shake', 'milkshake', 'smoothie', 'mocktail', 'breeze', 'fizz',
];

export function guessKind(name) {
  const text = String(name || '').toLowerCase();
  if (has(text, SOFT_FIRST)) return 'soft';
  if (has(text, ALCOHOL)) return 'alcohol';
  if (has(text, SOFT)) return 'soft';
  return 'food';
}

// Use the saved/scanned type if there is one, otherwise guess
export const kindOf = (item) => item.kind || guessKind(item.name);