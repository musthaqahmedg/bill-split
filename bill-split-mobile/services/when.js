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

// ⏱️ How long the night was: first "on my way / here" to the last "home safe" (null if unknown)
export function nightLength(members) {
  const starts = members.map((m) => m.live_at).filter(Boolean).map((t) => new Date(t).getTime());
  const ends = members.map((m) => m.home_at).filter(Boolean).map((t) => new Date(t).getTime());
  if (!starts.length || !ends.length) return null;
  const mins = Math.round((Math.max(...ends) - Math.min(...starts)) / 60000);
  if (mins <= 0 || mins > 24 * 60) return null;
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

// 📊 "Your nights" (Final UX): nights out, which weekday you go out most, who you're out with most
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function nightsStats(plans, now = new Date()) {
  const past = (plans || []).filter((p) => planBucket(p, now) !== 'upcoming');
  const days = [0, 0, 0, 0, 0, 0, 0];
  const crew = {};
  past.forEach((p) => {
    const d = planDay(p.party_date, p.created_at, now) || new Date(p.created_at);
    days[d.getDay()]++;
    (p.party_members || [])
      .filter((m) => m.name !== 'Me' && m.rsvp !== 'out')
      .forEach((m) => { crew[m.name] = (crew[m.name] || 0) + 1; });
  });
  // Mon → Sun reads better on a chart
  const week = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ day: WEEK[i], count: days[i] }));
  const top = Math.max(...days);
  const favDay = top ? WEEK[days.indexOf(top)] : null;
  const squad = Object.entries(crew).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  const month = past.filter((p) => {
    const d = planDay(p.party_date, p.created_at, now) || new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  return { nights: past.length, month, week, favDay, squad };
}

// ⏰ When the night starts: the plan's day + the first stop's time ("9:30 PM"), or null if we don't know
export function startTime(p, now = new Date()) {
  const d = planDay(p && p.party_date, p && p.created_at, now);
  const first = (Array.isArray(p && p.stops) ? p.stops : []).find((x) => x && x.time);
  if (!d || !first) return null;
  const m = String(first.time).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let h = +m[1];
  const min = +(m[2] || 0);
  if (h > 23 || min > 59) return null;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min);
}

// "02:14:09" until it starts (null once started or more than a day away)
export function untilStart(p, now = new Date()) {
  const t = startTime(p, now);
  if (!t) return null;
  const s = Math.floor((t - now) / 1000);
  if (s <= 0 || s > 24 * 3600) return null;
  const two = (n) => String(n).padStart(2, '0');
  return { h: two(Math.floor(s / 3600)), m: two(Math.floor((s % 3600) / 60)), s: two(s % 60) };
}
