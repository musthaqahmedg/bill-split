import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabaseClient';

// 🟢 Activity status, like Instagram: "Active now", "Active 5m ago"

// Tell the server "I'm here" every minute while the app is open
let timer = null;
export function startPresence() {
  const ping = () => supabase.rpc('ping_active').then(() => {}, () => {});
  const start = () => {
    ping();
    clearInterval(timer);
    timer = setInterval(ping, 60 * 1000);
  };
  start();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') start();
    else clearInterval(timer);
  });
  return () => {
    clearInterval(timer);
    sub.remove();
  };
}

const phoneKey = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  return d ? d.slice(-10) : null;
};
const keysOf = (m) => [phoneKey(m.phone), m.email ? m.email.trim().toLowerCase() : null].filter(Boolean);

export function activeLabel(lastSeen) {
  if (!lastSeen) return null;
  const min = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  if (min < 3) return { now: true, text: 'Active now' };
  if (min < 60) return { now: false, text: `Active ${Math.floor(min)}m ago` };
  if (min < 24 * 60) return { now: false, text: `Active ${Math.floor(min / 60)}h ago` };
  return null; // older than a day: show nothing (like Instagram)
}

// Friends in your plans and groups → their status. Refreshes every minute.
export function useFriendsActive() {
  const [map, setMap] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () =>
      supabase.rpc('friends_active').then(({ data }) => {
        if (!alive || !data) return;
        const m = {};
        for (const r of data) m[r.key] = r.last_seen;
        setMap(m);
      }, () => {});
    load();
    const t = setInterval(load, 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (person) => {
    for (const k of keysOf(person)) if (map[k]) return activeLabel(map[k]);
    return null;
  };
}

export async function setShowActive(on) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').upsert({ id: user.id, show_active: on });
  if (error) throw error;
}
export async function getShowActive() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('profiles').select('show_active').eq('id', user.id).maybeSingle();
  return data ? data.show_active !== false : true;
}
