'use client';

import { CSSProperties, useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabaseBrowser';

// 🎉 Big events admin: add / edit / remove the events that pop up in the app. Admins only (checked here AND by database rules).

type Ev = {
  id?: string; title: string; poster_url: string | null; start_at: string; end_at: string | null; venue_name: string;
  city: string | null; lat: number | null; lng: number | null; price_from: number | null; booking_url: string | null;
  status: 'draft' | 'published' | 'sold_out' | 'cancelled'; is_featured: boolean;
};
const blank: Ev = { title: '', poster_url: null, start_at: '', end_at: null, venue_name: '', city: 'Palakkad', lat: 10.7867, lng: 76.6548, price_from: null, booking_url: null, status: 'draft', is_featured: true };
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayOf = (v: string) => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}T/.test(v) && v.length <= 16) return v.slice(0, 10); const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const timeOf = (v: string) => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v.slice(11, 16); const d = new Date(v); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// quick picks: Today, Tomorrow, this Fri, this Sat
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const quickDays = (): [string, string][] => {
  const now = new Date();
  const add = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  const next = (dow: number) => add((dow - now.getDay() + 7) % 7);
  return [['Today', ymd(now)], ['Tomorrow', ymd(add(1))], [`Fri ${next(5).getDate()}`, ymd(next(5))], [`Sat ${next(6).getDate()}`, ymd(next(6))]];
};
const join = (day: string, time: string) => (day ? `${day}T${time}` : '');
const TIMES: [string, string][] = Array.from({ length: 20 }, (_, i) => { const h = (10 + Math.floor(i / 1)) % 24; return [`${pad(h)}:00`, `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`] as [string, string]; }).concat([['21:30', '9:30 PM'], ['22:30', '10:30 PM']]);
// 🏙️ city → map point (so nobody types latitude/longitude)
// 🎉 common event names (plus your past events) shown as suggestions
const NAME_IDEAS = ['DJ Night', 'Live Music Night', 'Bollywood Night', 'Retro Night', 'Karaoke Night', 'Comedy Night', 'Sufi Night', 'EDM Night', 'Halloween Night', 'Christmas Party', "New Year's Eve Party", 'Valentine\'s Night', 'Holi Party', 'Onam Celebration', 'Diwali Night', 'Football Screening', 'Cricket Screening', 'Open Mic', 'Rooftop Party', 'Pool Party'];
const CITIES: Record<string, [number, number]> = {
  Palakkad: [10.7867, 76.6548], Kochi: [9.9312, 76.2673], Thrissur: [10.5276, 76.2144], Kozhikode: [11.2588, 75.7804],
  Thiruvananthapuram: [8.5241, 76.9366], Coimbatore: [11.0168, 76.9558], Bengaluru: [12.9716, 77.5946], Chennai: [13.0827, 80.2707],
  Hyderabad: [17.385, 78.4867], Mumbai: [19.076, 72.8777], Delhi: [28.6139, 77.209], Goa: [15.2993, 74.124],
};
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
  const [venues, setVenues] = useState<{ id: string; name: string; area?: string; lat: number; lon: number }[]>([]);
  const vTimer = useRef<any>(null);
  // 📍 venue suggestions: real places near the chosen city (free OpenStreetMap search via our "places" function)
  const findVenues = (q: string, f: Ev) => {
    clearTimeout(vTimer.current);
    if (q.trim().length < 2) return setVenues([]);
    vTimer.current = setTimeout(async () => {
      try {
        const { data } = await sb.functions.invoke('places', { body: { lat: f.lat, lon: f.lng, q: q.trim(), category: 'all' } });
        setVenues(((data && data.places) || []).slice(0, 6));
      } catch (e) { setVenues([]); }
    }, 400);
  };

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
    if (!form.title.trim() || !form.venue_name.trim() || !dayOf(form.start_at)) return setMsg('Please add a title, venue and date');
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
          <L t="🎉 Event name">
            <input style={S.in} list="ev-names" value={f.title} onChange={(e) => setForm({ ...f, title: e.target.value })} placeholder="Start typing… e.g. DJ Night" />
            <datalist id="ev-names">
              {Array.from(new Set([...list.map((e) => e.title), ...NAME_IDEAS])).map((n) => <option key={n} value={n} />)}
            </datalist>
          </L>
          <L t="🖼️ Poster (tall image works best)">
            {f.poster_url ? <img src={f.poster_url} alt="" style={{ height: 160, borderRadius: 12, display: 'block', marginBottom: 8 }} /> : null}
            <input type="file" accept="image/*" onChange={(e) => e.target.files && e.target.files[0] && upload(e.target.files[0])} />
            <p style={S.muted}>Only use posters the organiser has given you permission to use.</p>
          </L>
          <div style={S.two}>
            <L t="📅 Date">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {quickDays().map(([label, d]) => (
                  <button key={label} type="button" style={dayOf(f.start_at) === d ? S.chipOn : S.chip} onClick={() => setForm({ ...f, start_at: join(d, timeOf(f.start_at) || '21:00') })}>{label}</button>
                ))}
              </div>
              <input
                style={{ ...S.in, colorScheme: 'dark', cursor: 'pointer' }}
                type="date"
                min={today()}
                value={dayOf(f.start_at)}
                onClick={(e) => { try { (e.currentTarget as any).showPicker(); } catch (er) {} }}
                onChange={(e) => setForm({ ...f, start_at: join(e.target.value, timeOf(f.start_at) || '21:00') })}
              />
            </L>
            <L t="🕘 Time">
              <select style={S.in} value={timeOf(f.start_at) || '21:00'} onChange={(e) => setForm({ ...f, start_at: join(dayOf(f.start_at) || today(), e.target.value) })}>
                {TIMES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </L>
          </div>
          <div style={S.two}>
            <L t="📍 Venue">
              <input style={S.in} value={f.venue_name} onChange={(e) => { setForm({ ...f, venue_name: e.target.value }); findVenues(e.target.value, f); }} placeholder="Start typing the place name…" autoComplete="off" />
              {venues.length ? (
                <div style={S.sugg}>
                  {venues.map((v) => (
                    <div key={v.id} style={S.suggRow} onClick={() => { setForm({ ...f, venue_name: v.name, lat: v.lat, lng: v.lon }); setVenues([]); }}>
                      📍 <b>{v.name}</b>{v.area ? <span style={{ opacity: 0.6 }}> · {v.area}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </L>
            <L t="🏙️ City">
              <select style={S.in} value={f.city || 'Palakkad'} onChange={(e) => { const c = CITIES[e.target.value]; setForm({ ...f, city: e.target.value, lat: c[0], lng: c[1] }); }}>
                {Object.keys(CITIES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </L>
          </div>
          <div style={S.two}>
            <L t="💸 Price from (₹, 0 = free)"><input style={S.in} inputMode="numeric" value={f.price_from ?? ''} onChange={(e) => setForm({ ...f, price_from: e.target.value === '' ? null : +e.target.value.replace(/\D/g, '') })} placeholder="999" /></L>
            <L t="🔗 Ticket link (optional)"><input style={S.in} value={f.booking_url || ''} onChange={(e) => setForm({ ...f, booking_url: e.target.value || null })} placeholder="https://…" /></L>
          </div>
          <label style={S.check}><input type="checkbox" checked={f.status === 'published' || f.status === 'sold_out'} onChange={(e) => setForm({ ...f, status: e.target.checked ? 'published' : 'draft' })} /> ✅ Show in the app now</label>
          <label style={S.check}><input type="checkbox" checked={f.status === 'sold_out'} onChange={(e) => setForm({ ...f, status: e.target.checked ? 'sold_out' : 'published' })} /> 🚫 Sold out</label>
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
  in: { colorScheme: 'dark', width: '100%', boxSizing: 'border-box', background: '#0E0E12', color: '#F7F7F9', border: '1px solid #2E2E39', borderRadius: 12, padding: '10px 12px', fontSize: 15, marginBottom: 8 },
  primary: { background: '#E2FF3B', color: '#0E0E12', border: 0, borderRadius: 14, padding: '12px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  link: { background: 'none', border: 0, color: '#E2FF3B', fontWeight: 700, cursor: 'pointer', marginLeft: 10, fontSize: 14 },
  muted: { color: '#76768A', fontSize: 13, margin: '4px 0' },
  err: { color: '#F87171', fontSize: 14 },
  sugg: { background: '#24242D', border: '1px solid #2E2E39', borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  suggRow: { padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #2E2E39', fontSize: 14 },
  chip: { background: '#24242D', color: '#F7F7F9', border: '1px solid #2E2E39', borderRadius: 12, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' },
  chipOn: { background: '#E2FF3B', color: '#0E0E12', border: '1px solid #E2FF3B', borderRadius: 12, padding: '8px 12px', fontWeight: 800, cursor: 'pointer' },
  check: { display: 'block', color: '#F7F7F9', fontSize: 16, margin: '6px 0 12px', cursor: 'pointer' },
  pill: { background: '#24242D', borderRadius: 8, padding: '2px 8px', fontSize: 12, marginLeft: 6 },
};
