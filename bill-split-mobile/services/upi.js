import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabaseClient';

// 💸 Pay with UPI: open the person's UPI app with the amount and UPI ID filled in. Money goes straight between friends.
export const validUpi = (v) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(String(v || '').trim());

const query = ({ upi, name, amount, note }) =>
  `pa=${encodeURIComponent(upi.trim())}&pn=${encodeURIComponent(name || 'Friend')}&am=${Math.round(Number(amount) || 0)}&cu=INR&tn=${encodeURIComponent((note || 'VibeOut').slice(0, 40))}`;

// Android: the plain upi:// link shows the phone's own list of UPI apps.
// iPhone: there is no such list, so each app has its own link.
export const UPI_APPS = Platform.OS === 'ios'
  ? [
      { key: 'gpay', label: 'Google Pay', url: (q) => `gpay://upi/pay?${q}` },
      { key: 'phonepe', label: 'PhonePe', url: (q) => `phonepe://pay?${q}` },
      { key: 'paytm', label: 'Paytm', url: (q) => `paytmmp://pay?${q}` },
      { key: 'bhim', label: 'BHIM', url: (q) => `bhim://pay?${q}` },
    ]
  : [{ key: 'any', label: 'Pay with UPI app', url: (q) => `upi://pay?${q}` }];

export async function openUpi(app, payment) {
  const url = app.url(query(payment));
  await Linking.openURL(url); // throws if that app isn't installed
}

// Their UPI ID: from their VibeOut profile if linked, else what you typed last time (kept on this phone)
const KEY = (name) => `vo_upi_${String(name || '').toLowerCase()}`;
export async function knownUpi({ participantId, name, shareToken, isCreator }) {
  try {
    if (participantId) {
      const { data } = await supabase.rpc('bill_payee_upi', { p_participant: participantId });
      if (validUpi(data)) return data;
    }
    if (name === 'Me' && !isCreator && shareToken) {
      const { data } = await supabase.rpc('get_shared_bill', { p_token: shareToken });
      if (data && validUpi(data.payee_upi)) return data.payee_upi;
    }
  } catch (e) {}
  const saved = await AsyncStorage.getItem(KEY(name)).catch(() => null);
  return validUpi(saved) ? saved : '';
}
export const rememberUpi = (name, upi) => AsyncStorage.setItem(KEY(name), upi.trim()).catch(() => {});
