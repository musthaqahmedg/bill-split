import { supabase } from './supabaseClient';
import { createParty } from './parties';
import { track } from './track';

// 🎂 Birthdays: day + month only (no year). Needed to join the friend circle.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const daysIn = (m) => [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
export const bdayText = (d, m) => (d && m ? `${d} ${MONTHS[m - 1]}` : '');

export async function myBirthday() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from('profiles').select('bday_day, bday_month').eq('id', user.id).maybeSingle();
  return data && data.bday_day ? { day: data.bday_day, month: data.bday_month } : null;
}

export async function saveBirthday(day, month) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').upsert({ id: user.id, bday_day: day, bday_month: month });
  if (error) throw error;
  track('profile', 'added birthday');
}

export async function friendsBirthdays() {
  const { data, error } = await supabase.rpc('friends_birthdays');
  if (error) throw error;
  return data || [];
}

export const whenText = (days) => (days === 0 ? 'Today! 🎉' : days === 1 ? 'Tomorrow' : `In ${days} days`);

// 🎉 "Plan the treat": a birthday plan where the birthday person pays
export async function planTheTreat(friend) {
  const d = new Date();
  d.setDate(d.getDate() + friend.days_until);
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  track('friends', 'planned a birthday treat');
  return createParty({
    title: `${friend.name.split(' ')[0]}'s birthday treat 🎂`,
    kind: 'birthday',
    party_date: date,
    place: '',
    budget: 0,
    people: ['Me', friend.name],
    mode: 'treat',
    special: friend.name,
  });
}
