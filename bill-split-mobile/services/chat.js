import { supabase } from './supabaseClient';

// Party chat room. The host uses the app; friends chat from the invite link (website).

export async function listMessages(partyId) {
  const { data, error } = await supabase
    .from('party_messages')
    .select('id, member_id, sender_name, body, kind, poll_id, created_at')
    .eq('party_id', partyId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw error;
  return data || [];
}

// The host's own message (shown to friends with the host's real name)
export async function sendMessage({ partyId, memberId, senderName, body }) {
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
