import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { supabase } from './supabaseClient';

// Place suggestions come through our own server function ("places"),
// which searches free OpenStreetMap data around you.

export const PALAKKAD = { lat: 10.7867, lon: 76.6548 };

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'food', label: '🍽️ Food' },
  { key: 'bars', label: '🍻 Bars' },
  { key: 'cafes', label: '☕ Cafés' },
  { key: 'hotels', label: '🏨 Hotels' },
];

export const EMOJI = {
  restaurant: '🍽️', fast_food: '🍔', food_court: '🍽️', bar: '🍻', pub: '🍺',
  nightclub: '🪩', cafe: '☕', hotel: '🏨',
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
