import { supabase } from './supabaseClient';
import { track } from './track';

// Split the budget equally in whole rupees, so the shares add up exactly to the budget
export function splitEqually(budget, count) {
  const total = Math.round(Number(budget) || 0);
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count; // the first few people pay Rs 1 more
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

export async function listParties() {
  const { data, error } = await supabase
    .from('parties')
    .select('id, title, kind, party_date, place, budget, split_mode, special_person, created_at, party_members(name, share, paid_at, rsvp)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getParty(id) {
  const { data, error } = await supabase
    .from('parties')
    .select('*, party_members(id, name, share, paid_at, phone, email, rsvp, bill_requested_at, home_at, is_driver, covered_by, badge)')
    .eq('id', id)
    .single();
  if (error) throw error;
  data.party_members = (data.party_members || []).sort((a, b) => a.name.localeCompare(b.name));
  return data;
}

// How much each person pays.
// mode 'equal': everyone splits the budget
// mode 'treat': one person (special) pays everything, e.g. your birthday treat 🎁
// mode 'free' : one person (special) pays nothing, everyone else splits, e.g. friends treat the birthday person 🎂
export function sharesFor(budget, people, mode, special) {
  if (mode === 'treat' && special) {
    return people.map((p) => (p === special ? Math.round(Number(budget) || 0) : 0));
  }
  if (mode === 'free' && special) {
    const others = splitEqually(budget, people.length - 1);
    let k = 0;
    return people.map((p) => (p === special ? 0 : others[k++]));
  }
  return splitEqually(budget, people.length);
}

// people: list of names
export async function createParty({ title, kind = 'party', party_date, place, budget, people, mode = 'equal', special = null, phones = {}, emails = {}, groupId = null }) {
  track('newParty', 'created a plan', kind + ': ' + title);
  const { data: party, error: e1 } = await supabase
    .from('parties')
    .insert({
      title: title.trim(),
      kind,
      group_id: groupId,
      party_date: party_date.trim() || null,
      place: place.trim() || null,
      budget: Math.round(Number(budget) || 0),
      split_mode: mode,
      special_person: mode === 'equal' ? null : special,
    })
    .select()
    .single();
  if (e1) throw e1;

  const shares = sharesFor(budget, people, mode, special);
  const { error: e2 } = await supabase
    .from('party_members')
    .insert(people.map((name, i) => ({ party_id: party.id, name, share: shares[i], phone: phones[name] || null, email: emails[name] || null })));
  if (e2) throw e2;

  return party;
}

// Tick (or untick) that someone has paid their share
export async function setMemberPaid(memberId, paid) {
  const { error } = await supabase
    .from('party_members')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', memberId);
  if (error) throw error;
}

export async function deleteParty(id) {
  const { error } = await supabase.from('parties').delete().eq('id', id);
  if (error) throw error;
}
export const partyLink = (party) => `https://bill-split-flax.vercel.app/p/${party.share_token}`;

// WhatsApp wants the number with country code and no "+" or spaces
export const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  return d;
};

// Treats: hide the amounts from friends on the invite link (they can ask to see it)
export async function setHideBill(party, hide, hostName) {
  const { error } = await supabase.from('parties').update({ hide_bill: hide }).eq('id', party.id);
  if (error) throw error;
  if (!hide) {
    const me = (party.party_members || []).find((m) => m.name === 'Me');
    await supabase.from('party_messages').insert({
      party_id: party.id, member_id: me ? me.id : null, sender_name: hostName || 'Host',
      body: `${hostName || 'The host'} shared the bill 🧾`, kind: 'system',
    });
  }
}

// Edit a plan: update details, add/remove people, and work out everyone's share again.
// People who stay keep their answers (I'm in), paid ticks and chat.
export async function updateParty(party, { title, kind, party_date, place, budget, people, mode, special, phones = {}, emails = {} }) {
  const { error: e1 } = await supabase
    .from('parties')
    .update({
      title: title.trim(),
      kind,
      party_date: (party_date || '').trim() || null,
      place: (place || '').trim() || null,
      budget: Math.round(Number(budget) || 0),
      split_mode: mode,
      special_person: mode === 'equal' ? null : special,
    })
    .eq('id', party.id);
  if (e1) throw e1;

  const old = party.party_members || [];
  const byName = Object.fromEntries(old.map((m) => [m.name, m]));
  // People who said "Can't make it" don't pay; the budget splits among the rest
  const out = (n) => byName[n] && byName[n].rsvp === 'out' && n !== special;
  const coming = people.filter((n) => !out(n));
  const comingShares = sharesFor(budget, coming, mode, special);
  const shares = people.map((n) => (out(n) ? 0 : comingShares[coming.indexOf(n)]));

  // Removed people (never the host)
  const gone = old.filter((m) => m.name !== 'Me' && !people.includes(m.name)).map((m) => m.id);
  if (gone.length) {
    const { error } = await supabase.from('party_members').delete().in('id', gone);
    if (error) throw error;
  }
  // New people
  const fresh = people.map((name, i) => ({ name, i })).filter((p) => !byName[p.name]);
  if (fresh.length) {
    const { error } = await supabase.from('party_members').insert(
      fresh.map((p) => ({ party_id: party.id, name: p.name, share: shares[p.i], phone: phones[p.name] || null, email: emails[p.name] || null }))
    );
    if (error) throw error;
  }
  // New shares for people who stayed
  for (let i = 0; i < people.length; i++) {
    const m = byName[people[i]];
    if (m && Number(m.share) !== shares[i]) {
      const { error } = await supabase.from('party_members').update({ share: shares[i] }).eq('id', m.id);
      if (error) throw error;
    }
  }
}

// 🤝 Who paid for whom: "Shafil is paying for Arun" (coverId = null to undo)
export async function setCoveredBy(memberId, coverId) {
  const { error } = await supabase.from('party_members').update({ covered_by: coverId }).eq('id', memberId);
  if (error) throw error;
}

// 😎 Fun crew badges for Night Mode (host gives them; null = clear)
export const BADGES = [
  '👑 Main character', '⏰ Always late', '💃 Dance machine', '📸 Photographer', '🎤 DJ', '🍗 Snack hunter',
  '🧭 Navigator', '😂 Comedian', '🧊 Chill one', '🛡️ Caretaker', '💧 Hydration hero', '🚗 Driver hero',
  '🗣️ Hype person', '🕺 Last one standing', '💸 Big spender', '🌙 Night owl',
];
export async function setBadge(memberId, badge) {
  const { error } = await supabase.from('party_members').update({ badge: badge || null }).eq('id', memberId);
  if (error) throw error;
}
// Badge to show: the one given, else an automatic one from what happened tonight
export function badgeOf(m, members, party) {
  if (m.badge) return m.badge;
  if (m.is_driver) return '🚗 Driver hero';
  const home = (members || []).filter((x) => x.home_at).sort((a, b) => new Date(a.home_at) - new Date(b.home_at));
  if (home[0] && home[0].id === m.id) return '🏠 First home';
  if (m.name === 'Me' && party) return '🎟️ Host';
  return null;
}
