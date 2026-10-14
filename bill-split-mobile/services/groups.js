import { supabase } from './supabaseClient';

// Friend groups ("School gang", "Area friends"): make once, plan anything with them in one tap.

export async function listGroups() {
  const { data, error } = await supabase
    .from('friend_groups')
    .select('id, name, emoji, created_at, group_members(id, name, is_admin)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getGroup(id) {
  const { data, error } = await supabase
    .from('friend_groups')
    .select('*, group_members(id, name, phone, email, is_admin, created_at)')
    .eq('id', id)
    .single();
  if (error) throw error;
  data.group_members = (data.group_members || []).sort(
    (a, b) => (b.is_admin - a.is_admin) || a.name.localeCompare(b.name)
  );
  // Plans made with this group
  const { data: plans } = await supabase
    .from('parties')
    .select('id, title, kind, party_date, place, created_at')
    .eq('group_id', id)
    .order('created_at', { ascending: false });
  data.plans = plans || [];
  return data;
}

export async function createGroup(name, emoji = '👥') {
  const { data, error } = await supabase
    .from('friend_groups')
    .insert({ name: name.trim().slice(0, 60), emoji })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameGroup(id, name, emoji) {
  const { error } = await supabase.from('friend_groups').update({ name: name.trim().slice(0, 60), emoji }).eq('id', id);
  if (error) throw error;
}

export async function deleteGroup(id) {
  const { error } = await supabase.from('friend_groups').delete().eq('id', id);
  if (error) throw error;
}

// people: [{ name, phone?, email? }]
export async function addMembers(groupId, people) {
  if (!people.length) return;
  const { error } = await supabase.from('group_members').insert(
    people.map((p) => ({ group_id: groupId, name: p.name.trim().slice(0, 60), phone: p.phone || null, email: p.email || null }))
  );
  if (error) throw error;
}

export async function removeMember(memberId) {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function setAdmin(memberId, isAdmin) {
  const { error } = await supabase.from('group_members').update({ is_admin: isAdmin }).eq('id', memberId);
  if (error) throw error;
}
