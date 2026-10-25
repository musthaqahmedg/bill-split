import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { supabase } from './supabaseClient';
import { track } from './track';

// Place suggestions come through our own server function ("places"),
// which searches free OpenStreetMap data around you.

export const PALAKKAD = { lat: 10.7867, lon: 76.6548 };

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'food', label: '🍽️ Food' },
  { key: 'bars', label: '🍻 Bars' },
  { key: 'cafes', label: '☕ Cafés' },
  { key: 'hotels', label: '🏨 Hotels' },
  { key: 'cinema', label: '🎬 Cinemas' },
  { key: 'stays', label: '🛏️ Stays' },
  { key: 'spots', label: '🏞️ Spots' },
];

export const EMOJI = {
  restaurant: '🍽️', fast_food: '🍔', food_court: '🍽️', bar: '🍻', pub: '🍺',
  nightclub: '🪩', cafe: '☕', hotel: '🏨', cinema: '🎬', guest_house: '🏡', resort: '🏝️', hostel: '🛏️',
  chalet: '🏡', apartment: '🏢', motel: '🛏️', attraction: '📸', viewpoint: '🌄', museum: '🏛️', waterfall: '💦',
  beach: '🏖️', peak: '⛰️', park: '🌳', nature_reserve: '🌿', fort: '🏰', castle: '🏰', dam: '🌊', place_of_worship: '🛕',
};

// Where are you?
// status: 'granted' (using your real location), 'denied' (you said no, we can ask again),
//         'blocked' (turned off in phone Settings), 'off' (phone location services are off)
export async function getMyLocation({ ask = true } = {}) {
  try {
    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) return { status: 'off', coords: PALAKKAD };

    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && ask && perm.canAskAgain) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (perm.status !== 'granted') {
      return { status: perm.canAskAgain ? 'denied' : 'blocked', coords: PALAKKAD };
    }
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    const pos = last || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { status: 'granted', coords: { lat: pos.coords.latitude, lon: pos.coords.longitude } };
  } catch (e) {
    return { status: 'denied', coords: PALAKKAD };
  }
}

// When location is blocked, the only way back is the phone's Settings
export const openPhoneSettings = () => Linking.openSettings();

