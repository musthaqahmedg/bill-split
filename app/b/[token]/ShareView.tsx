'use client';

import { useState } from 'react';

type Claim = { participant_id: string; paid_by: string | null };
type Item = { name: string; price: number; quantity: number; kind: string | null; about: string | null; claims: Claim[] };
type Person = { id: string; name: string; amount_due: number; not_drinking: boolean; paid: boolean };

export type SharedBill = {
  restaurant: string | null;
  bill_date: string | null;
  total: number;
  payee_name: string | null;
  payee_upi: string | null;
  people: Person[];
  items: Item[];
};

const EMOJI: Record<string, string> = { alcohol: '🍺', soft: '🥤', food: '🍽️' };
const inr = (n: number) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const money = (n: number) => 'Rs ' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');

// Opens GPay / PhonePe / Paytm with the amount filled in
const upiLink = (upi: string, name: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${Math.round(amount)}&cu=INR&tn=${encodeURIComponent(note)}`;

export default function ShareView({ bill }: { bill: SharedBill }) {
  const [me, setMe] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const nameOf = Object.fromEntries(bill.people.map((p) => [p.id, p.name]));
  const payee = bill.payee_name || 'your friend';

  const lines = (pid: string) =>
    bill.items
      .filter((it) => it.claims.some((c) => c.participant_id === pid))
      .map((it) => {
        const c = it.claims.find((x) => x.participant_id === pid)!;
        return {
          name: it.name,
          kind: it.kind,
          qty: it.quantity,
          share: Number(it.price) / it.claims.length,
          ways: it.claims.length,
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
  const owes = mine && Number(mine.amount_due) > 0 && mine.name !== 'Me';

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
              {mine.paid ? (
                <p style={s.youBig}>Paid ✅</p>
              ) : Number(mine.amount_due) === 0 && lines(mine.id).length > 0 ? (
                <p style={s.youBig}>You're covered 💛</p>
              ) : (
                <>
                  <p style={s.youLabel}>You owe {payee}</p>
                  <p style={s.youBig}>{inr(mine.amount_due)}</p>
                  <p style={s.youNote}>Includes your share of tax & service.</p>
                </>
              )}

              {owes && !mine.paid && bill.payee_upi && (
                <>
                  <a
                    href={upiLink(bill.payee_upi, payee, Number(mine.amount_due), `${bill.restaurant || 'Bill'} split`)}
                    style={s.payBtn}
                  >
                    Pay {inr(mine.amount_due)} with UPI
                  </a>
                  <button onClick={copyUpi} style={s.copyBtn}>
                    {copied ? 'Copied ✅' : `Copy UPI ID: ${bill.payee_upi}`}
                  </button>
                  <p style={s.youNote}>If the Pay button doesn't open your UPI app, copy the ID and pay in GPay / PhonePe / Paytm.</p>
                </>
              )}
            </div>
          )}
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
                  {p.name}{p.not_drinking ? ' 🥤' : ''}{isMe ? ' (you)' : ''}
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
                  {l.ways > 1 ? ` (shared ${l.ways} ways)` : ''} · {money(l.share)}
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
  footer: { color: '#8C7AAE', fontSize: 12, textAlign: 'center', marginTop: 24 },
};
