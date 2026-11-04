import { createParty, listParties } from './parties';
import { planBucket, planDay } from './when';

// 🗂️ Find the Space a bill / booking belongs to, so we never make duplicates:
// 1) a Space today at the same place → 2) the one Space live tonight → 3) otherwise make a new one
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export async function findOrCreateSpace({ place, title, kind, dateText, people = ['Me'], allowLive = true }) {
  try {
    const all = await listParties();
    const today = new Date();
    const target = planDay(dateText, null, today) || today; // the day the bill / booking is for
    const isToday = (p) => {
      const d = planDay(p.party_date, p.created_at, today);
      return d && d.toDateString() === target.toDateString();
    };
    const key = norm(place);
    const samePlace = key ? all.find((p) => isToday(p) && norm(p.place).includes(key.slice(0, 12))) : null;
    if (samePlace) return { id: samePlace.id, created: false };
    const live = all.filter((p) => planBucket(p, today) === 'live');
    if (allowLive && target.toDateString() === today.toDateString() && live.length === 1) return { id: live[0].id, created: false };
  } catch (e) {}
  const sp = await createParty({ title: (title || 'Hangout').slice(0, 60), kind, party_date: dateText, place: place || '', budget: 0, people: people.includes('Me') ? people : ['Me', ...people] });
  return { id: sp.id, created: true };
}
