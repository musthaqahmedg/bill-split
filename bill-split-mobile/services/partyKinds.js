// Kinds of plans. Each has its own emoji, name ideas and the places to search.
export const KINDS = [
  { key: 'party', emoji: '🎉', label: 'Party', places: ['all', 'food', 'bars', 'cafes', 'hotels'],
    ideas: ['Friday night out 🍻', 'Promotion treat 🥂', 'Farewell for Rahul 👋', 'New Year bash 🎆'] },
  { key: 'birthday', emoji: '🎂', label: 'Birthday', places: ['all', 'food', 'cafes', 'bars', 'hotels'],
    ideas: ["Arun's birthday 🎂", 'Surprise bday for Meera 🎈', "Dad's 60th 🎉"] },
  { key: 'house', emoji: '🏠', label: 'House party', places: ['stays', 'food', 'all'],
    ideas: ['House party at mine 🏠', 'Game night 🎮', 'Potluck dinner 🍲'] },
  { key: 'nightout', emoji: '🍻', label: 'Night out', places: ['bars', 'all', 'food', 'cafes'],
    ideas: ['Friday night out 🍻', 'Bar hop 🍸', 'Late night food run 🌙'] },
  { key: 'movie', emoji: '🎬', label: 'Movie', places: ['cinema', 'food', 'cafes'],
    ideas: ['Movie night 🎬', 'First day first show 🍿', 'Weekend movie + dinner 🎥'] },
  { key: 'trip', emoji: '🧳', label: 'Trip', places: ['spots', 'stays', 'food'],
    ideas: ['Munnar trip 🏔️', 'Goa trip 🏖️', 'Wayanad weekend 🌿'] },
  { key: 'daytrip', emoji: '🚗', label: 'Day trip', places: ['spots', 'food', 'cafes'],
    ideas: ['Malampuzha day out 🚗', 'Waterfalls trip 💦', 'Sunday drive ☀️'] },
  { key: 'wedding', emoji: '💍', label: 'Wedding', places: ['stays', 'hotels', 'food'],
    ideas: ["Shafil's wedding 💍", 'Wedding gift pool 🎁', 'Haldi + sangeet 💃'] },
  { key: 'bachelor', emoji: '🥂', label: 'Bachelor', places: ['bars', 'stays', 'all'],
    ideas: ['Bachelor party 🥂', 'Last night of freedom 😎', 'Bachelorette 👑'] },
  { key: 'match', emoji: '⚽', label: 'Match night', places: ['bars', 'food', 'cafes'],
    ideas: ['Match night ⚽', 'IPL final watch 🏏', 'World Cup screening 🏆'] },
];

export const kindOf = (key) => KINDS.find((k) => k.key === key) || KINDS[0];
