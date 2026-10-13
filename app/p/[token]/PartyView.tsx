'use client';

import { useState } from 'react';

type Member = { id: string; name: string; share: number; paid: boolean; rsvp: 'in' | 'out' | 'maybe' | null };

export type SharedParty = {
  title: string;
  party_date: string | null;
  place: string | null;
  budget: number;
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
                  {Number(mine.share) > 0 ? (
                    <>
                      <p style={s.shareLabel}>Your share</p>
                      <p style={s.shareAmount}>{inr(mine.share)}</p>
                      {mine.paid ? (
                        <p style={s.paid}>✅ Paid. Thank you!</p>
                      ) : party.host_upi ? (
                        <a style={s.payBtn} href={upiLink(party.host_upi, host, mine.share, party.title)}>Pay {host} with UPI</a>
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

        <p style={s.label}>Guest list</p>
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
  footer: { color: '#8C7AAE', fontSize: 12, textAlign: 'center', marginTop: 28 },
};
