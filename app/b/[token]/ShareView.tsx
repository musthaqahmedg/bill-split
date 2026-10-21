'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseBrowser';

type Claim = { participant_id: string; paid_by: string | null; units?: number };
type Item = { id: string; name: string; price: number; quantity: number; kind: string | null; about: string | null; claims: Claim[] };
type Person = { id: string; name: string; amount_due: number; paid_amount?: number; not_drinking: boolean; paid: boolean; tagged?: boolean };

export type SharedBill = {
  restaurant: string | null;
  authenticity?: { verdict: string; signs?: string[] } | null;
  bill_date: string | null;
  total: number;
  payee_name: string | null;
  payee_upi: string | null;
  paid_mode?: 'me' | 'friend' | 'unpaid' | 'multi';
  people: Person[];
  items: Item[];
};

// 💳 Who paid the bill → fewest payments so everyone pays exactly their share
function transfers(bill: SharedBill) {
  if (bill.paid_mode === 'unpaid') return [] as { from: string; to: string; amount: number }[];
  const paid: Record<string, number> = {};
  bill.people.forEach((p) => {
    const v = Number(p.paid_amount) || 0;
    if (v > 0) paid[p.id] = v;
  });
  if (!Object.keys(paid).length) {
    const me = bill.people.find((p) => p.name === 'Me'); // old bills: the person who shared it paid
    if (me) paid[me.id] = Math.round(Number(bill.total) || 0);
  }
  const bal = bill.people.map((p) => ({ id: p.id, v: Math.round((paid[p.id] || 0) - (Number(p.amount_due) || 0)) }));
  const cred = bal.filter((b) => b.v > 0).sort((a, b) => b.v - a.v);
  const debt = bal.filter((b) => b.v < 0).map((b) => ({ id: b.id, v: -b.v })).sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt > 0) out.push({ from: debt[i].id, to: cred[j].id, amount: amt });
    debt[i].v -= amt;
    cred[j].v -= amt;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}

const EMOJI: Record<string, string> = { alcohol: '🍺', soft: '🥤', food: '🍽️' };
const inr = (n: number) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const money = (n: number) => 'Rs ' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');

