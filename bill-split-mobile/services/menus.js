import * as ImagePicker from 'expo-image-picker';
import { shrink } from './photos';
import { supabase } from './supabaseClient';
import { track } from './track';

// 🍽️ A place's real menu: scanned menu cards + what people actually ordered there

export async function getVenueMenu(place) {
  const { data, error } = await supabase.rpc('get_venue_menu', { p_place: place });
  if (error) throw error;
  return data || [];
}

export const isVenue = (party) =>
  !!party.place && party.kind !== 'house' && !/^my place|current location/i.test(party.place.trim());

export const placeName = (place) => (place || '').split(',')[0].trim();

// 📸 Snap the menu card → AI reads it → saved for this place (everyone benefits)
export async function scanMenu(place, fromCamera) {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Please allow camera / photo access.');
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ['images'] });
  if (res.canceled) return 0;
  const small = await shrink(res.assets[0], 1600);
  const { data, error } = await supabase.functions.invoke('extract-menu', { body: { image: small.base64 } });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  const { data: n, error: e2 } = await supabase.rpc('save_venue_menu', { p_place: placeName(place), p_items: data.items });
  if (e2) throw e2;
  track('party', 'scanned a menu', placeName(place));
  return n;
}
