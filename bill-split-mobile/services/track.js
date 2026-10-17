import { supabase } from './supabaseClient';

// 📊 Live activity: which screens people open and what they do (founders see it in Activity)
const NAMES = {
  home: 'Home', upload: 'Scan bill', recheck: 'Check items', people: 'Add people', items: 'Who had what', split: 'Split result',
  profile: 'Profile', detail: 'Bill details', parties: 'Plans', newParty: 'New plan', party: 'Plan', partyChat: 'Party chat',
  groups: 'Groups', group: 'Group', nearby: 'Nearby', activity: 'Activity',
};
export const screenName = (s) => NAMES[s] || s;

let last = '';
export function track(screen, action = 'open', detail = null) {
  const key = `${screen}|${action}|${detail}`;
  if (action === 'open' && key === last) return; // same screen twice in a row
  last = key;
  supabase
    .from('app_events')
    .insert({ screen: screenName(screen), action, detail: detail ? String(detail).slice(0, 120) : null })
    .then(() => {}, () => {});
}

export async function isAdmin() {
  const { data } = await supabase.rpc('is_admin');
  return !!data;
}
