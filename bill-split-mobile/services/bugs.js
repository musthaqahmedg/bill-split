import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { shrink, toBytes } from './photos';
import { supabase } from './supabaseClient';
import { screenName, track } from './track';

// 🐞 Bug notes: shake the phone anywhere → write what went wrong → saved for the team to fix
// (stored in the `feedback` table; the team gets a 🔔 for each one)

const deviceText = () =>
  [Device.brand, Device.modelName, `${Platform.OS} ${Device.osVersion || Platform.Version}`].filter(Boolean).join(' · ');

export async function pickScreenshot() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Please allow photo access to add a screenshot.');
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
  return res.canceled ? null : res.assets[0];
}

export async function sendBug({ kind = 'bug', message, screen, photo }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u || !u.user) throw new Error('Please log in first.');
  let photo_path = null;
  if (photo) {
    const small = await shrink(photo, 1080);
    photo_path = `${u.user.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('feedback').upload(photo_path, toBytes(small.base64), { contentType: 'image/jpeg' });
    if (error) throw error;
  }
  const { error } = await supabase.from('feedback').insert({
    kind,
    message: message.trim().slice(0, 2000),
    screen: screen ? screenName(screen) : null,
    device: deviceText(),
    app_version: (Constants.expoConfig && Constants.expoConfig.version) || null,
    photo_path,
  });
  if (error) throw error;
  track('bug', 'sent', kind);
}