export const showKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// Nearby (q empty) or search (q typed). Results are remembered for 10 minutes.
const cache = new Map();
export async function findPlaces(coords, q = '', category = 'all') {
  const text = q.trim();
  const key = `${category}|${text.toLowerCase()}|${coords.lat.toFixed(3)}|${coords.lon.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.places;

  const { data, error } = await supabase.functions.invoke('places', {
    body: { lat: coords.lat, lon: coords.lon, q: text, category },
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  const places = (data.places || []).map((p) => ({ ...p, emoji: EMOJI[p.kind] || '📍' }));
  cache.set(key, { at: Date.now(), places });
  return places;
}

// Places our users have scanned bills at (they have a "Popular here" menu)
export async function knownPlaces(q = '') {
  const { data, error } = await supabase.rpc('known_places', { p_q: q.trim() });
  if (error) return [];
  return data || [];
}

// Your current spot as a readable address, e.g. "12 Nehru Road, Kalmandapam, Palakkad"
export async function currentAddress() {
  const loc = await getMyLocation({ ask: true });
  if (loc.status !== 'granted') return { status: loc.status, address: '' };
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: loc.coords.lat, longitude: loc.coords.lon });
    if (!a) return { status: 'granted', address: '' };
    const parts = [a.name && a.name !== a.street ? a.name : null, a.street, a.district || a.subregion, a.city]
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i);
    return { status: 'granted', address: parts.join(', ') };
  } catch (e) {
    return { status: 'granted', address: '' };
  }
}

// ---------- Nearby screen ----------

export const NEARBY = [
  { key: 'restobars', label: '🍻 Restobars', adult: true },
  { key: 'pubs', label: '🍺 Pubs', adult: true },
  { key: 'cafes', label: '☕ Cafés' },
  { key: 'food', label: '🍽️ Restaurants' },
  { key: 'supermarkets', label: '🛒 Supermarkets' },
];
Object.assign(EMOJI, {
  supermarket: '🛒', convenience: '🏪', department_store: '🏬', general: '🏪', grocery: '🛒',
  alcohol: '🍾', beverages: '🍾', wine: '🍷', tobacco: '🌿', kiosk: '🌿', brewery: '🍺', biergarten: '🍺', 'e-cigarette': '🌿',
});

// Phone + opening hours (only some places have them on the map)
const detailCache = new Map();
export async function placeDetails(ids) {
  const need = ids.filter((id) => !detailCache.has(id));
  if (need.length) {
    const { data } = await supabase.functions.invoke('places', { body: { details: need } });
    for (const id of need) detailCache.set(id, (data && data.details && data.details[id]) || {});
  }
  return Object.fromEntries(ids.map((id) => [id, detailCache.get(id) || {}]));
}

// "Mo-Sa 09:00-22:00; Su 10:00-14:00" → { open, label } (null if we can't read it)
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const showTime = (min) => {
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
};
function dayMatches(spec, day) {
  if (!spec) return true;
  return spec.split(',').some((part) => {
    const [a, b] = part.split('-');
    const i = DAYS.indexOf(a);
    if (i < 0) return false;
    if (!b) return i === day;
    const j = DAYS.indexOf(b);
    if (j < 0) return false;
    return i <= j ? day >= i && day <= j : day >= i || day <= j;
  });
}
export function openStatus(hours, now = new Date()) {
  if (!hours) return null;
  const h = hours.trim();
  if (h === '24/7') return { open: true, label: 'Open 24 hours', late: true };
  const day = now.getDay();
  const min = now.getHours() * 60 + now.getMinutes();
  let ranges = null;
  let lateClose = 0;
  for (const rule of h.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/);
    if (!m) return null;
    const times = m[2].trim();
    if (/^(PH|SH)/.test(rule)) continue;
    // Yesterday's late-night hours (e.g. Fri 18:00-02:00 still open at 1 AM Saturday)
    const yesterday = (day + 6) % 7;
    if (times !== 'off' && dayMatches(m[1], yesterday)) {
      for (const r of times.split(',')) {
        const [a, b] = r.split('-');
        if (!a || !b) continue;
        if (toMin(b) <= toMin(a) && min < toMin(b)) lateClose = toMin(b);
      }
    }
    if (!dayMatches(m[1], day)) continue;
    if (times === 'off' || times === 'closed') {
      ranges = [];
      continue;
    }
    const list = [];
    for (const r of times.split(',')) {
      const [a, b] = r.split('-');
      if (!/^\d{1,2}:\d{2}$/.test(a || '') || !/^\d{1,2}:\d{2}\+?$/.test(b || '')) return null;
      let s = toMin(a);
      let e = toMin(b.replace('+', ''));
      if (e <= s) e += 1440; // closes after midnight
      list.push([s, e]);
    }
    ranges = list; // later rules override earlier ones
  }
  if (lateClose) return { open: true, label: `Open till ${showTime(lateClose)}`, late: true };
  if (ranges === null) return null;
  const now1 = ranges.find(([s, e]) => min >= s && min < e);
  if (now1) {
    const closesSoon = now1[1] - min <= 60;
    return { open: true, label: closesSoon ? `Closing soon · ${showTime(now1[1])}` : `Open till ${showTime(now1[1])}`, late: now1[1] >= 23 * 60, soon: closesSoon };
  }
  const next = ranges.find(([s]) => s > min);
  return { open: false, label: next ? `Closed · opens ${showTime(next[0])}` : 'Closed now', late: ranges.some(([, e]) => e >= 23 * 60) };
}

export const directionsUrl = (p) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

// ⭐ Saved places
export async function listSaved() {
  const { data, error } = await supabase.from('saved_places').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, id: p.place_id, emoji: EMOJI[p.kind] || '📍' }));
}
export async function savePlace(p, category) {
  track('nearby', 'saved a place', p.name);
  const { error } = await supabase.from('saved_places').upsert(
    { place_id: p.id, name: p.name, kind: p.kind, area: p.area, lat: p.lat, lon: p.lon, category },
    { onConflict: 'user_id,place_id' }
  );
  if (error) throw error;
}
export async function unsavePlace(id) {
  const { error } = await supabase.from('saved_places').delete().eq('place_id', id);
  if (error) throw error;
}
