import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { track } from './track';

// Party chat room. The host uses the app; friends chat from the invite link (website).

export async function listMessages(partyId) {
  const { data, error } = await supabase
    .from('party_messages')
    .select('id, member_id, sender_name, body, kind, poll_id, created_at, is_pay, ref')
    .eq('party_id', partyId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw error;
  return data || [];
}

// The host's own message (shown to friends with the host's real name)
export async function sendMessage({ partyId, memberId, senderName, body }) {
  track('partyChat', 'sent a message');
  const text = body.trim();
  if (!text) return null;
  const { data, error } = await supabase
    .from('party_messages')
    .insert({ party_id: partyId, member_id: memberId || null, sender_name: senderName || 'Host', body: text.slice(0, 1000) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// New messages arrive live; returns a function that stops listening
export function onNewMessage(partyId, callback) {
  const channel = supabase
    .channel(`party-chat-${partyId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `party_id=eq.${partyId}` },
      (payload) => callback(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---- Polls (everyone votes; the same functions are used by the invite page) ----
export async function getPolls(token) {
  const { data, error } = await supabase.rpc('get_party_polls', { p_token: token });
  if (error) throw error;
  return data || [];
}

export async function createPoll({ token, memberId, question, options }) {
  const { error } = await supabase.rpc('create_party_poll', {
    p_token: token, p_member: memberId, p_question: question, p_options: options,
  });
  if (error) throw error;
}

export async function votePoll({ token, memberId, pollId, option }) {
  const { error } = await supabase.rpc('vote_party_poll', {
    p_token: token, p_member: memberId, p_poll: pollId, p_option: option,
  });
  if (error) throw error;
}

// 💸 Drop a "settle up" card in the chat (host only)
export async function postPayRequest(partyId) {
  track('partyChat', 'asked to settle up');
  const { error } = await supabase.rpc('post_pay_request', { p_party: partyId });
  if (error) throw error;
}

// 😂 Emoji reactions on chat messages
export const REACTIONS = ['😂', '🔥', '❤️', '👀', '🙌', '😮'];
export async function getReactions(token) {
  const { data, error } = await supabase.rpc('get_reactions', { p_token: token });
  if (error) throw error;
  return data || [];
}
export async function react({ token, memberId, messageId, emoji }) {
  const { data, error } = await supabase.rpc('react_message', { p_token: token, p_member: memberId, p_message: messageId, p_emoji: emoji });
  if (error) throw error;
  return data; // true = added, false = removed
}

// 👥 Squad inbox: the latest message in each Space (only Spaces you can see)
// 💬 Unread chat per Space (on this phone): messages from others since you last opened that chat
const SEEN = 'chat_seen_v1';
async function seenMap() {
  try { return JSON.parse((await AsyncStorage.getItem(SEEN)) || '{}'); } catch (e) { return {}; }
}
export async function markChatSeen(partyId) {
  const m = await seenMap();
  m[partyId] = new Date().toISOString();
  try { await AsyncStorage.setItem(SEEN, JSON.stringify(m)); } catch (e) {}
}
// spaces: [{ id, party_members: [{ id, name }] }] → { [partyId]: count }
export async function unreadPerSpace(spaces) {
  if (!spaces.length) return {};
  const seen = await seenMap();
  let changed = false;
  const now = new Date().toISOString();
  spaces.forEach((p) => { if (!seen[p.id]) { seen[p.id] = now; changed = true; } }); // first time: start counting from now
  if (changed) { try { await AsyncStorage.setItem(SEEN, JSON.stringify(seen)); } catch (e) {} }
  const oldest = spaces.map((p) => seen[p.id]).sort()[0];
  const { data, error } = await supabase
    .from('party_messages')
    .select('party_id, member_id, kind, created_at')
    .in('party_id', spaces.map((p) => p.id).slice(0, 50))
    .gt('created_at', oldest)
    .limit(500);
  if (error) return {};
  const mine = new Set(spaces.flatMap((p) => (p.party_members || []).filter((m) => m.name === 'Me').map((m) => m.id)));
  const out = {};
  (data || []).forEach((m) => {
    if (m.created_at <= seen[m.party_id] || mine.has(m.member_id)) return;
    out[m.party_id] = (out[m.party_id] || 0) + 1;
  });
  return out;
}

export async function latestPerSpace(partyIds) {
  if (!partyIds.length) return {};
  const { data, error } = await supabase
    .from('party_messages')
    .select('party_id, sender_name, body, kind, created_at')
    .in('party_id', partyIds.slice(0, 50))
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  const out = {};
  (data || []).forEach((m) => {
    if (!out[m.party_id]) out[m.party_id] = m;
  });
  return out;
}
