import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { openNotification } from './notifications';
import { supabase } from './supabaseClient';

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
        lightColor: '#8B5CF6',
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
export function listenPushTaps() {
  const open = (r) => {
    if (!r) return;
    const c = r.notification.request.content;
    openNotification({ title: c.title, body: c.body, data: c.data || {} });
  };
  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
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
