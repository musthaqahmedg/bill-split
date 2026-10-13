import * as Location from 'expo-location';

// Places come from OpenStreetMap: free, no API key, no bill.
// Nearby list: Overpass API. Search while typing: Photon.

export const PALAKKAD = { lat: 10.7867, lon: 76.6548, fallback: true };

export const CATEGORIES = [
  { key: 'all', label: 'All', amenity: 'restaurant|bar|pub|cafe|fast_food|food_court|nightclub|biergarten', hotels: true },
  { key: 'food', label: '🍽️ Food', amenity: 'restaurant|fast_food|food_court' },
  { key: 'bars', label: '🍻 Bars', amenity: 'bar|pub|nightclub|biergarten' },
  { key: 'cafes', label: '☕ Cafés', amenity: 'cafe' },
  { key: 'hotels', label: '🏨 Hotels', amenity: null, hotels: true },
];

const EMOJI = {
  restaurant: '🍽️', fast_food: '🍔', food_court: '🍽️', bar: '🍻', pub: '🍺',
  nightclub: '🪩', biergarten: '🍺', cafe: '☕', hotel: '🏨',
};

// Ask for the phone's location once. If they say no, we use Palakkad town.
let cached = null;
export async function getMyLocation() {
  if (cached) return cached;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return PALAKKAD;
    const last = await Location.getLastKnownPositionAsync();
    const pos = last || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    cached = { lat: pos.coords.latitude, lon: pos.coords.longitude, fallback: false };
    return cached;
  } catch (e) {
    return PALAKKAD;
  }
}

// Distance in km between two points
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const showKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// ---- "Open now" from OpenStreetMap opening_hours, e.g. "Mo-Su 11:00-23:00" ----
// Returns true (open), false (closed) or null (unknown / too complex to read).
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function daysIn(spec) {
  const out = new Set();
  for (const part of spec.split(',')) {
    const [a, b] = part.trim().split('-');
    if (!ORDER.includes(a)) return null;
    if (!b) { out.add(a); continue; }
    if (!ORDER.includes(b)) return null;
    let i = ORDER.indexOf(a);
    for (let n = 0; n < 7; n++) {
      out.add(ORDER[i]);
      if (ORDER[i] === b) break;
      i = (i + 1) % 7;
    }
  }
  return out;
}

const mins = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function isOpenNow(hours, now = new Date()) {
  if (!hours) return null;
  const h = hours.trim();
  if (h === '24/7') return true;
  const today = DAYS[now.getDay()];
  const yesterday = DAYS[(now.getDay() + 6) % 7];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let result = null;
  try {
    for (const raw of h.split(';')) {
      const rule = raw.trim();
      if (!rule) continue;
      const m = /^([A-Za-z,\- ]+?)\s+(.+)$/.exec(rule);
      let days = new Set(ORDER);
      let times = rule;
      if (m && /^[A-Z][a-z]/.test(m[1])) {
        const d = daysIn(m[1].replace(/\s/g, ''));
        if (!d) return null; // holidays, months etc.: too complex
        days = d;
        times = m[2];
      }
      const appliesToday = days.has(today);
      const appliesYesterday = days.has(yesterday);
      if (/^(off|closed)$/i.test(times.trim())) {
        if (appliesToday) result = false;
        continue;
      }
      let openHere = false;
      let validToday = false;
      for (const span of times.split(',')) {
        const [s, e] = span.split('-');
        const start = mins(s || '');
        let end = mins(e || '');
        if (start === null || end === null) return null;
        if (end <= start) end += 24 * 60; // goes past midnight
        if (appliesToday) {
          validToday = true;
          if (nowMin >= start && nowMin < end) openHere = true;
        }
        // last night's hours running past midnight
        if (appliesYesterday && end > 24 * 60 && nowMin < end - 24 * 60) openHere = true;
      }
      if (validToday || openHere) result = openHere;
    }
  } catch (e) {
    return null;
  }
  return result;
}

const toPlace = (tags, lat, lon, me) => ({
  id: `${lat},${lon},${tags.name}`,
  name: tags.name,
  emoji: EMOJI[tags.amenity] || EMOJI[tags.tourism] || '📍',
  area: [tags['addr:street'], tags['addr:suburb'] || tags['addr:city']].filter(Boolean).join(', '),
  km: me ? distanceKm(me, { lat, lon }) : null,
  open: isOpenNow(tags.opening_hours),
});

// Places near you, without typing anything.
// Remembered for 10 minutes, gives up after 12s, and tries a second server if the first is slow.
const nearbyCache = new Map();
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(query) {
  let lastError;
  for (const url of SERVERS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('Server busy');
      return await res.json();
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastError;
}

export async function nearbyPlaces(me, categoryKey = 'all', radius = 2500) {
  const key = `${categoryKey}|${me.lat.toFixed(3)}|${me.lon.toFixed(3)}`;
  const hit = nearbyCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.places;

  const cat = CATEGORIES.find((c) => c.key === categoryKey) || CATEGORIES[0];
  const around = `(around:${radius},${me.lat},${me.lon})`;
  const parts = [];
  if (cat.amenity) parts.push(`nwr["amenity"~"^(${cat.amenity})$"]["name"]${around};`);
  if (cat.hotels) parts.push(`nwr["tourism"="hotel"]["name"]${around};`);
  const query = `[out:json][timeout:10];(${parts.join('')});out center tags 60;`;
  const data = await overpass(query);
  const places = (data.elements || [])
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      return lat == null ? null : toPlace(el.tags || {}, lat, lon, me);
    })
    .filter((p) => p && p.name)
    .sort((a, b) => a.km - b.km);
  nearbyCache.set(key, { at: Date.now(), places });
  return places;
}

// Search while typing, closest results first
export async function searchPlaces(q, me, categoryKey = 'all') {
  const cat = CATEGORIES.find((c) => c.key === categoryKey) || CATEGORIES[0];
  const tags = [
    ...(cat.amenity ? cat.amenity.split('|').map((a) => `amenity:${a}`) : []),
    ...(cat.hotels ? ['tourism:hotel'] : []),
  ].map((t) => `&osm_tag=${encodeURIComponent(t)}`).join('');
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${me.lat}&lon=${me.lon}&limit=10&lang=en${tags}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.features || [])
    .map((f) => {
      const p = f.properties || {};
      const [lon, lat] = f.geometry?.coordinates || [];
      return {
        id: `${p.osm_type}${p.osm_id}`,
        name: p.name,
        emoji: EMOJI[p.osm_value] || '📍',
        area: [p.street, p.district || p.locality, p.city || p.county].filter(Boolean).join(', '),
        km: lat != null ? distanceKm(me, { lat, lon }) : null,
        open: null, // Photon doesn't give opening hours
      };
    })
    .filter((r) => r.name);
}
