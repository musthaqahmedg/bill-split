import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyLocation } from './places';
import { supabase } from './supabaseClient';

// 🎉 Big nearby events (Halloween, New Year, concerts). Added by admins; shown as a pop-up + "Events near you" on Home.
const SEEN = 'vo_events_seen_v1'; // { [eventId]: 'seen' | remindAfterMs }
const DAY = 864e5;

export async function eventsNear({ ask = false, radiusKm = 25 } = {}) {
  const loc = await getMyLocation({ ask });
  const { data, error } = await supabase.rpc('events_near', {
    p_lat: loc.coords.lat,
    p_lng: loc.coords.lon,
    p_radius_km: radiusKm,
    p_city: loc.status === 'granted' ? null : 'Palakkad', // no location → the default city
  });
  if (error) throw error;
  if (loc.status === 'granted') saveMyCity(loc.coords.lat, loc.coords.lon); // city name only, for event alerts
  return data || [];
}

// 🏙️ Cities we cover (same list as the admin page). We only ever save the city NAME, never your exact location.
export const CITIES = {
  Palakkad: [10.7867, 76.6548], Kochi: [9.9312, 76.2673], Thrissur: [10.5276, 76.2144], Kozhikode: [11.2588, 75.7804],
  Thiruvananthapuram: [8.5241, 76.9366], Coimbatore: [11.0168, 76.9558], Bengaluru: [12.9716, 77.5946], Chennai: [13.0827, 80.2707],
  Hyderabad: [17.385, 78.4867], Mumbai: [19.076, 72.8777], Delhi: [28.6139, 77.209], Goa: [15.2993, 74.124],
};
const rad = (d) => (d * Math.PI) / 180;
export function nearestCity(lat, lon, maxKm = 60) {
  let best = null;
  let bestKm = Infinity;
  Object.entries(CITIES).forEach(([name, [la, lo]]) => {
    const a = Math.sin(rad(la - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(la)) * Math.sin(rad(lo - lon) / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(a));
    if (km < bestKm) { bestKm = km; best = name; }
  });
  return bestKm <= maxKm ? best : null;
}
async function saveMyCity(lat, lon) {
  try {
    const city = nearestCity(lat, lon);
    if (!city || (await AsyncStorage.getItem('vo_event_city')) === city) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ event_city: city }).eq('id', user.id);
    if (!error) AsyncStorage.setItem('vo_event_city', city).catch(() => {});
  } catch (e) {}
}

// 🔔 Event alerts setting (Profile): on/off + which city
export async function getEventAlerts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { on: true, city: null };
  const { data } = await supabase.from('profiles').select('event_alerts, event_city').eq('id', user.id).maybeSingle();
  return { on: data ? data.event_alerts !== false : true, city: (data && data.event_city) || null };
}
export async function setEventAlerts(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  const row = {};
  if ('on' in patch) row.event_alerts = patch.on;
  if ('city' in patch) row.event_city = patch.city;
  const { error } = await supabase.from('profiles').update(row).eq('id', user.id);
  if (error) throw error;
  if ('city' in patch) AsyncStorage.setItem('vo_event_city', patch.city || '').catch(() => {});
}

// One event by id (opening an event alert)
export async function getEvent(id) {
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  return data;
}

async function seenMap() {
  try {
    return JSON.parse((await AsyncStorage.getItem(SEEN)) || '{}');
  } catch (e) {
    return {};
  }
}
const save = (m) => AsyncStorage.setItem(SEEN, JSON.stringify(m)).catch(() => {});

// Which events should pop up now: not seen yet, or "remind me later" time has passed
export async function eventsToPop(list, now = Date.now()) {
  const m = await seenMap();
  return (list || []).filter((e) => e.status !== 'sold_out' && (!m[e.id] || (m[e.id] !== 'seen' && now >= m[e.id])));
}
export async function markSeen(ids) {
  const m = await seenMap();
  ids.forEach((id) => (m[id] = 'seen'));
  save(m);
}
export async function remindLater(ids, now = Date.now()) {
  const m = await seenMap();
  ids.forEach((id) => (m[id] = now + DAY));
  save(m);
}

export const eventWhen = (e) =>
  new Date(e.start_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const eventKm = (km) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(km < 10 ? 1 : 0)} km away`);

// 🙋 Who's going: me, total, and my friends' names
export async function goingInfo(eventId) {
  const { data, error } = await supabase.rpc('event_going_info', { p_event: eventId });
  if (error) throw error;
  const r = (data && data[0]) || {};
  return { going: !!r.going, total: r.total || 0, friends: r.friends || [] };
}
export async function setGoing(eventId, on) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in');
  const q = on
    ? supabase.from('event_going').upsert({ event_id: eventId, user_id: user.id }, { onConflict: 'event_id,user_id', ignoreDuplicates: true })
    : supabase.from('event_going').delete().eq('event_id', eventId).eq('user_id', user.id);
  const { error } = await q;
  if (error) throw error;
}
// "Anu & Rahul are going" · "Anu, Rahul + 3 more going" · "12 people going"
export function goingText({ total, friends, going }) {
  const others = Math.max(0, total - friends.length - (going ? 1 : 0));
  if (friends.length) {
    const names = friends.slice(0, 2);
    const more = friends.length - names.length + others;
    return `${names.join(names.length === 2 && !more ? ' & ' : ', ')}${more ? ` + ${more} more` : ''} going`;
  }
  if (others) return `${others} ${others === 1 ? 'person' : 'people'} going${going ? ' + you' : ''}`;
  return going ? "You're going 🎉" : 'Be the first to say you’re going';
}
