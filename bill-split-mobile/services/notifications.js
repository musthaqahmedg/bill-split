import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// 🔔 In-app notifications (friend requests, party chat, RSVPs, asks, bookings)

export async function listNotifications() {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function markAllRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}

// Live: call onNew(notification) whenever a new one arrives for me
export function onNotification(onNew) {
  let ch = null;
  let alive = true;
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!alive || !user) return;
    ch = supabase
      .channel('notif-' + user.id + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => onNew(p.new))
      .subscribe();
  });
  return () => {
    alive = false;
    if (ch) supabase.removeChannel(ch);
  };
}

// Unread count that updates live
export function useUnread() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const load = () =>
      supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then(({ count }) => setN(count || 0), () => {});
    load();
    const off = onNotification(() => load());
    const t = setInterval(load, 60000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);
  return [n, setN];
}

// Where tapping a notification goes
let navigate = null;
export const setNotificationNavigator = (fn) => (navigate = fn);
export const openNotification = (n) => navigate && navigate(n);

export const ICON = { pay: '💸', birthday: '🎂', friend_request: '👫', friend_accept: '🎉', chat: '💬', party: '🎈', feedback: '📝' };
