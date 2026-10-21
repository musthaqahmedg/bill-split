import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabaseClient';
import { track } from './track';

// 📸 Party photos (stored in Supabase Storage: party-photos/<party_id>/<file>.jpg)

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBytes(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]), b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]), d = B64.indexOf(clean[i + 3]);
    bytes[p++] = (a << 2) | (b >> 4);
    if (c >= 0 && clean[i + 2]) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && clean[i + 3]) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, p);
}

export async function shrink(asset, max = 1280) {
  const width = Math.min(asset.width || max, max);
  const IM = ImageManipulator.ImageManipulator;
  if (IM && IM.manipulate) {
    const ctx = IM.manipulate(asset.uri);
    ctx.resize({ width });
    const img = await ctx.renderAsync();
    return img.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true });
  }
  return ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width } }], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true });
}

export const photoUrl = (path) => supabase.storage.from('party-photos').getPublicUrl(path).data.publicUrl;

export async function listPhotos(partyId) {
  const { data, error } = await supabase.from('party_photos').select('*').eq('party_id', partyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, url: photoUrl(p.path) }));
}

// Pick up to 10 photos (or take one), shrink, upload, then tell the group
export async function addPhotos(partyId, fromCamera, onProgress) {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true } /* gallery = system photo picker, needs no permission (Google Play photo rule) */;
  if (!perm.granted) throw new Error('Please allow photo access to add pictures.');
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10, mediaTypes: ['images'] });
  if (res.canceled) return 0;
  const paths = [];
  let i = 0;
  for (const asset of res.assets) {
    onProgress && onProgress(++i, res.assets.length);
    const small = await shrink(asset);
    const path = `${partyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('party-photos').upload(path, toBytes(small.base64), { contentType: 'image/jpeg' });
    if (error) throw error;
    paths.push(path);
  }
  const { data, error } = await supabase.rpc('add_party_photos', { p_party: partyId, p_paths: paths });
  if (error) throw error;
  track('party', 'added photos', String(paths.length));
  return data;
}

export async function deletePhoto(photo) {
  await supabase.storage.from('party-photos').remove([photo.path]);
  const { error } = await supabase.from('party_photos').delete().eq('id', photo.id);
  if (error) throw error;
}
