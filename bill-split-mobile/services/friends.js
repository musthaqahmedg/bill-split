import { supabase } from './supabaseClient';
import { track } from './track';

// 👫 Friends on Vibe Out (requests both ways)

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

export const myFriends = () => rpc('my_friends');
export const findUser = (q) => rpc('find_user', { p_query: q.trim() }).then((r) => (r && r[0]) || null);
export const sendRequest = (userId) => {
  track('friends', 'sent a friend request');
  return rpc('send_friend_request', { p_user: userId });
};
export const respond = (userId, accept) => rpc('respond_friend_request', { p_user: userId, p_accept: accept });
export const removeFriend = (userId) => rpc('remove_friend', { p_user: userId });

const keyOf = (m) => {
  if (m.email) return m.email.trim().toLowerCase();
  const d = String(m.phone || '').replace(/\D/g, '');
  return d ? d.slice(-10) : null;
};
// Which people (with phone/email) are on Vibe Out → { key: { user_id, status, incoming } }
export async function appUsers(people) {
  const keys = [];
  for (const m of people) {
    const d = String(m.phone || '').replace(/\D/g, '');
    if (d) keys.push(d.slice(-10));
    if (m.email) keys.push(m.email.trim().toLowerCase());
  }
  if (!keys.length) return {};
  const rows = await rpc('app_users_in', { p_keys: keys });
  const out = {};
  for (const r of rows || []) out[r.key] = r;
  return out;
}
export const lookupKeys = (m) => {
  const ks = [];
  const d = String(m.phone || '').replace(/\D/g, '');
  if (d) ks.push(d.slice(-10));
  if (m.email) ks.push(m.email.trim().toLowerCase());
  return ks;
};
export { keyOf };
