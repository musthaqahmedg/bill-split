'use client';

import { CSSProperties, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseBrowser';

// 🗑️ Delete your account from the web (Google Play requires this as well as the in-app button)
export default function DeleteAccount() {
  const sb = supabase();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session ? data.session.user : null));
  }, []);

  const send = async () => {
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter the email you use in the app');
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) return setErr(/not found|signups/i.test(error.message) ? 'No account found with this email.' : error.message);
    setSent(true);
  };

  const verify = async () => {
    setErr('');
    setBusy(true);
    const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setErr('That code didn’t work. Check it, or send a new one.');
    setUser(data.user);
  };

  const remove = async () => {
    setErr('');
    setBusy(true);
    const { data, error } = await sb.functions.invoke('delete-account');
    setBusy(false);
    if (error || (data && data.error)) return setErr((data && data.error) || (error && error.message) || 'Something went wrong');
    await sb.auth.signOut();
    setDone(true);
  };

  return (
    <main style={S.page}>
      <div style={S.card}>
        <p style={S.kicker}>🌙 VIBE OUT</p>
        <h1 style={S.h1}>Delete your account</h1>

        {done ? (
          <>
            <p style={S.p}>✅ Your account and all your data have been deleted. Thanks for trying Vibe Out 💜</p>
          </>
        ) : !user ? (
          <>
            <p style={S.p}>Log in with the email you use in the app. We’ll send you a code.</p>
            {!sent ? (
              <>
                <input style={S.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={(e) => e.key === 'Enter' && send()} />
                <button style={S.primary} onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
              </>
            ) : (
              <>
                <input style={{ ...S.input, letterSpacing: 6, textAlign: 'center', fontSize: 22 }} value={code} maxLength={8}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" onKeyDown={(e) => e.key === 'Enter' && verify()} />
                <button style={S.primary} onClick={verify} disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Continue'}</button>
              </>
            )}
          </>
        ) : (
          <>
            <p style={S.p}>Logged in as <b>{user.email || 'your account'}</b>.</p>
            <div style={S.warn}>
              <b>This deletes, for good:</b>
              <ul style={S.ul}>
                <li>Your profile, photo and login</li>
                <li>Bills and plans you created, with their chats and photos</li>
                <li>Friends, notifications, saved places, bookings and messages</li>
                <li>Any restaurant page you own on Vibe Out</li>
              </ul>
              Bills and plans that <b>friends</b> created stay with them, but your account is unlinked from them.
            </div>
            <p style={S.p}>Type <b>DELETE</b> to confirm:</p>
            <input style={S.input} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <button style={{ ...S.primary, ...S.danger }} onClick={remove} disabled={busy || confirm.trim().toUpperCase() !== 'DELETE'}>
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
          </>
        )}

        {err ? <p style={S.err}>{err}</p> : null}
        <p style={S.small}>
          You can also delete your account in the app: Profile → Delete my account. Logged in with a phone number, or need help? Email{' '}
          <a href="mailto:maginfosystems@gmail.com" style={S.link}>maginfosystems@gmail.com</a>. We reply within 7 days.
        </p>
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#160A2B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 440, background: '#211238', border: '1px solid #3A2560', borderRadius: 20, padding: 24, color: '#F4EEFF' },
  kicker: { color: '#C4B5FD', fontSize: 12, fontWeight: 700, letterSpacing: 1.2 },
  h1: { fontSize: 26, fontWeight: 800, margin: '6px 0 12px' },
  p: { color: '#D8CCF3', fontSize: 15, lineHeight: 1.5, margin: '10px 0' },
  input: { width: '100%', background: '#160A2B', border: '1px solid #3A2560', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 16, outline: 'none' },
  primary: { width: '100%', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 15, fontWeight: 800, marginTop: 12, cursor: 'pointer' },
  danger: { background: '#DC2626' },
  warn: { background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.5)', borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 1.5, color: '#FDE2E2' },
  ul: { margin: '6px 0 6px 18px' },
  err: { color: '#F87171', fontSize: 14, marginTop: 10 },
  small: { color: '#9A8BB8', fontSize: 12, lineHeight: 1.5, marginTop: 18 },
  link: { color: '#C4B5FD', textDecoration: 'underline' },
};
