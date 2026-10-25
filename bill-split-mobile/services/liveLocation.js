import * as Location from 'expo-location';
import { supabase } from './supabaseClient';

// 📍 Live location for a plan's crew (like WhatsApp). Updates while the app is open, for the time you pick.
// The server deletes it as soon as sharing ends.
let watcher = null;
let current = null; // { partyId, until }

export const sharingFor = (partyId) => (current && current.partyId === partyId && current.until > Date.now() ? current : null);

export async function startLive(party, memberId, minutes) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Allow location to share it with your crew.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { data: until, error } = await supabase.rpc('share_location', {
    p_token: party.share_token, p_member: memberId,
    p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy || null, p_minutes: minutes,
  });
  if (error) throw error;
  await stopWatch();
  current = { partyId: party.id, until: new Date(until).getTime() };
  watcher = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 20000, distanceInterval: 25 },
    async (p) => {
      if (!current || current.until < Date.now()) return stopWatch();
      const { data } = await supabase.rpc('share_location', {
        p_token: party.share_token, p_member: memberId,
        p_lat: p.coords.latitude, p_lng: p.coords.longitude, p_accuracy: p.coords.accuracy || null, p_minutes: null,
      });
      if (!data) stopWatch(); // ended on the server
    }
  );
  return current;
}

async function stopWatch() {
  try {
    if (watcher) watcher.remove();
  } catch (e) {}
  watcher = null;
}

export async function stopLive(party, memberId) {
  await stopWatch();
  current = null;
  const { error } = await supabase.rpc('stop_location', { p_token: party.share_token, p_member: memberId });
  if (error) throw error;
}

export async function crewLocations(party) {
  const { data, error } = await supabase.rpc('get_locations', { p_token: party.share_token });
  if (error) throw error;
  return data || [];
}

export { km, distText } from './distance';
