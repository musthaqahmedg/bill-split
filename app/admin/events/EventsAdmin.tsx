'use client';

import { CSSProperties, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseBrowser';

// 🎉 Big events admin: add / edit / remove the events that pop up in the app. Admins only (checked here AND by database rules).

type Ev = {
  id?: string; title: string; poster_url: string | null; start_at: string; end_at: string | null; venue_name: string;
  city: string | null; lat: number | null; lng: number | null; price_from: number | null; booking_url: string | null;
  status: 'draft' | 'published' | 'sold_out' | 'cancelled'; is_featured: boolean;
};
const blank: Ev = { title: '', poster_url: null, start_at: '', end_at: null, venue_name: '', city: 'Palakkad', lat: null, lng: null, price_from: null, booking_url: null, status: 'draft', is_featured: true };
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function EventsAdmin() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [list, setList] = useState<Ev[]>([]);
  const [form, setForm] = useState<Ev | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setUser(data.session ? data.session.user : null); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s ? s.user : null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) return setAdmin(null);
    sb.rpc('is_admin').then(({ data }) => setAdmin(!!data));
  }, [user && user.id]);
  const load = async () => {
    const { data } = await sb.from('events').select('*').order('start_at', { ascending: false });
    setList((data as Ev[]) || []);
  };
  useEffect(() => { if (admin) load(); }, [admin]);

  const upload = async (file: File) => {
    if (!form) return;
    if (file.size > 5 * 1024 * 1024) return setMsg('Poster must be under 5 MB');
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('event-posters').upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) return setMsg(error.message);
    setForm({ ...form, poster_url: sb.storage.from('event-posters').getPublicUrl(path).data.publicUrl });
  };

  const save = async () => {
    if (!form) return;
    setMsg('');
    if (!form.title.trim() || !form.venue_name.trim() || !form.start_at) return setMsg('Title, venue and start time are needed');
    if (form.booking_url && !/^https:\/\//i.test(form.booking_url)) return setMsg('Booking link must start with https://');
    setBusy(true);
    const row = { ...form, start_at: new Date(form.start_at).toISOString(), end_at: form.end_at ? new Date(form.end_at).toISOString() : null, updated_at: new Date().toISOString() };
    const { error } = form.id ? await sb.from('events').update(row).eq('id', form.id) : await sb.from('events').insert(row);
    setBusy(false);
    if (error) return setMsg(error.message);
    setForm(null);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await sb.from('events').delete().eq('id', id);
    load();
  };
  const here = () => navigator.geolocation?.getCurrentPosition((p) => form && setForm({ ...form, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }));

  if (!ready) return <Page><p style={S.muted}>Loading…</p></Page>;
  if (!user) return <Page><Login /></Page>;
  if (admin === null) return <Page><p style={S.muted}>Checking access…</p></Page>;
  if (!admin) return <Page><p style={S.muted}>This page is for the Vibe Out team only.</p><button style={S.link} onClick={() => sb.auth.signOut()}>Log out</button></Page>;

  const f = form;
  return (
    <Page>
      <div style={S.top}>
        <h1 style={S.h1}>🎉 Big events</h1>
        <div>
          {!f ? <button style={S.primary} onClick={() => setForm({ ...blank })}>+ New event</button> : null}
          <button style={S.link} onClick={() => sb.auth.signOut()}>Log out</button>
        </div>
      </div>
      {f ? (
        <div style={S.card}>
          <h2 style={S.h2}>{f.id ? 'Edit event' : 'New event'}</h2>
          <L t="Title"><input style={S.in} value={f.title} onChange={(e) => setForm({ ...f, title: e.target.value })} placeholder="Halloween Night" /></L>
          <L t="Poster (portrait works best)">
            {f.poster_url ? <img src={f.poster_url} alt="" style={{ height: 160, borderRadius: 12, display: 'block', marginBottom: 8 }} /> : null}
            <input type="file" accept="image/*" onChange={(e) => e.target.files && e.target.files[0] && upload(e.target.files[0])} />
            <p style={S.muted}>Only use posters the organiser has given you permission to use.</p>
          </L>
          <div style={S.two}>
            <L t="Starts"><input style={S.in} type="datetime-local" value={local(f.start_at) || f.start_at} onChange={(e) => setForm({ ...f, start_at: e.target.value })} /></L>
            <L t="Ends (optional)"><input style={S.in} type="datetime-local" value={local(f.end_at) || ''} onChange={(e) => setForm({ ...f, end_at: e.target.value || null })} /></L>
          </div>
          <div style={S.two}>
            <L t="Venue"><input style={S.in} value={f.venue_name} onChange={(e) => setForm({ ...f, venue_name: e.target.value })} /></L>
            <L t="City"><input style={S.in} value={f.city || ''} onChange={(e) => setForm({ ...f, city: e.target.value || null })} /></L>
          </div>
          <div style={S.two}>
            <L t="Latitude"><input style={S.in} value={f.lat ?? ''} onChange={(e) => setForm({ ...f, lat: e.target.value ? +e.target.value : null })} /></L>
            <L t="Longitude"><input style={S.in} value={f.lng ?? ''} onChange={(e) => setForm({ ...f, lng: e.target.value ? +e.target.value : null })} /></L>
          </div>
          <button style={S.link} onClick={here}>📍 Use my current location</button>
          <div style={S.two}>
            <L t="Price from (₹, 0 = free)"><input style={S.in} inputMode="numeric" value={f.price_from ?? ''} onChange={(e) => setForm({ ...f, price_from: e.target.value === '' ? null : +e.target.value.replace(/\D/g, '') })} /></L>
            <L t="Booking link (https://…)"><input style={S.in} value={f.booking_url || ''} onChange={(e) => setForm({ ...f, booking_url: e.target.value || null })} /></L>
          </div>
          <div style={S.two}>
            <L t="Status">
              <select style={S.in} value={f.status} onChange={(e) => setForm({ ...f, status: e.target.value as Ev['status'] })}>
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published</option>
                <option value="sold_out">Sold out</option>
                <option value="cancelled">Cancelled (hidden)</option>
              </select>
            </L>
            <L t="Pop-up"><label style={{ color: '#ddd' }}><input type="checkbox" checked={f.is_featured} onChange={(e) => setForm({ ...f, is_featured: e.target.checked })} /> Show as a big event</label></L>
          </div>
          {msg ? <p style={S.err}>{msg}</p> : null}
          <button style={S.primary} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button>
          <button style={S.link} onClick={() => { setForm(null); setMsg(''); }}>Cancel</button>
        </div>
      ) : null}
      {list.map((e) => (
        <div key={e.id} style={{ ...S.card, display: 'flex', gap: 14, alignItems: 'center' }}>
          {e.poster_url ? <img src={e.poster_url} alt="" style={{ width: 54, height: 72, objectFit: 'cover', borderRadius: 8 }} /> : <div style={{ fontSize: 34 }}>🎉</div>}
          <div style={{ flex: 1 }}>
            <b>{e.title}</b> <span style={S.pill}>{e.status}</span>
            <div style={S.muted}>{new Date(e.start_at).toLocaleString('en-IN')} · {e.venue_name}{e.city ? `, ${e.city}` : ''}{e.price_from != null ? ` · from ₹${e.price_from}` : ''}</div>
          </div>
          <button style={S.link} onClick={() => setForm(e)}>Edit</button>
          <button style={{ ...S.link, color: '#F87171' }} onClick={() => e.id && remove(e.id)}>Delete</button>
        </div>
      ))}
      {!list.length && !f ? <p style={S.muted}>No events yet. Add the first one 👆</p> : null}
    </Page>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <div style={{ flex: 1, marginBottom: 12 }}><div style={S.label}>{t}</div>{children}</div>;
}
function Page({ children }: { children: React.ReactNode }) {
  return <main style={S.page}><div style={{ maxWidth: 760, margin: '0 auto' }}>{children}</div></main>;
}
function Login() {
  const sb = supabase();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setErr('');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
    if (error) return setErr(error.message);
    setSent(true);
  };
  const verify = async () => {
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (error) setErr('That code didn’t work.');
  };
  return (
    <div style={{ ...S.card, maxWidth: 400, margin: '60px auto' }}>
      <h1 style={S.h1}>Team login</h1>
      {!sent ? (
        <>
          <input style={S.in} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          <button style={S.primary} onClick={send}>Send code</button>
        </>
      ) : (
        <>
          <input style={S.in} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="Code from your email" />
          <button style={S.primary} onClick={verify}>Log in</button>
        </>
      )}
      {err ? <p style={S.err}>{err}</p> : null}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#0E0E12', color: '#F7F7F9', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  h1: { fontSize: 28, margin: '0 0 12px' },
  h2: { fontSize: 20, margin: '0 0 12px' },
  card: { background: '#1A1A21', border: '1px solid #2E2E39', borderRadius: 18, padding: 18, marginBottom: 12 },
  two: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  label: { color: '#ABABBC', fontSize: 13, marginBottom: 6 },
  in: { width: '100%', boxSizing: 'border-box', background: '#0E0E12', color: '#F7F7F9', border: '1px solid #2E2E39', borderRadius: 12, padding: '10px 12px', fontSize: 15, marginBottom: 8 },
  primary: { background: '#E2FF3B', color: '#0E0E12', border: 0, borderRadius: 14, padding: '12px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  link: { background: 'none', border: 0, color: '#E2FF3B', fontWeight: 700, cursor: 'pointer', marginLeft: 10, fontSize: 14 },
  muted: { color: '#76768A', fontSize: 13, margin: '4px 0' },
  err: { color: '#F87171', fontSize: 14 },
  pill: { background: '#24242D', borderRadius: 8, padding: '2px 8px', fontSize: 12, marginLeft: 6 },
};
