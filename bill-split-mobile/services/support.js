import { supabase } from './supabaseClient';
import { track } from './track';

// 💬 Chat with us: each user has one thread; the team (admins) replies from the Support inbox

export const SUPPORT_EMAIL = 'maginfosystems@gmail.com';

async function me() {
  const { data } = await supabase.auth.getUser();
  return data && data.user ? data.user.id : null;
}

// threadUser: whose thread (the team opens other people's; normal users only their own)
export async function getThread(threadUser) {
  const uid = threadUser || (await me());
  const { data, error } = await supabase.from('support_messages').select('*').eq('user_id', uid).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function sendSupport(body, threadUser) {
  const uid = await me();
  const team = !!threadUser && threadUser !== uid;
  const { error } = await supabase.from('support_messages').insert({
    user_id: team ? threadUser : uid,
    from_team: team,
    body: body.trim().slice(0, 2000),
  });
  if (error) throw error;
  track('support', team ? 'replied' : 'sent');
}

export async function watchThread(threadUser, onNew) {
  const uid = threadUser || (await me());
  const ch = supabase
    .channel(`support-${uid}-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${uid}` }, (p) => onNew(p.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export async function supportThreads() {
  const { data, error } = await supabase.rpc('support_threads');
  if (error) throw error;
  return data || [];
}

// ❓ Quick answers on the Help page
export const FAQ = [
  { q: 'How does the split work?', a: 'Scan the bill, tap who had each item, and we do the maths. GST and service charge are shared by what each person had, so it always matches the bill to the rupee.' },
  { q: 'Do my friends need the app?', a: 'No. Share the link on WhatsApp. Friends see their share, say if they’re coming, and pay you by UPI, all without installing anything.' },
  { q: 'How do payments work?', a: 'Friends pay you straight to your UPI ID (add it in Profile). We never hold your money. Tap “Mark paid” or friends tap “I’ve paid”.' },
  { q: 'Someone isn’t drinking?', a: 'Mark them “Not drinking” on the People screen. Alcohol items skip them automatically, so they only pay for what they had.' },
  { q: 'Someone is treating the group?', a: 'On The split, tap a person → pick who’s covering them, or tap “I’ve got the whole bill”. Couples can use 💑 Pair.' },
  { q: 'The scan read something wrong?', a: 'On “Check the bill” you can fix names, quantities and prices, add missed items, or change the total.' },
  { q: 'How do I add friends?', a: 'Tap ＋ on “Your circle” on Home. Search by phone or email, or find friends from your contacts. You’ll need your birthday set first 🎂' },
  { q: 'Who can see my stuff?', a: 'Only people in your bill or plan. You can hide your “Active now” status in Profile. Read the privacy policy below for everything.' },
  { q: 'Getting home safe?', a: 'Open your plan → 🏠 tap “I’m home safe”, or pick a designated driver. Emergency numbers are always one tap away.' },
  { q: 'I own a restaurant or bar', a: 'We’d love to partner with you! Tap “Chat with us” and tell us your place’s name. We’ll add your menu, offers and bookings.' },
];
