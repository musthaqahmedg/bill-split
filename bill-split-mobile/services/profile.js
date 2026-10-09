import { supabase } from './supabaseClient';

// Your own profile: name, phone, UPI ID
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone, upi_id')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data || { id: user.id, phone: user.phone, name: '', upi_id: '' };
}

export async function saveProfile({ name, upi_id }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, phone: user.phone, name: name.trim(), upi_id: upi_id.trim() || null });
  if (error) throw error;
}

// A UPI ID looks like name@bank, e.g. musthaq@okaxis
export const isValidUpi = (v) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test((v || '').trim());

// Deletes your account and all your bills (required by the App Store)
export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  await supabase.auth.signOut();
}