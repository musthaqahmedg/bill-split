import * as ImagePicker from 'expo-image-picker';
import { shrink, toBytes } from './photos';
import { supabase } from './supabaseClient';

// Your own profile: name, phone, UPI ID
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, upi_id, home_address, bio, avatar_path, instagram, linkedin')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data || { id: user.id, phone: user.phone, name: '', upi_id: '' };
}

export async function saveProfile({ name, upi_id, bio, instagram, linkedin }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  const row = { id: user.id, phone: user.phone, name: name.trim(), upi_id: upi_id.trim() || null };
  if (bio !== undefined) row.bio = bio.trim().slice(0, 150) || null;
  if (instagram !== undefined) row.instagram = cleanInsta(instagram) || null;
  if (linkedin !== undefined) row.linkedin = linkedin.trim() || null;
  const { error } = await supabase.from('profiles').upsert(row);
  if (error) throw error;
}

// "@musthaq", "instagram.com/musthaq/" → "musthaq"
export const cleanInsta = (v) => (v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
export const instaUrl = (h) => `https://instagram.com/${h}`;
export const linkedinUrl = (v) => (/^https?:/i.test(v) ? v : `https://www.linkedin.com/in/${v.replace(/^\/?(in\/)?/, '')}`);
export const avatarUrl = (path) => (path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null);

// 📸 Pick a profile photo, square-ish and small, and save it
export async function pickAvatar(fromCamera = false) {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true } /* gallery = system photo picker, needs no permission (Google Play photo rule) */;
  if (!perm.granted) throw new Error(fromCamera ? 'Please allow camera access.' : 'Please allow photo access.');
  const opts = { quality: 0.8, allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] };
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front })
    : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return null;
  const small = await shrink(res.assets[0], 512);
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${user.id}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, toBytes(small.base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  const { error: e2 } = await supabase.from('profiles').upsert({ id: user.id, avatar_path: path });
  if (e2) throw e2;
  return path;
}

// A UPI ID looks like name@bank, e.g. musthaq@okaxis
export const isValidUpi = (v) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test((v || '').trim());

// Deletes your account and all your bills (required by the App Store)
export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  await supabase.auth.signOut();
}
// Your home (for house parties): saved once, picked in one tap
export async function saveHome(address) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  const { error } = await supabase.from('profiles').upsert({ id: user.id, home_address: (address || '').trim() || null });
  if (error) throw error;
}
