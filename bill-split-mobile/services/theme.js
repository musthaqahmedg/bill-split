// VibeOut look (Gautham's design): black canvas, neon lime highlights, hot pink + purple gradients, chunky display font.
// Rule: one loud colour per area. Text on lime is always dark (C.onLime).
export const C = {
  bg: '#0A0A0F',        // screen background (black)
  card: '#15151D',      // cards and boxes
  cardHi: '#1F1F2B',    // highlighted card / inner box
  border: '#2A2A3A',    // card borders
  text: '#F5F5F7',      // main text
  sub: '#A6A6B8',       // secondary text
  faint: '#72727F',     // hints, small notes
  accent: '#9B5CFF',    // solid buttons (neon purple, white text)
  accentSoft: '#C6FF3D',// neon lime: links, highlights, kickers
  lime: '#C6FF3D',
  onLime: '#0A0A0F',    // text on lime
  cyan: '#3DD9FF',
  pink: '#FF3DA5',      // covering / pairs 💛💑 and gradients
  pinkBg: '#2A1424',    // pink boxes on dark
  green: '#34D399',     // paid / not drinking
  greenBg: '#0F2A20',   // green boxes on dark
  red: '#F87171',       // delete / remove
  amber: '#FBBF24',     // mystery items 🕵️
  amberBg: '#2C2310',
  disabled: '#34343F',  // buttons you can't press yet
};

// 🌈 Gradients (LinearGradient colors)
export const G = {
  hot: ['#FF3DA5', '#9B5CFF'],      // pink → purple: main actions
  night: ['#9B5CFF', '#3DD9FF'],    // purple → cyan
  lime: ['#C6FF3D', '#7CFFB2'],     // lime → mint (dark text)
  sunset: ['#FF7A1A', '#FF3DA5'],   // orange → pink: get me home safe
  card: ['#1F1530', '#15151D'],     // subtle glow card
};

// 🔤 Fonts: chunky display font for big headlines (loaded in App.tsx)
export const F = {
  display: 'Unbounded_800ExtraBold',
  bold: 'Unbounded_700Bold',
};
