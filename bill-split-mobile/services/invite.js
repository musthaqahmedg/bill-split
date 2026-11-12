import { supabase } from './supabaseClient';

// 🎁 Invite friends: your code + link; a friend who joins with it becomes your friend,
// and you get +100 XP once they make a plan or split a bill (stops fake-account farming).
export const INVITE_XP = 100;
export const inviteLink = (code) => `https://bill-split-flax.vercel.app/i/${code}`;

export async function myInvite() {
  const { data, error } = await supabase.rpc('my_invite');
  if (error) throw error;
  return data;
}

export async function redeemInvite(code) {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code });
  if (error) throw error;
  return data; // inviter's name
}
