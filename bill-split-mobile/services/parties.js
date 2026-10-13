import { supabase } from './supabaseClient';

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
    .select('id, title, party_date, place, budget, split_mode, special_person, created_at, party_members(name, share, paid_at)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getParty(id) {
  const { data, error } = await supabase
    .from('parties')
    .select('*, party_members(id, name, share, paid_at)')
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
export async function createParty({ title, party_date, place, budget, people, mode = 'equal', special = null }) {
  const { data: party, error: e1 } = await supabase
    .from('parties')
    .insert({
      title: title.trim(),
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
    .insert(people.map((name, i) => ({ party_id: party.id, name, share: shares[i] })));
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