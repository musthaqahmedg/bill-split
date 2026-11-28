'use client';

import { CSSProperties, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../../lib/supabaseBrowser';
import { BRAND } from '../../../lib/brand';

export type MemberBill = {
  restaurant: string | null;
  bill_date: string | null;
  payee_name: string | null;
  payee_upi: string | null;
  name: string;
  amount: number;
  paid: boolean;
  says_paid: boolean;
  lines: { name: string; shared_by: number; units: number; total_units: number; amount: number }[];
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n: number) => '₹' + r2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const upiLink = (upi: string, name: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${r2(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

export default function PayView({ bill, member }: { bill: MemberBill; member: string }) {
  const payee = bill.payee_name || 'your friend';
  const amount = r2(bill.amount);
  const [claimed, setClaimed] = useState(bill.says_paid);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');
  const link = bill.payee_upi && amount > 0 ? upiLink(bill.payee_upi, payee, amount, `${bill.restaurant || 'Bill'} split`.slice(0, 40)) : '';

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(''));
  }, [link]);

  // item lines add up to the total: the gap is tax & service (or a discount)
  const itemsSum = r2(bill.lines.reduce((s, l) => s + Number(l.amount), 0));
  const extra = r2(amount - itemsSum);
  const showLines = bill.lines.length > 0 && Math.abs(extra) <= Math.max(1, amount * 0.5);

  const claimPaid = async () => {
    const { error } = await supabase().rpc('member_claim_paid', { p_member: member });
    if (!error) setClaimed(true);
  };
  const copyUpi = async () => {
    try { await navigator.clipboard.writeText(bill.payee_upi || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <p style={s.kicker}>🌙 THE NIGHT, SORTED</p>
        <h1 style={s.title}>{bill.restaurant || 'Night out'}</h1>
        {bill.bill_date ? <p style={s.sub}>{String(bill.bill_date).slice(0, 10)}</p> : null}

        <section style={s.box}>
          <p style={s.hi}>Hi {bill.name}! 👋</p>
          {bill.paid ? (
            <p style={s.big}>Paid ✅</p>
          ) : claimed ? (
            <>
              <p style={s.big}>💸 Sent</p>
              <p style={s.note}>We told {payee} you paid. It shows as paid once they confirm they received it.</p>
            </>
          ) : amount <= 0 ? (
            <p style={s.big}>Nothing to pay ✅</p>
          ) : (
            <>
              <p style={s.label}>You owe {payee}</p>
              <p style={s.big}>{money(amount)}</p>
              {bill.payee_upi ? (
                <>
                  <a href={link} style={s.payBtn}>Pay {money(amount)} with UPI</a>
                  <button onClick={copyUpi} style={s.copyBtn}>{copied ? 'Copied ✅' : `Copy UPI ID: ${bill.payee_upi}`}</button>
                  {qr ? (
                    <div style={{ textAlign: 'center', marginTop: 12 }}>
                      <img src={qr} alt={`UPI QR to pay ${money(amount)}`} data-testid="pay-qr" style={s.qr} />
                      <p style={s.note}>Or scan this from another phone</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p style={s.note}>💸 Pay {payee} {money(amount)} by UPI (ask them for their UPI ID).</p>
              )}
              <button onClick={claimPaid} style={s.claimBtn}>✅ I&apos;ve paid</button>
            </>
          )}
        </section>

        {showLines ? (
          <section style={s.card}>
            <p style={s.cardTitle}>Your share</p>
            {bill.lines.map((l, i) => (
              <div key={i} style={s.row}>
                <span>{l.name}{l.total_units > l.shared_by ? ` (${l.units} of ${l.total_units})` : l.shared_by > 1 ? ` (shared by ${l.shared_by})` : ''}</span>
                <span>{money(l.amount)}</span>
              </div>
            ))}
            {Math.abs(extra) >= 0.01 ? (
              <div style={s.row}><span>{extra > 0 ? 'Tax & service' : 'Discount'}</span><span>{extra > 0 ? money(extra) : '−' + money(-extra)}</span></div>
            ) : null}
            <div style={{ ...s.row, ...s.total }}><span>Total</span><span>{money(amount)}</span></div>
          </section>
        ) : null}

        <p style={s.foot}>Something wrong? Reply to {payee} on WhatsApp.</p>
        <p style={s.foot}>Made with {BRAND.name} 🌙 · <a href="/privacy" style={{ color: '#6E6C7A' }}>Privacy</a></p>
      </div>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#0E0E12', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#F7F7F9' },
  wrap: { maxWidth: 520, margin: '0 auto', padding: '28px 18px 48px' },
  kicker: { color: '#E2FF3B', fontWeight: 800, fontSize: 12, letterSpacing: 2, margin: 0 },
  title: { fontSize: 30, fontWeight: 900, margin: '8px 0 4px' },
  sub: { color: '#9A98A6', fontSize: 14, margin: '0 0 20px' },
  box: { background: '#17161D', border: '1px solid #2A2833', borderRadius: 24, padding: 18, marginBottom: 18, textAlign: 'center' },
  hi: { fontWeight: 800, fontSize: 17, margin: '0 0 12px', textAlign: 'left' },
  label: { color: '#9A98A6', margin: 0, fontSize: 14 },
  big: { fontSize: 42, fontWeight: 900, margin: '4px 0 8px', color: '#E2FF3B' },
  note: { color: '#6E6C7A', fontSize: 12, margin: '8px 0 0' },
  payBtn: { display: 'block', background: '#E2FF3B', color: '#0E0E12', fontWeight: 900, fontSize: 17, padding: '14px 16px', borderRadius: 16, textDecoration: 'none', marginTop: 10 },
  copyBtn: { display: 'block', width: '100%', marginTop: 8, background: 'transparent', color: '#F7F7F9', border: '1px solid #2A2833', fontSize: 14, fontWeight: 700, padding: '11px 14px', borderRadius: 14, cursor: 'pointer' },
  claimBtn: { display: 'block', width: '100%', marginTop: 12, padding: '12px 14px', borderRadius: 16, border: '2px solid #E2FF3B', background: 'transparent', color: '#E2FF3B', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
  qr: { width: 180, height: 180, borderRadius: 12, background: '#fff', padding: 8 },
  card: { background: '#17161D', border: '1px solid #2A2833', borderRadius: 18, padding: 16, marginBottom: 14 },
  cardTitle: { fontWeight: 800, fontSize: 16, margin: '0 0 8px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, color: '#9A98A6', fontSize: 14, padding: '4px 0' },
  total: { color: '#F7F7F9', fontWeight: 900, borderTop: '1px solid #2A2833', marginTop: 6, paddingTop: 8 },
  foot: { color: '#6E6C7A', fontSize: 12, textAlign: 'center', marginTop: 14 },
};
