// 🗓️ Plan dates are saved as text like "Sat, 18 Oct" (or "2026-10-20").
// These helpers turn that into a real day, sort plans into Live / Upcoming / Past and write the countdown.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY = 864e5;
const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Returns a Date (midnight, local) or null if the text has no readable date.
// No year in the text → pick the year that puts it closest to when the plan was made.
export function planDay(text, createdAt, now = new Date()) {
  if (!text) return null;
  const t = String(text).trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const m = t.toLowerCase().match(/(\d{1,2})\s*([a-z]{3})[a-z]*(?:\s*,?\s*(\d{4}))?/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return null;
  const day = +m[1];
  if (m[3]) return new Date(+m[3], month, day);
  const base = createdAt ? new Date(createdAt) : now;
  const y = base.getFullYear();
  const options = [y - 1, y, y + 1].map((yy) => new Date(yy, month, day));
  // pick the year that lands closest to when the plan was made (works for future plans and logged past nights)
  return options.reduce((best, d) => (Math.abs(d - base) < Math.abs(best - base) ? d : best));
}

// 'live' (today, or someone's out right now) · 'upcoming' (future or no date) · 'past'
export function planBucket(p, now = new Date()) {
  const members = p.party_members || [];
  const out = members.some((m) => m.live_status === 'omw' || m.live_status === 'here');
  const d = planDay(p.party_date, p.created_at, now);
  const today = startOf(now);
  if (d && +d === +today) return 'live';
  if (out && (!d || Math.abs(d - today) <= DAY)) return 'live';
  if (!d) return 'upcoming';
  return d > today ? 'upcoming' : 'past';
}

// "Tonight" · "Tomorrow" · "In 3 days" · "In 2 weeks" · "Date TBD"
export function countdown(p, now = new Date()) {
  const d = planDay(p.party_date, p.created_at, now);
  if (!d) return 'Date TBD';
  const days = Math.round((d - startOf(now)) / DAY);
  if (days === 0) return 'Tonight';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 14) return `In ${days} days`;
  if (days >= 14 && days < 60) return `In ${Math.round(days / 7)} weeks`;
  if (days >= 60) return `In ${Math.round(days / 30)} months`;
  if (days === -1) return 'Yesterday';
  if (days > -14) return `${-days} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Upcoming soonest first (undated last), past newest first
export function sortPlans(list, bucket, now = new Date()) {
  const day = (p) => planDay(p.party_date, p.created_at, now);
  return [...list].sort((a, b) => {
    const da = day(a);
    const db = day(b);
    if (!da && !db) return new Date(b.created_at) - new Date(a.created_at);
    if (!da) return 1;
    if (!db) return -1;
    return bucket === 'past' ? db - da : da - db;
  });
}
