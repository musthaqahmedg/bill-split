import { supabase } from './supabaseClient';
import { track } from './track';

// Safe-night streaks 🔥
// Rules: never reward drinking more, never count drinks. Only safe habits count.
// A night counts if you got home safe AND (you were sober / the driver, OR you ate first,
// had water between drinks and stayed within your limit).
// The streak only counts nights you go out, so staying in never breaks it (rest days are free).

export const HABITS = [
  { key: 'ate_first', label: 'Ate before my first drink', emoji: '🍗' },
  { key: 'water', label: 'Had water between drinks', emoji: '🥤' },
  { key: 'own_limit', label: 'Stayed within my own limit', emoji: '🙂' },
  { key: 'home_safe', label: 'Got home safe', emoji: '🏠' },
];
export const EXTRAS = [
  { key: 'sober', label: 'Sober / mocktail night', emoji: '🧃' },
  { key: 'driver', label: 'I was the driver', emoji: '🛡️' },
];

export const BADGES = [
  { id: 'hydration_hero', name: 'Hydration Hero', icon: '🥤', field: 'water', count: 5, how: 'Water between drinks on 5 nights' },
  { id: 'snack_smart', name: 'Snack Smart', icon: '🍗', field: 'ate_first', count: 10, how: 'Ate first on 10 nights' },
  { id: 'safe_rider', name: 'Safe Rider', icon: '🚕', field: 'home_safe', count: 7, how: 'Got home safe 7 times' },
  { id: 'party_guardian', name: 'Party Guardian', icon: '🛡️', field: 'driver', count: 3, how: 'Designated driver 3 times' },
  { id: 'mocktail_mood', name: 'Mocktail Mood', icon: '🧃', field: 'sober', count: 3, how: '3 sober / mocktail nights' },
];

export const isSafe = (n) =>
  !!n.home_safe && (n.sober || n.driver || (n.ate_first && n.water && n.own_limit));

export async function getNights() {
  const { data, error } = await supabase
    .from('safe_nights')
    .select('*')
    .order('night_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getNight(partyId) {
  const { data } = await supabase.from('safe_nights').select('*').eq('party_id', partyId).maybeSingle();
  return data;
}

// current_streak, best_streak, last_party_date, badges_unlocked
export function stats(nights) {
  let current = 0;
  for (const n of nights) {
    if (!isSafe(n)) break;
    current++;
  }
  let best = 0;
  let run = 0;
  for (const n of [...nights].reverse()) {
    run = isSafe(n) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const badges = BADGES.map((b) => {
    const have = nights.filter((n) => n[b.field]).length;
    return { ...b, have: Math.min(have, b.count), unlocked: have >= b.count };
  });
  return { current, best, last: nights[0] ? nights[0].night_date : null, badges, total: nights.length };
}

// Save tonight's check-in, then tell the group you're home
export async function saveNight(party, meMember, answers) {
  track('party', "checked in: I'm home");
  const row = { party_id: party.id, ...answers }; // night_date = today (set by the database)
  const { error } = await supabase.from('safe_nights').upsert(row, { onConflict: 'user_id,party_id' });
  if (error) throw error;
  if (answers.home_safe && meMember && party.share_token) {
    await supabase.rpc('party_home', { p_token: party.share_token, p_member: meMember.id, p_home: true });
  }
  if (meMember && party.share_token) {
    await supabase.rpc('party_driver', { p_token: party.share_token, p_member: meMember.id, p_on: !!answers.driver });
  }
  const all = await getNights();
  const s = stats(all);
  const before = stats(all.filter((n) => n.party_id !== party.id));
  const newBadges = s.badges.filter((b) => b.unlocked && !before.badges.find((x) => x.id === b.id).unlocked);
  return { ...s, newBadges, safe: isSafe(answers) };
}

// Host picks the designated driver
export async function setDriver(memberId, on) {
  const { error } = await supabase.from('party_members').update({ is_driver: on }).eq('id', memberId);
  if (error) throw error;
}

// Fun lines, never about drinking more
export const CHEERS = [
  'Water check 💧 your liver says hi',
  'Snacks first, main character later 🍗',
  'Home safe? Slay 🏠',
  'Cab booked? Legend 🚕',
];
