'use client';

import { useEffect, useRef, useState } from 'react';

type Message = { id: string; member_id: string | null; sender_name: string; body: string; kind: 'text' | 'system'; poll_id: string | null; created_at: string; is_pay?: boolean };
type Item = { id: string; name: string; done: boolean; claimed_by: string | null; claimed_name: string | null; asked_to?: string | null; asked_name?: string | null };
type Poll = { id: string; question: string; options: string[]; votes: Record<string, number>; voters: { option: number; name: string }[] };
type Member = { id: string; name: string; share: number | null; paid: boolean; rsvp: 'in' | 'out' | 'maybe' | null; bill_requested?: boolean };

export type SharedParty = {
  title: string;
  kind?: string;
  party_date: string | null;
  place: string | null;
  budget: number | null;
  hide_bill?: boolean;
  split_mode: 'equal' | 'treat' | 'free';
  special_person: string | null;
  host_name: string | null;
  host_upi: string | null;
  members: Member[];
};

// Each plan type gets its own emoji, colours and a little floating animation
const KINDS: Record<string, { emoji: string; label: string; from: string; to: string; extra: string[] }> = {
  party: { emoji: '🎉', label: 'Party', from: '#8B5CF6', to: '#F472B6', extra: ['✨', '🎊', '🥳'] },
  birthday: { emoji: '🎂', label: 'Birthday', from: '#F472B6', to: '#FBBF24', extra: ['🎈', '🎁', '🎊'] },
  house: { emoji: '🏠', label: 'House party', from: '#8B5CF6', to: '#34D399', extra: ['🎶', '🍕', '🎮'] },
  nightout: { emoji: '🍻', label: 'Night out', from: '#4C1D95', to: '#8B5CF6', extra: ['🌙', '✨', '🪩'] },
  movie: { emoji: '🎬', label: 'Movie', from: '#1E3A8A', to: '#8B5CF6', extra: ['🍿', '🎟️', '⭐'] },
  trip: { emoji: '🧳', label: 'Trip', from: '#0EA5E9', to: '#34D399', extra: ['🏔️', '🌴', '📸'] },
  daytrip: { emoji: '🚗', label: 'Day trip', from: '#F59E0B', to: '#34D399', extra: ['☀️', '🌿', '💦'] },
  wedding: { emoji: '💍', label: 'Wedding', from: '#F472B6', to: '#C9A8FF', extra: ['💐', '💃', '✨'] },
  bachelor: { emoji: '🥂', label: 'Bachelor', from: '#111827', to: '#8B5CF6', extra: ['😎', '🪩', '✨'] },
  match: { emoji: '⚽', label: 'Match night', from: '#065F46', to: '#34D399', extra: ['🏆', '📣', '🍿'] },
};

const ANIM = `
@keyframes vo-float { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-12px) rotate(4deg) } }
@keyframes vo-pop { 0% { transform: scale(.85); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes vo-drift { 0% { transform: translateY(20px); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(-120px); opacity: 0 } }
@keyframes vo-shine { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
`;

