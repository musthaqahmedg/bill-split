// VibeOut look = Gautham's "Final UX" (25 Oct): black canvas, neon lime-yellow, hot pink and violet,
// chunky wide headlines and poster-style cards. Rule: text on lime is always dark (C.onLime).
export const C = {
  bg: '#0E0E12',        // screen background (black)
  card: '#1A1A21',      // cards and boxes
  cardHi: '#24242D',    // highlighted card / inner box
  border: '#2E2E39',    // card borders
  text: '#F7F7F9',      // main text
  sub: '#ABABBC',       // secondary text
  faint: '#76768A',     // hints, small notes
  accent: '#8B5CF6',    // solid buttons (violet, white text)
  accentSoft: '#E2FF3B',// neon lime-yellow: links, highlights, kickers
  lime: '#E2FF3B',
  onLime: '#0E0E12',    // text on lime
  violet: '#A98BFF',    // soft violet poster cards
  gold: '#E2FF3B',      // money amounts
  cyan: '#55E0F0',
  pink: '#FF4FA0',      // covering / pairs 💛💑 and gradients
  pinkBg: '#2C1424',
  green: '#34D399',     // paid / not drinking
  greenBg: '#0F2A20',
  red: '#F87171',       // delete / remove
  amber: '#FBBF24',     // mystery items 🕵️
  amberBg: '#2C2310',
  disabled: '#34343F',  // buttons you can't press yet
};

// 🌈 Gradients
export const G = {
  hot: ['#FF4FA0', '#8B5CF6'],      // pink → violet: main actions
  night: ['#8B5CF6', '#55E0F0'],    // violet → cyan
  lime: ['#E2FF3B', '#B8FF5C'],     // lime (dark text)
  sunset: ['#FF7A1A', '#FF4FA0'],   // orange → pink: get me home safe
  card: ['#22172E', '#1A1A21'],     // subtle glow card
  sky: ['#1E1430', '#0E0E12'],      // soft glow behind headers
};

// 🔤 Fonts (loaded in App.tsx): chunky wide display font for headlines and big numbers
export const F = {
  display: 'Unbounded_800ExtraBold',
  italic: 'Unbounded_800ExtraBold',
  bold: 'Unbounded_700Bold',
  logo: 'Unbounded_800ExtraBold',
  pixel: 'Silkscreen_400Regular', // 🕹️ small pixel labels (v14 sticker pop)
};

// 🏷️ Sticker shadow (v14): a hard light edge under the right + bottom of a card or button, like a sticker
export const STICK = { borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' };
