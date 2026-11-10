# VibeOut design rules

Dark, neon, poster-style. All values live in `services/theme.js` — use the tokens, not new numbers.

## Colours (`C`)
- Background `bg`, cards `card`, inner boxes `cardHi`, borders `border`.
- Text `text`, secondary `sub`, hints `faint`.
- Accents: `lime` (main), `cyan`, `pink`, `violet`, plus `amber`, `green`, `red`, `orange`, `yellow`, `mint`.
- **Text on any bright colour is dark (`onLime`).** White text only on dark or violet `accent`.
- No new hex colours in screens. Avatar circles use `HUES`.

## Text sizes (`T`)
| Token | Size | Use |
|---|---|---|
| tiny | 11 | pixel kickers, badges, timestamps (never smaller) |
| small | 13 | secondary lines |
| body | 15 | normal text |
| bodyL | 16 | inputs, list names |
| title | 18 | card titles |
| h2 | 22 | section / screen titles |
| h1 | 28 | page titles |
| hero | 40 | big headline numbers |

Headlines and big numbers: `F.display`. Small caps labels: `F.pixel`.

## Corners (`R`) and spacing (`S`)
- Corners: `sm` 10 chips · `md` 14 cards & buttons · `lg` 20 big cards & sheets · `pill` round.
- Spacing: 4 · 8 · 12 · 16 · 20 · 24. Screen side padding 20.

## Touch & states
- Tap targets at least 44 px tall.
- Every list needs loading, empty and error states.
- Disabled buttons use `disabled`.
