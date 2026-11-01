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
  return data || [];
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
