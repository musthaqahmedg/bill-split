'use client';

import { useEffect, useRef, useState } from 'react';

type Message = { id: string; member_id: string | null; sender_name: string; body: string; kind: 'text' | 'system'; poll_id: string | null; created_at: string };
type Poll = { id: string; question: string; options: string[]; votes: Record<string, number>; voters: { option: number; name: string }[] };
type Member = { id: string; name: string; share: number | null; paid: boolean; rsvp: 'in' | 'out' | 'maybe' | null; bill_requested?: boolean };

export type SharedParty = {
  title: string;
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
  const [members, setMembers] = useState(party.members);
  const [me, setMe] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [polls, setPolls] = useState<Record<string, Poll>>({});
  const [pollOpen, setPollOpen] = useState(false);
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
        const [res, pr] = await Promise.all([
          rpc('get_party_chat', { p_token: token }),
          rpc('get_party_polls', { p_token: token }),
        ]);
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
    const again = await rpc('get_party_chat', { p_token: token });
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
      const again = await rpc('get_party_chat', { p_token: token });
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
        <p style={s.kicker}>🌙 VIBE OUT · YOU&apos;RE INVITED</p>
        <h1 style={s.title}>{party.title}</h1>
        {details && <p style={s.sub}>📍 {details}</p>}
        <p style={s.sub}>Hosted by <b style={{ color: '#fff' }}>{host}</b> · {going} going</p>

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

        <p style={s.label}>💬 Party chat</p>
        <div style={s.chat}>
          {messages.length === 0 && <p style={s.chatEmpty}>No messages yet. Say hi 👋</p>}
          {messages.map((m) => {
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
  footer: { color: '#8C7AAE', fontSize: 12, textAlign: 'center', marginTop: 28 },
};
