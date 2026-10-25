import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { openNotification } from './notifications';
import { supabase } from './supabaseClient';
import { track } from './track';

// 📱 Lock-screen notifications (Expo push). The database sends one for every in-app notification.

// App open → our own in-app banner shows it, so the phone stays quiet (no double alert)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
  });
} catch (e) {}

let myToken = null;

export async function registerPush() {
  try {
    if (!Device.isDevice) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Plans, friends & chats',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#4C5BD4',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    myToken = token;
    await supabase.rpc('save_push_token', { p_token: token, p_platform: Platform.OS });
    return token;
  } catch (e) {
    return null; // e.g. Android Expo Go has no push; works in the real app
  }
}

// Log out → this phone stops getting your notifications
export async function unregisterPush() {
  try {
    if (myToken) await supabase.from('push_tokens').delete().eq('token', myToken);
  } catch (e) {}
  myToken = null;
}

// Tapping a lock-screen notification opens the right page (also when the app was closed)
let handled = null; // each notification opens its page only once
export function listenPushTaps() {
  const open = async (r) => {
    if (!r) return;
    const id = r.notification.request.identifier;
    if (handled === null) handled = await AsyncStorage.getItem('vibeout.pushHandled').catch(() => '');
    if (id && id === handled) return; // already opened (e.g. after a reload)
    handled = id;
    AsyncStorage.setItem('vibeout.pushHandled', id || '').catch(() => {});
    const c = r.notification.request.content;
    track('push', 'tapped', (c.data && c.data.kind) || c.title);
    openNotification({ title: c.title, body: c.body, data: c.data || {} });
  };
  const check = () => Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  check(); // opened from a closed app
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  // backup: coming back from the background, check again (Expo Go sometimes misses the live tap)
  const app = AppState.addEventListener('change', (st) => st === 'active' && setTimeout(check, 250));
  return () => {
    sub.remove();
    app.remove();
  };
}

export const clearBadge = () => Notifications.setBadgeCountAsync(0).catch(() => {});

// 🔒 Show message text on the lock screen?
export async function getPushPreview() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;
  const { data } = await supabase.from('profiles').select('push_preview').eq('id', user.id).maybeSingle();
  return data ? data.push_preview !== false : true;
}

export async function setPushPreview(on) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').update({ push_preview: on }).eq('id', user.id);
  if (error) throw error;
}

// 😂 Fun notifications (the VibeOut voice): on by default, switch off any time
export async function getFunNotifs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;
  const { data } = await supabase.from('profiles').select('fun_notifs').eq('id', user.id).maybeSingle();
  return data ? data.fun_notifs !== false : true;
}
export async function setFunNotifs(on) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').update({ fun_notifs: on }).eq('id', user.id);
  if (error) throw error;
}