// Opens GPay / PhonePe / Paytm with the amount filled in
const upiLink = (upi: string, name: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${Math.round(amount)}&cu=INR&tn=${encodeURIComponent(note)}`;

export default function ShareView({ bill, token }: { bill: SharedBill; token: string }) {
  const [me, setMe] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // 🙋 Tag what I had
  const [tagging, setTagging] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const startTagging = () => {
    const pre: Record<string, number> = {};
    bill.items.forEach((it) => {
      const c = it.claims.find((x) => x.participant_id === me);
      if (c) pre[it.id] = c.units || 1;
    });
    setPicks(pre);
    setSent('');
    setTagging(true);
  };
  const togglePick = (id: string) => setPicks((p) => {
    const n = { ...p };
    if (n[id]) delete n[id];
    else n[id] = 1;
    return n;
  });
  const setCount = (id: string, v: number, max: number) => setPicks((p) => ({ ...p, [id]: Math.max(1, Math.min(Math.max(max, 1), v)) }));
  const sendPicks = async () => {
    setSending(true);
    const items = Object.entries(picks).map(([item_id, units]) => ({ item_id, units }));
    const { error } = await supabase().rpc('submit_self_claims', { p_token: token, p_participant: me, p_items: items });
    setSending(false);
    if (error) return setSent('❌ ' + error.message);
    setTagging(false);
    setSent(`✅ Sent to ${payee}! They'll update the split.`);
  };
  const nameOf = Object.fromEntries(bill.people.map((p) => [p.id, p.name]));
  const payee = bill.payee_name || 'your friend';

  const lines = (pid: string) =>
    bill.items
      .filter((it) => it.claims.some((c) => c.participant_id === pid))
      .map((it) => {
        const c = it.claims.find((x) => x.participant_id === pid)!;
        const total = it.claims.reduce((s, x) => s + (x.units || 1), 0) || 1;
        const units = c.units || 1;
        return {
          name: it.name,
          kind: it.kind,
          qty: it.quantity,
          share: (Number(it.price) * units) / total,
          ways: it.claims.length,
          had: total !== it.claims.length ? `had ${units} of ${total}` : null,
          coveredBy: c.paid_by && c.paid_by !== pid ? nameOf[c.paid_by] : null,
        };
      });

  const covering = (pid: string) => {
    const who = new Set<string>();
    bill.items.forEach((it) =>
      it.claims.forEach((c) => {
        if (c.paid_by === pid && c.participant_id !== pid) who.add(nameOf[c.participant_id]);
      })
    );
    return [...who];
  };

  const mine = bill.people.find((p) => p.id === me) || null;
  const moves = transfers(bill);
  const myMoves = mine ? moves.filter((m) => m.from === mine.id) : [];
  const getsBack = mine ? moves.filter((m) => m.to === mine.id).reduce((a, m) => a + m.amount, 0) : 0;
  const nameFor = (id: string) => (nameOf[id] === 'Me' ? payee : nameOf[id]);

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(bill.payee_upi || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <p style={s.kicker}>🌙 THE NIGHT, SORTED</p>
        <h1 style={s.title}>{bill.restaurant || 'Night out'}</h1>
        {bill.authenticity ? (
          bill.authenticity.verdict === 'looks_real' ? (
            <p style={{ color: '#34D399', fontSize: 13, fontWeight: 700, margin: '4px 0 0' }}>✅ Checked: looks like a genuine bill</p>
          ) : (
            <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FBBF24', borderRadius: 12, padding: '10px 12px', margin: '10px 0 0' }}>
              <div style={{ color: '#FBBF24', fontWeight: 800, fontSize: 14 }}>
                {bill.authenticity.verdict === 'likely_fake' ? '🚩 This bill may be edited or AI-made' : '⚠️ Some parts of this bill look unusual'}
              </div>
              {(bill.authenticity.signs || []).map((x) => (
                <div key={x} style={{ color: '#E9DDFF', fontSize: 13, marginTop: 4 }}>• {x}</div>
              ))}
            </div>
          )
        ) : null}
        <p style={s.sub}>
          {bill.bill_date ? `${bill.bill_date} · ` : ''}Total {money(bill.total)} · {bill.people.length} people
        </p>

        <section style={s.box}>
          <p style={s.boxTitle}>Which one are you?</p>
          <div style={s.chips}>
            {bill.people.filter((p) => p.name !== 'Me').map((p) => (
              <button
                key={p.id}
                onClick={() => setMe(p.id)}
                style={{ ...s.chip, ...(me === p.id ? s.chipOn : {}) }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {mine && (
            <div style={s.you}>
              {bill.paid_mode === 'unpaid' ? (
                <>
                  <p style={s.youLabel}>⏳ Not paid yet. Your share</p>
                  <p style={s.youBig}>{inr(mine.amount_due)}</p>
                  <p style={s.youNote}>Includes your share of tax & service.</p>
                </>
              ) : mine.paid ? (
                <p style={s.youBig}>Paid ✅</p>
              ) : getsBack > 0 ? (
                <>
                  <p style={s.youLabel}>💳 You paid the bill. You get back</p>
                  <p style={s.youBig}>{inr(getsBack)}</p>
                </>
              ) : myMoves.length === 0 ? (
                <p style={s.youBig}>{Number(mine.amount_due) === 0 && lines(mine.id).length > 0 ? "You're covered 💛" : 'All settled ✅'}</p>
              ) : (
                <>
                  {myMoves.map((m) => (
                    <div key={m.to}>
                      <p style={s.youLabel}>You owe {nameFor(m.to)}</p>
                      <p style={s.youBig}>{inr(m.amount)}</p>
                    </div>
                  ))}
                  <p style={s.youNote}>Includes your share of tax & service.</p>
                </>
              )}

              {!mine.paid && bill.paid_mode !== 'unpaid' && myMoves.map((m) =>
                nameOf[m.to] === 'Me' && bill.payee_upi ? (
                  <div key={'pay' + m.to}>
                    <a href={upiLink(bill.payee_upi, payee, m.amount, `${bill.restaurant || 'Bill'} split`)} style={s.payBtn}>
                      Pay {payee} {inr(m.amount)} with UPI
                    </a>
                    <button onClick={copyUpi} style={s.copyBtn}>
                      {copied ? 'Copied ✅' : `Copy UPI ID: ${bill.payee_upi}`}
                    </button>
                    <p style={s.youNote}>If the Pay button doesn't open your UPI app, copy the ID and pay in GPay / PhonePe / Paytm.</p>
                  </div>
                ) : (
                  <p key={'pay' + m.to} style={s.youNote}>💸 Pay {nameFor(m.to)} {inr(m.amount)} by UPI (ask them for their UPI ID).</p>
                )
              )}

              {!tagging ? (
                <button onClick={startTagging} style={s.tagBtn}>🙋 Not right? Tag what you had</button>
              ) : null}
              {sent ? <p style={{ ...s.youNote, color: sent.startsWith('✅') ? '#34D399' : '#F87171', fontSize: 14 }}>{sent}</p> : null}
            </div>
          )}

          {mine && tagging ? (
            <div style={s.tagBox}>
              <p style={s.boxTitle}>🙋 Tap everything you had</p>
              <p style={{ ...s.youNote, margin: '0 0 10px' }}>Shared something? Tick it too, and it gets split. {payee} checks it before anything changes.</p>
              {bill.items.map((it) => {
                const on = !!picks[it.id];
                return (
                  <div key={it.id} style={{ ...s.tagRow, ...(on ? s.tagRowOn : {}) }}>
                    <button onClick={() => togglePick(it.id)} style={s.tagName}>
                      <span style={{ ...s.box2, ...(on ? s.box2On : {}) }}>{on ? '✓' : ''}</span>
                      {it.kind ? EMOJI[it.kind] + ' ' : ''}{it.quantity > 1 ? `${it.quantity} × ` : ''}{it.name}
                      <span style={s.tagPrice}>{money(Number(it.price))}</span>
                    </button>
                    {on && it.quantity > 1 ? (
                      <div style={s.counter}>
                        <span style={{ color: '#B8A6D9', fontSize: 13 }}>How many did you have?</span>
                        <button style={s.step} onClick={() => setCount(it.id, picks[it.id] - 1, it.quantity)}>−</button>
                        <b style={{ minWidth: 22, textAlign: 'center' }}>{picks[it.id]}</b>
                        <button style={s.step} onClick={() => setCount(it.id, picks[it.id] + 1, it.quantity)}>＋</button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <button onClick={sendPicks} disabled={sending} style={{ ...s.payBtn, width: '100%', border: 'none', cursor: 'pointer' }}>
                {sending ? 'Sending…' : `Send to ${payee} (${Object.keys(picks).length} item${Object.keys(picks).length === 1 ? '' : 's'})`}
              </button>
              <button onClick={() => setTagging(false)} style={s.copyBtn}>Cancel</button>
            </div>
          ) : null}
        </section>

        <h2 style={s.h2}>Everyone's share</h2>
        {bill.people.map((p) => {
          const ls = lines(p.id);
          const cov = covering(p.id);
          const isMe = me === p.id;
          return (
            <div key={p.id} style={{ ...s.card, ...(isMe ? s.cardMe : {}) }}>
              <div style={s.cardTop}>
                <span style={s.name}>
                  {p.name === 'Me' ? bill.payee_name || 'Host' : p.name}{p.not_drinking ? ' 🥤' : ''}{isMe ? ' (you)' : ''}
                </span>
                <span style={s.amount}>
                  {p.paid ? '✅ ' : ''}
                  {Number(p.amount_due) === 0 && ls.length > 0 ? 'Covered 💛' : inr(p.amount_due)}
                </span>
              </div>
              {ls.length === 0 && <p style={s.line}>Didn't claim anything</p>}
              {ls.map((l, j) => (
                <p key={j} style={s.line}>
                  {l.kind ? EMOJI[l.kind] + ' ' : ''}
                  {l.qty > 1 ? `${l.qty} × ` : ''}{l.name}
                  {l.had ? ` (${l.had})` : l.ways > 1 ? ` (shared ${l.ways} ways)` : ''} · {money(l.share)}
                  {l.coveredBy ? <span style={s.pink}>{`  ${l.coveredBy} pays 💛`}</span> : null}
                </p>
              ))}
              {cov.length > 0 && <p style={s.covering}>💛 Covering {cov.join(', ')}</p>}
            </div>
          );
        })}

        <p style={s.footer}>Split fairly by what each person had · tax & service shared in proportion</p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#160A2B', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#fff' },
  wrap: { maxWidth: 520, margin: '0 auto', padding: '28px 18px 48px' },
  kicker: { color: '#C9A8FF', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, margin: 0 },
  title: { fontSize: 28, fontWeight: 800, margin: '8px 0 4px' },
  sub: { color: '#B8A6D9', fontSize: 14, margin: '0 0 20px' },
  box: { background: '#24103F', border: '1px solid #3E2470', borderRadius: 18, padding: 18, marginBottom: 24 },
  boxTitle: { fontWeight: 700, fontSize: 16, margin: '0 0 12px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { border: '1px solid #8B5CF6', color: '#C9A8FF', background: 'transparent', borderRadius: 20, padding: '8px 14px', fontSize: 15, cursor: 'pointer' },
  chipOn: { background: '#8B5CF6', color: '#fff' },
  you: { marginTop: 18, borderTop: '1px solid #3E2470', paddingTop: 16, textAlign: 'center' },
  youLabel: { color: '#B8A6D9', margin: 0, fontSize: 14 },
  youBig: { fontSize: 38, fontWeight: 800, margin: '4px 0', color: '#C9A8FF' },
  youNote: { color: '#8C7AAE', fontSize: 12, margin: '8px 0 0' },
  payBtn: { display: 'block', marginTop: 16, background: '#34D399', color: '#0B2A1F', fontWeight: 800, fontSize: 17, padding: '14px 16px', borderRadius: 14, textDecoration: 'none' },
  copyBtn: { display: 'block', width: '100%', marginTop: 10, background: 'transparent', color: '#C9A8FF', border: '1px solid #3E2470', fontSize: 14, padding: '11px 14px', borderRadius: 14, cursor: 'pointer' },
  h2: { fontSize: 18, fontWeight: 700, margin: '0 0 12px' },
  card: { background: '#24103F', borderRadius: 16, padding: 16, marginBottom: 10, border: '1px solid #3E2470' },
  cardMe: { border: '2px solid #8B5CF6' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontWeight: 700, fontSize: 17 },
  amount: { fontWeight: 800, fontSize: 18, color: '#C9A8FF' },
  line: { color: '#B8A6D9', fontSize: 14, margin: '3px 0' },
  pink: { color: '#F472B6', fontWeight: 600 },
  covering: { color: '#F472B6', fontWeight: 600, fontSize: 14, margin: '8px 0 0' },
  tagBtn: { display: 'block', width: '100%', marginTop: 14, background: 'transparent', color: '#F4EEFF', border: '1px dashed #8B5CF6', fontSize: 15, fontWeight: 700, padding: '12px 14px', borderRadius: 14, cursor: 'pointer' },
  tagBox: { marginTop: 16, borderTop: '1px solid #3E2470', paddingTop: 16 },
  tagRow: { border: '1px solid #3E2470', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  tagRowOn: { borderColor: '#8B5CF6', background: 'rgba(139,92,246,0.12)' },
  tagName: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 15, padding: '12px', textAlign: 'left', cursor: 'pointer' },
  tagPrice: { marginLeft: 'auto', color: '#B8A6D9', fontSize: 14 },
  box2: { width: 22, height: 22, borderRadius: 6, border: '2px solid #8B5CF6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 },
  box2On: { background: '#8B5CF6' },
  counter: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px 12px 44px' },
  step: { width: 32, height: 32, borderRadius: 16, border: '1px solid #8B5CF6', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' },
  footer: { color: '#8C7AAE', fontSize: 12, textAlign: 'center', marginTop: 24 },
};