const inr = (n: number) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const upiLink = (upi: string, name: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${Math.round(amount)}&cu=INR&tn=${encodeURIComponent(note)}`;

const ANSWERS = [
  { key: 'in', label: "I'm in 🙌" },
  { key: 'maybe', label: 'Maybe 🤔' },
  { key: 'out', label: "Can't make it 😢" },
] as const;
const BADGE: Record<string, string> = { in: '🙌 In', out: '😢 Out', maybe: '🤔 Maybe' };

export default function PartyView({ party, token, supabaseUrl, supabaseKey }: {
  party: SharedParty; token: string; supabaseUrl: string; supabaseKey: string;
}) {
  const host = party.host_name || 'The host';
  const k = KINDS[party.kind || 'party'] || KINDS.party;
  const [members, setMembers] = useState(party.members);
  const [me, setMe] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [polls, setPolls] = useState<Record<string, Poll>>({});
  const [pollOpen, setPollOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({}); // member → who pays for them
  const [photos, setPhotos] = useState<{ id: string; path: string; uploader_name: string }[]>([]);
  const [booking, setBooking] = useState<{ place_name: string; booking_date: string; booking_time: string; guests: number; notes: string | null; status: string } | null>(null);
  const [safety, setSafety] = useState<{ id: string; name: string; home_at: string | null; is_driver: boolean }[]>([]);
  const [itemText, setItemText] = useState('');
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const bottom = useRef<HTMLDivElement>(null);

  const rpc = (fn: string, body: object) =>
    fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  // Load the chat, then check for new messages every 4 seconds
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [res, pr, li] = await Promise.all([
          rpc('get_party_chat_v2', { p_token: token }),
          rpc('get_party_polls', { p_token: token }),
          rpc('get_party_list', { p_token: token }),
        ]);
        const cv = await rpc('get_party_covers', { p_token: token });
        if (cv.ok && alive) {
          const rows: { member_id: string; covered_by: string }[] = await cv.json();
          setCovers(Object.fromEntries(rows.map((r) => [r.member_id, r.covered_by])));
        }
        const ph = await rpc('get_party_photos', { p_token: token });
        if (ph.ok && alive) setPhotos(await ph.json());
        const bk = await rpc('get_party_booking', { p_token: token });
        if (bk.ok && alive) setBooking((await bk.json())[0] || null);
        const sf = await rpc('get_party_safety', { p_token: token });
        if (sf.ok && alive) setSafety(await sf.json());
        if (li.ok && alive) setItems(await li.json());
        if (res.ok && alive) setMessages(await res.json());
        if (pr.ok && alive) {
          const list: Poll[] = await pr.json();
          setPolls(Object.fromEntries(list.map((x) => [x.id, x])));
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const refreshList = async () => {
    const li = await rpc('get_party_list', { p_token: token });
    if (li.ok) setItems(await li.json());
  };
  const addItem = async (name: string) => {
    if (!me || !name.trim()) return setSendError('Tap your name above first');
    setItemText('');
    await rpc('add_party_item', { p_token: token, p_member: me, p_name: name.trim() });
    refreshList();
  };
  const itemAction = async (id: string, action: 'claim' | 'done') => {
    if (!me) return setSendError('Tap your name above first');
    await rpc('update_party_item', { p_token: token, p_member: me, p_item: id, p_action: action });
    refreshList();
  };

  const askItem = async (id: string, target: string) => {
    if (!me) return setSendError('Tap your name above first');
    if (!target) return;
    await rpc('ask_party_item', { p_token: token, p_member: me, p_item: id, p_target: target });
    refreshList();
  };

  // 🤝 "I'll pay for Arun"
  const coverFriend = async (target: string) => {
    if (!me || !target) return;
    const res = await rpc('guest_cover', { p_token: token, p_member: me, p_target: target });
    if (res.ok) setCovers((c) => ({ ...c, [target]: me }));
  };
  const dueOf = (id: string) => {
    const m = members.find((x) => x.id === id);
    const own = covers[id] ? 0 : Number(m?.share || 0);
    return own + members.filter((x) => covers[x.id] === id).reduce((a, x) => a + Number(x.share || 0), 0);
  };

  // 💸 "I've paid" from the settle-up card
  const markPaid = async () => {
    if (!me) return setSendError('Tap your name above first');
    const res = await rpc('guest_mark_paid', { p_token: token, p_member: me });
    if (res.ok) setMembers((list) => list.map((m) => (m.id === me ? { ...m, paid: true } : m)));
  };

  const refreshSafety = async () => {
    const sf = await rpc('get_party_safety', { p_token: token });
    if (sf.ok) setSafety(await sf.json());
  };
  const imHome = async (home: boolean) => {
    if (!me) return setSendError('Tap your name above first');
    await rpc('party_home', { p_token: token, p_member: me, p_home: home });
    refreshSafety();
  };
  const imDriver = async (on: boolean) => {
    if (!me) return setSendError('Tap your name above first');
    await rpc('party_driver', { p_token: token, p_member: me, p_on: on });
    refreshSafety();
  };

  const refreshPolls = async () => {
    const pr = await rpc('get_party_polls', { p_token: token });
    if (pr.ok) {
      const list: Poll[] = await pr.json();
      setPolls(Object.fromEntries(list.map((x) => [x.id, x])));
    }
  };

  const vote = async (pollId: string, option: number) => {
    if (!me) return setSendError('Tap your name above to vote');
    await rpc('vote_party_poll', { p_token: token, p_member: me, p_poll: pollId, p_option: option });
    refreshPolls();
  };

  const postPoll = async () => {
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (!me || !pollQ.trim() || opts.length < 2) return setSendError('Add a question and at least 2 options');
    const res = await rpc('create_party_poll', { p_token: token, p_member: me, p_question: pollQ.trim(), p_options: opts });
    if (!res.ok) return setSendError("Couldn't post the poll");
    setPollOpen(false);
    setPollQ('');
    setPollOpts(['', '']);
    const again = await rpc('get_party_chat_v2', { p_token: token });
    if (again.ok) setMessages(await again.json());
    refreshPolls();
  };

  const requestBill = async () => {
    if (!mine) return;
    const res = await rpc('request_party_bill', { p_token: token, p_member: mine.id });
    if (res.ok) setMembers((list) => list.map((m) => (m.id === mine.id ? { ...m, bill_requested: true } : m)));
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setSendError('');
    setText('');
    try {
      const res = await rpc('send_party_message', { p_token: token, p_member: me, p_body: body });
      if (!res.ok) throw new Error();
      const again = await rpc('get_party_chat_v2', { p_token: token });
      if (again.ok) setMessages(await again.json());
    } catch {
      setText(body);
      setSendError("Couldn't send. Try again.");
    }
  };

  const show = (name: string) => (name === 'Me' ? host : name);
  const mine = members.find((m) => m.id === me) || null;
  const going = members.filter((m) => m.rsvp === 'in' || m.name === 'Me').length;

  const answer = async (key: 'in' | 'out' | 'maybe') => {
    if (!mine) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rsvp_party`, {
        method: 'POST',
        headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token, p_member: mine.id, p_answer: key }),
      });
      if (!res.ok) throw new Error('Could not save');
      setMembers((list) => list.map((m) => (m.id === mine.id ? { ...m, rsvp: key } : m)));
    } catch {
      setError("Couldn't save your answer. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const treat = party.split_mode === 'treat';
  const details = [party.party_date, party.place].filter(Boolean).join(' · ');

  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <style>{ANIM}</style>
        <div style={{ ...s.invite, background: `linear-gradient(120deg, ${k.from}, ${k.to}, ${k.from})`, backgroundSize: '200% 200%' }}>
          {k.extra.map((e, i) => (
            <span key={i} style={{ ...s.drift, left: `${18 + i * 30}%`, animationDelay: `${i * 1.3}s` }}>{e}</span>
          ))}
          <div style={s.bigEmoji}>{k.emoji}</div>
          <p style={s.inviteKicker}>YOU&apos;RE INVITED · {k.label.toUpperCase()}</p>
          <h1 style={s.inviteTitle}>{party.title}</h1>
          {details && <p style={s.inviteSub}>📍 {details}</p>}
          <p style={s.inviteSub}>Hosted by <b>{host}</b> · {going} going</p>
        </div>

        <div style={s.card}>
          <p style={s.label}>Who are you?</p>
          <div style={s.chips}>
            {members.filter((m) => m.name !== 'Me').map((m) => (
              <button key={m.id} onClick={() => setMe(m.id)} style={{ ...s.chip, ...(me === m.id ? s.chipOn : {}) }}>
                {m.name}
              </button>
            ))}
          </div>

          {mine && (
            <>
              <p style={{ ...s.label, marginTop: 18 }}>Are you coming, {mine.name}?</p>
              <div style={s.answers}>
                {ANSWERS.map((a) => (
                  <button key={a.key} disabled={saving} onClick={() => answer(a.key)}
                    style={{ ...s.answer, ...(mine.rsvp === a.key ? s.answerOn : {}) }}>
                    {a.label}
                  </button>
                ))}
              </div>
              {error && <p style={s.error}>{error}</p>}
              {mine.rsvp === 'in' && (
                <div style={s.share}>
                  {party.hide_bill ? (
                    <>
                      <p style={s.free}>🎁 {host} has hidden the bill. It&apos;s a treat!</p>
                      {mine.bill_requested ? (
                        <p style={s.note}>🧾 You asked to see the bill. {host} will see your request.</p>
                      ) : (
                        <button style={s.reqBtn} onClick={requestBill}>🧾 Request to see the bill</button>
                      )}
                    </>
                  ) : Number(mine.share) > 0 ? (
                    <>
                      <p style={s.shareLabel}>Your share</p>
                      <p style={s.shareAmount}>{inr(mine.share || 0)}</p>
                      {mine.paid ? (
                        <p style={s.paid}>✅ Paid. Thank you!</p>
                      ) : party.host_upi ? (
                        <a style={s.payBtn} href={upiLink(party.host_upi, host, mine.share || 0, party.title)}>Pay {host} with UPI</a>
                      ) : (
                        <p style={s.note}>Pay {host} when you meet 🙏</p>
                      )}
                    </>
                  ) : (
                    <p style={s.free}>{treat ? `🎁 It's ${host}'s treat. You pay nothing!` : '🎂 You go free. Enjoy!'}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {booking && (
          <>
            <p style={s.label}>🍽️ Table</p>
            <div style={{ ...s.listBox, borderColor: booking.status === 'confirmed' ? '#34D399' : undefined }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{booking.place_name}</div>
              <div style={s.itemWho}>{booking.booking_date} · {booking.booking_time} · {booking.guests} people</div>
              {booking.notes && <div style={s.itemWho}>📝 {booking.notes}</div>}
              <div style={{ ...s.itemWho, fontWeight: 700, color: booking.status === 'confirmed' ? '#34D399' : booking.status === 'declined' ? '#F87171' : '#FBBF24' }}>
                {booking.status === 'confirmed' ? '✅ Confirmed' : booking.status === 'declined' ? '❌ They said no' : '⏳ Waiting for the restaurant'}
              </div>
              {booking.status === 'confirmed' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <a style={{ ...s.claimBtn, textDecoration: 'none' }} href={`https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(booking.place_name)}`}>🚕 Book a cab</a>
                  <a style={{ ...s.claimBtn, textDecoration: 'none' }} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.place_name)}`}>🧭 Directions</a>
                </div>
              )}
            </div>
          </>
        )}

        <p style={s.label}>🛒 Who brings what</p>
        <div style={s.listBox}>
          {items.length === 0 && <p style={s.chatEmpty}>Nothing on the list yet</p>}
          {items.map((it) => {
            const mineItem = me && it.claimed_by === me;
            const askedMe = me && it.asked_to === me && !it.claimed_by;
            const status = it.done
              ? `✅ Got it${it.claimed_name ? ' · ' + (mineItem ? 'you' : it.claimed_name) : ''}`
              : it.claimed_by
              ? `🙋 ${mineItem ? "You're" : it.claimed_name + ' is'} bringing it`
              : it.asked_to
              ? `🔔 Asked ${askedMe ? 'you' : it.asked_name}, waiting…`
              : '❓ Needs someone';
            const color = it.done ? '#8C7AAE' : it.claimed_by ? '#34D399' : it.asked_to ? '#FBBF24' : '#F472B6';
            return (
              <div key={it.id} style={{ ...s.itemRow, flexDirection: 'column', alignItems: 'stretch', opacity: it.done ? 0.7 : 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, textDecoration: it.done ? 'line-through' : 'none' }}>{it.name}</div>
                <div style={{ ...s.itemWho, color, fontWeight: 700 }}>{status}</div>
                {askedMe && <div style={{ ...s.itemWho, color: '#FBBF24' }}>Someone asked you to bring this 🙏</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {!it.done && (
                    <button style={{ ...s.claimBtn, ...(mineItem ? s.claimOn : {}) }} onClick={() => itemAction(it.id, 'claim')}>
                      {mineItem ? '✋ Drop it' : askedMe ? '👍 Yes, I’ll bring it' : '🙋 I’ll bring it'}
                    </button>
                  )}
                  {!it.done && !it.claimed_by && (
                    <select style={{ ...s.claimBtn, cursor: 'pointer' }} value="" onChange={(e) => askItem(it.id, e.target.value)}>
                      <option value="">👉 Ask someone…</option>
                      {members.filter((m) => m.id !== me).map((m) => (
                        <option key={m.id} value={m.id}>{m.name === 'Me' ? 'The host' : m.name}</option>
                      ))}
                    </select>
                  )}
                  <button style={s.claimBtn} onClick={() => itemAction(it.id, 'done')}>{it.done ? 'Undo' : '✓ Got it'}</button>
                </div>
              </div>
            );
          })}
          {mine && (
            <form style={{ display: 'flex', gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); addItem(itemText); }}>
              <input style={s.chatInput} value={itemText} maxLength={80} onChange={(e) => setItemText(e.target.value)} placeholder="Add something to bring…" />
              <button style={s.smallBtn} type="submit">Add</button>
            </form>
          )}
        </div>

        <p style={s.label}>🌙 Night check-in</p>
        <div style={s.listBox}>
          <div style={{ fontWeight: 800 }}>🏠 {safety.filter((x) => x.home_at).length} of {safety.length} home safe</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
            {safety.map((x) => (
              <span key={x.id} style={{ fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 12, border: '1px solid #3A2A5C', background: x.home_at ? '#34D399' : 'transparent', color: x.home_at ? '#06281C' : '#B9A8D9' }}>
                {x.home_at ? '✓ ' : '⏳ '}{x.name === 'Me' ? host : x.name}{x.is_driver ? ' 🛡️' : ''}
              </span>
            ))}
          </div>
          {(() => {
            const mineS = safety.find((x) => x.id === me);
            return (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={{ ...s.claimBtn, ...(mineS?.home_at ? s.claimOn : {}) }} onClick={() => imHome(!mineS?.home_at)}>
                  {mineS?.home_at ? '✅ Home safe' : "🏠 I'm home safe"}
                </button>
                <button style={{ ...s.claimBtn, ...(mineS?.is_driver ? s.claimOn : {}) }} onClick={() => imDriver(!mineS?.is_driver)}>
                  {mineS?.is_driver ? "🛡️ I'm driving" : "🛡️ I'll drive tonight"}
                </button>
              </div>
            );
          })()}
          <div style={{ ...s.itemWho, marginTop: 8 }}>Get the Vibe Out app to build your 🔥 safe-night streak.</div>
        </div>

        {photos.length > 0 && (
          <>
            <p style={s.label}>📸 Photos · {photos.length}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 16 }}>
              {photos.map((ph) => {
                const url = `${supabaseUrl}/storage/v1/object/public/party-photos/${ph.path}`;
                return (
                  <a key={ph.id} href={url} target="_blank" rel="noreferrer" title={`📸 ${ph.uploader_name}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo by ${ph.uploader_name}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                  </a>
                );
              })}
            </div>
          </>
        )}

        <p style={s.label}>💬 Party chat</p>
        <div style={s.chat}>
          {messages.length === 0 && <p style={s.chatEmpty}>No messages yet. Say hi 👋</p>}
          {messages.map((m) => {
            if (m.is_pay) {
              const meM = members.find((x) => x.id === me);
              return (
                <div key={m.id} style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.45)', borderRadius: 16, padding: 14, margin: '8px 0' }}>
                  <div style={{ color: '#34D399', fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>💸 SETTLE UP · from {host}</div>
                  {!meM ? (
                    <div style={{ marginTop: 6 }}>Tap your name above to see your share.</div>
                  ) : party.hide_bill ? (
                    <div style={{ marginTop: 6 }}>🎁 This one is a treat. Nothing to pay!</div>
                  ) : meM.paid ? (
                    <div style={{ marginTop: 6, fontWeight: 800 }}>✅ You’ve paid. Thank you!</div>
                  ) : covers[meM.id] ? (
                    <div style={{ marginTop: 6, fontWeight: 700 }}>🤝 {members.find((x) => x.id === covers[meM.id])?.name || 'A friend'} is paying for you. Thank them 💜</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>₹{Math.round(dueOf(meM.id)).toLocaleString('en-IN')}</div>
                      {members.some((x) => covers[x.id] === meM.id) && (
                        <div style={{ color: '#C9A8FF', fontSize: 13 }}>incl. {members.filter((x) => covers[x.id] === meM.id).map((x) => x.name).join(', ')} 🤝</div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {party.host_upi ? (
                          <a style={{ ...s.payBtn, margin: 0 }} href={upiLink(party.host_upi, host, dueOf(meM.id), party.title)}>Pay with UPI</a>
                        ) : null}
                        <button style={s.claimBtn} onClick={markPaid}>✅ I’ve paid</button>
                        <select style={{ ...s.claimBtn, cursor: 'pointer' }} value="" onChange={(e) => coverFriend(e.target.value)}>
                          <option value="">🤝 Pay for a friend…</option>
                          {members.filter((x) => x.id !== meM.id && x.name !== 'Me' && !x.paid && !covers[x.id] && Number(x.share || 0) > 0).map((x) => (
                            <option key={x.id} value={x.id}>{x.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              );
            }
            if (m.kind === 'system') return <p key={m.id} style={s.system}>{m.body}</p>;
            if (m.poll_id) {
              const p = polls[m.poll_id];
              if (!p) return null;
              const total = Object.keys(p.votes || {}).length;
              const myVote = me ? (p.votes || {})[me] : undefined;
              return (
                <div key={m.id} style={s.poll}>
                  <div style={s.pollKicker}>📊 POLL · {m.sender_name}</div>
                  <div style={s.pollQ}>{p.question}</div>
                  {p.options.map((opt, i) => {
                    const n = Object.values(p.votes || {}).filter((v) => v === i).length;
                    const pct = total ? Math.round((n / total) * 100) : 0;
                    const names = (p.voters || []).filter((v) => v.option === i).map((v) => v.name).join(', ');
                    return (
                      <button key={i} onClick={() => vote(p.id, i)} style={{ ...s.pollOpt, ...(myVote === i ? s.pollOptOn : {}) }}>
                        <span style={{ ...s.pollFill, width: `${pct}%` }} />
                        <span style={s.pollRow}>
                          <span>{myVote === i ? '✓ ' : ''}{opt}</span>
                          <span style={{ color: '#B8A6D9' }}>{n ? `${n} · ${pct}%` : ''}</span>
                        </span>
                        {names && <span style={s.pollNames}>{names}</span>}
                      </button>
                    );
                  })}
                  <div style={s.pollTotal}>{total} {total === 1 ? 'vote' : 'votes'}</div>
                </div>
              );
            }
            const mine = me && m.member_id === me;
            return (
              <div key={m.id} style={{ ...s.bubble, ...(mine ? s.mine : s.theirs) }}>
                {!mine && <div style={s.sender}>{m.sender_name}</div>}
                <div>{m.body}</div>
                <div style={s.time}>{new Date(m.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        {mine ? (
          <form
            style={s.chatForm}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input style={s.chatInput} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={`Message as ${mine.name}…`} />
            <button style={s.pollBtn} type="button" onClick={() => setPollOpen(!pollOpen)}>📊</button>
            <button style={s.sendBtn} type="submit" disabled={!text.trim()}>➤</button>
          </form>
        ) : (
          <p style={s.chatHint}>Tap your name above to join the chat</p>
        )}
        {mine && pollOpen && (
          <div style={s.pollForm}>
            <input style={s.chatInput} value={pollQ} maxLength={200} onChange={(e) => setPollQ(e.target.value)} placeholder="Ask the group… e.g. Where should we go?" />
            {pollOpts.map((o, i) => (
              <input key={i} style={{ ...s.chatInput, marginTop: 6 }} value={o} maxLength={80}
                onChange={(e) => setPollOpts(pollOpts.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {pollOpts.length < 6 && <button style={s.smallBtn} onClick={() => setPollOpts([...pollOpts, ''])}>+ Option</button>}
              <button style={{ ...s.smallBtn, background: '#8B5CF6' }} onClick={postPoll}>Post poll</button>
            </div>
          </div>
        )}
        {sendError && <p style={s.error}>{sendError}</p>}

        <p style={{ ...s.label, marginTop: 22 }}>Guest list</p>
        {members.map((m) => (
          <div key={m.id} style={s.row}>
            <span>{show(m.name)}{m.name === 'Me' ? ' (host)' : ''}</span>
            <span style={{ color: m.rsvp === 'in' || m.name === 'Me' ? '#34D399' : m.rsvp === 'out' ? '#F87171' : '#8C7AAE' }}>
              {m.name === 'Me' ? '🙌 In' : m.rsvp ? BADGE[m.rsvp] : '⏳ Waiting'}
            </span>
          </div>
        ))}

        <p style={s.footer}>Made with Vibe Out 🌙 · <a href="/privacy" style={{ color: '#8C7AAE' }}>Privacy</a></p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#160A2B', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#fff' },
  wrap: { maxWidth: 520, margin: '0 auto', padding: '28px 18px 48px' },
  kicker: { color: '#C9A8FF', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, margin: 0 },
  title: { fontSize: 32, fontWeight: 800, margin: '8px 0 6px' },
  sub: { color: '#B8A6D9', fontSize: 15, margin: '0 0 4px' },
  card: { background: '#24103F', border: '1px solid #3E2470', borderRadius: 18, padding: 18, margin: '20px 0 22px' },
  label: { color: '#B8A6D9', fontSize: 14, fontWeight: 600, margin: '0 0 10px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { background: '#341A5C', color: '#fff', border: '1px solid #3E2470', borderRadius: 16, padding: '8px 14px', fontSize: 15, cursor: 'pointer' },
  chipOn: { background: '#8B5CF6', borderColor: '#8B5CF6' },
  answers: { display: 'flex', flexDirection: 'column', gap: 8 },
  answer: { background: 'transparent', color: '#fff', border: '1px solid #8B5CF6', borderRadius: 14, padding: '13px 14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'left' },
  answerOn: { background: '#8B5CF6' },
  error: { color: '#F87171', fontSize: 14 },
  share: { background: '#123A2C', borderRadius: 14, padding: 16, marginTop: 14, textAlign: 'center' },
  shareLabel: { color: '#B8A6D9', margin: 0, fontSize: 14 },
  shareAmount: { color: '#34D399', fontSize: 32, fontWeight: 800, margin: '4px 0 10px' },
  payBtn: { display: 'inline-block', background: '#34D399', color: '#0B2A1F', fontWeight: 800, borderRadius: 14, padding: '12px 20px', textDecoration: 'none' },
  paid: { color: '#34D399', fontWeight: 700, margin: 0 },
  note: { color: '#B8A6D9', margin: 0 },
  free: { color: '#F472B6', fontWeight: 700, margin: 0, fontSize: 16 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '12px 4px', borderBottom: '1px solid #3E2470', fontSize: 16 },
  chat: { background: '#1C0D33', border: '1px solid #3E2470', borderRadius: 16, padding: 12, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  chatEmpty: { color: '#8C7AAE', textAlign: 'center', margin: '20px 0' },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: '8px 12px', marginBottom: 8, fontSize: 15, lineHeight: 1.35, wordBreak: 'break-word' },
  mine: { alignSelf: 'flex-end', background: '#8B5CF6' },
  theirs: { alignSelf: 'flex-start', background: '#24103F', border: '1px solid #3E2470' },
  sender: { fontSize: 12, fontWeight: 800, color: '#F472B6', marginBottom: 2 },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'right', marginTop: 3 },
  system: { alignSelf: 'center', color: '#B8A6D9', background: '#341A5C', borderRadius: 12, padding: '4px 12px', fontSize: 13, margin: '6px 0' },
  chatForm: { display: 'flex', gap: 8, marginTop: 10 },
  chatInput: { flex: 1, background: '#24103F', color: '#fff', border: '1px solid #3E2470', borderRadius: 20, padding: '11px 14px', fontSize: 16, outline: 'none' },
  sendBtn: { width: 46, borderRadius: 23, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer' },
  chatHint: { color: '#8C7AAE', fontSize: 14, marginTop: 10, textAlign: 'center' },
  poll: { alignSelf: 'stretch', background: '#24103F', border: '1px solid #8B5CF6', borderRadius: 14, padding: 12, marginBottom: 8 },
  pollKicker: { color: '#C9A8FF', fontSize: 11, fontWeight: 800, letterSpacing: 1 },
  pollQ: { fontSize: 16, fontWeight: 800, margin: '4px 0 8px' },
  pollOpt: { position: 'relative', display: 'block', width: '100%', textAlign: 'left', background: 'transparent', color: '#fff', border: '1px solid #3E2470', borderRadius: 10, padding: '9px 12px', marginBottom: 6, fontSize: 15, cursor: 'pointer', overflow: 'hidden' },
  pollOptOn: { borderColor: '#C9A8FF' },
  pollFill: { position: 'absolute', left: 0, top: 0, bottom: 0, background: '#341A5C', zIndex: 0 },
  pollRow: { position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: 8 },
  pollNames: { position: 'relative', zIndex: 1, display: 'block', color: '#8C7AAE', fontSize: 11, marginTop: 2 },
  pollTotal: { color: '#8C7AAE', fontSize: 12 },
  pollBtn: { width: 46, borderRadius: 23, border: 'none', background: '#341A5C', fontSize: 18, cursor: 'pointer' },
  pollForm: { background: '#1C0D33', border: '1px solid #3E2470', borderRadius: 14, padding: 10, marginTop: 8 },
  smallBtn: { border: 'none', background: '#341A5C', color: '#fff', borderRadius: 12, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' },
  reqBtn: { background: 'transparent', color: '#C9A8FF', border: '1px solid #8B5CF6', borderRadius: 12, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', marginTop: 10 },
  invite: { position: 'relative', overflow: 'hidden', borderRadius: 24, padding: '28px 20px 24px', textAlign: 'center', animation: 'vo-pop .6s ease-out, vo-shine 8s linear infinite', boxShadow: '0 12px 40px rgba(139,92,246,.35)' },
  bigEmoji: { fontSize: 64, display: 'inline-block', animation: 'vo-float 3s ease-in-out infinite' },
  drift: { position: 'absolute', bottom: 0, fontSize: 22, animation: 'vo-drift 4s ease-in infinite', pointerEvents: 'none' },
  inviteKicker: { color: 'rgba(255,255,255,.85)', fontWeight: 800, fontSize: 12, letterSpacing: 2, margin: '8px 0 0' },
  inviteTitle: { fontSize: 30, fontWeight: 800, margin: '6px 0 8px', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.25)' },
  inviteSub: { color: 'rgba(255,255,255,.92)', fontSize: 15, margin: '2px 0' },
  listBox: { background: '#1C0D33', border: '1px solid #3E2470', borderRadius: 16, padding: 12, marginBottom: 22 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #3E2470' },
  check: { background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', padding: 0 },
  itemWho: { color: '#8C7AAE', fontSize: 12 },
  claimBtn: { background: 'transparent', color: '#C9A8FF', border: '1px solid #8B5CF6', borderRadius: 12, padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  claimOn: { background: '#8B5CF6', color: '#fff' },
  footer: { color: '#8C7AAE', fontSize: 12, textAlign: 'center', marginTop: 28 },
};
