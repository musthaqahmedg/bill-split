import { supabase } from './supabaseClient';

// 💸 Quick-add expenses (private to you)
export async function addExpense({ category, amount, note, partyId }) {
  const { error } = await supabase.from('expenses').insert({
    category, amount: Math.round(Number(amount) || 0), note: (note || '').trim().slice(0, 80) || null, party_id: partyId || null,
  });
  if (error) throw error;
}
export async function listExpenses() {
  const { data, error } = await supabase.from('expenses').select('id, category, amount, note, spent_at, party_id').order('spent_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}
export async function removeExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
