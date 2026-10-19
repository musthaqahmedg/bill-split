'use client';

import QRCode from 'qrcode';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseBrowser';

// 🍽️ Partner dashboard: restaurants log in, add their menu and tables, print QR codes

type Venue = {
  id: string; name: string; area: string | null; address: string | null; phone: string | null; upi_id: string | null;
  tax_percent: number; service_percent: number; is_open: boolean; verified: boolean;
};
type Item = {
  id: string; venue_id: string; category: string; name: string; description: string | null; price: number;
  kind: 'food' | 'soft' | 'alcohol'; veg: boolean | null; available: boolean; sort: number;
};
type Table = { id: string; label: string; seats: number | null; token: string };

const KIND: Record<string, string> = { food: '🍽️ Food', soft: '🥤 Soft drink', alcohol: '🍺 Alcohol' };
const rupee = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function Partner() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [tab, setTab] = useState<'menu' | 'tables' | 'settings'>('menu');

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session ? data.session.user : null);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s ? s.user : null));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadVenues = async () => {
    if (!user) return;
    const { data: staff } = await sb.from('venue_staff').select('venue_id').eq('user_id', user.id);
    const ids = (staff || []).map((s: any) => s.venue_id);
    if (!ids.length) return setVenues([]);
    const { data } = await sb.from('venues').select('*').in('id', ids).order('created_at');
    setVenues((data as Venue[]) || []);
    setVenueId((cur) => cur && ids.includes(cur) ? cur : ids[0]);
  };
  useEffect(() => {
    if (user) loadVenues();
    else setVenues(null);
  }, [user && user.id]);

  const venue = venues && venues.find((v) => v.id === venueId);

  if (!ready) return <Shell><p style={S.muted}>Loading…</p></Shell>;
  if (!user) return <Shell><Login /></Shell>;
  if (venues === null) return <Shell><p style={S.muted}>Loading…</p></Shell>;
  if (!venues.length) return <Shell onLogout={() => sb.auth.signOut()}><CreateVenue onDone={loadVenues} /></Shell>;

  return (
    <Shell onLogout={() => sb.auth.signOut()} email={user.email}>
      <div style={S.head}>
        <div>
          {venues.length > 1 ? (
            <select style={S.venueSelect} value={venueId || ''} onChange={(e) => setVenueId(e.target.value)}>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <h1 style={S.h1}>{venue!.name}</h1>
          )}
          <div style={S.badges}>
            {venue!.verified ? <span style={{ ...S.badge, ...S.badgeOk }}>✅ Partner</span> : <span style={S.badge}>⏳ Waiting for verification</span>}
            {venue!.area ? <span style={S.muted}>📍 {venue!.area}</span> : null}
          </div>
        </div>
        <OpenSwitch venue={venue!} onChange={loadVenues} />
      </div>

      <div style={S.tabs}>
        {(['menu', 'tables', 'settings'] as const).map((t) => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }} onClick={() => setTab(t)}>
            {t === 'menu' ? '📋 Menu' : t === 'tables' ? '🪑 Tables & QR' : '⚙️ Settings'}
          </button>
        ))}
        <span style={{ ...S.tab, opacity: 0.45, cursor: 'default' }}>🛎️ Orders · soon</span>
      </div>

      {tab === 'menu' ? <Menu venue={venue!} /> : tab === 'tables' ? <Tables venue={venue!} /> : <Settings venue={venue!} onSaved={loadVenues} />}
    </Shell>
  );
}

// ───────────────── Layout
function Shell({ children, onLogout, email }: { children: React.ReactNode; onLogout?: () => void; email?: string }) {
  return (
    <div style={S.page}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      <div style={S.topbar} className="no-print">
        <div style={S.brand}><span style={S.logo}>🌙</span> Vibe Out <span style={S.brandSub}>for Restaurants</span></div>
        {onLogout ? (
          <div style={S.row}>
            {email ? <span style={{ ...S.muted, marginRight: 12 }}>{email}</span> : null}
            <button style={S.linkBtn} onClick={onLogout}>Log out</button>
          </div>
        ) : null}
      </div>
      <div style={S.wrap}>{children}</div>
    </div>
  );
}

// ───────────────── Login with an email code (same account works in the app)
function Login() {
  const sb = supabase();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter a valid email');
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  };
  const verify = async () => {
    setErr('');
    setBusy(true);
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr('That code didn’t work. Check it, or send a new one.');
  };

  return (
    <div style={S.hero}>
      <h1 style={S.heroTitle}>Your restaurant, on Vibe Out 🍽️</h1>
      <p style={S.heroSub}>Digital menu · QR ordering from the table · live orders · bills that split themselves</p>
      <div style={{ ...S.card, maxWidth: 400, margin: '28px auto 0', textAlign: 'left' }}>
        {!sent ? (
          <>
            <label style={S.label}>Your email</label>
            <input style={S.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@restaurant.com" onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button style={S.primary} onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send login code'}</button>
          </>
        ) : (
          <>
            <label style={S.label}>Code sent to {email}</label>
            <input style={{ ...S.input, letterSpacing: 6, fontSize: 22, textAlign: 'center' }} value={code} maxLength={8}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" onKeyDown={(e) => e.key === 'Enter' && verify()} />
            <button style={S.primary} onClick={verify} disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Log in'}</button>
            <button style={S.linkBtn} onClick={() => { setSent(false); setCode(''); }}>Use a different email</button>
          </>
        )}
        {err ? <p style={S.err}>{err}</p> : null}
      </div>
    </div>
  );
}

// ───────────────── First time: add your restaurant
function CreateVenue({ onDone }: { onDone: () => void }) {
  const sb = supabase();
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const create = async () => {
    if (name.trim().length < 2) return setErr('Enter your restaurant’s name');
    setBusy(true);
    const { error } = await sb.rpc('create_venue', { p_name: name, p_area: area, p_phone: phone });
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  };
  return (
    <div style={{ ...S.card, maxWidth: 460, margin: '20px auto' }}>
      <h2 style={S.h2}>Add your restaurant</h2>
      <p style={S.muted}>Takes a minute. Our team will verify it and give you the ✅ Partner badge.</p>
      <label style={S.label}>Restaurant / bar name</label>
      <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rio Kitchen & Bar" />
      <label style={S.label}>Area / city</label>
      <input style={S.input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Palakkad" />
      <label style={S.label}>Phone</label>
      <input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="For bookings and our team" />
      <button style={S.primary} onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      {err ? <p style={S.err}>{err}</p> : null}
    </div>
  );
}

function OpenSwitch({ venue, onChange }: { venue: Venue; onChange: () => void }) {
  const sb = supabase();
  const toggle = async () => {
    await sb.from('venues').update({ is_open: !venue.is_open }).eq('id', venue.id);
    onChange();
  };
  return (
    <button style={{ ...S.pill, ...(venue.is_open ? S.pillOn : {}) }} onClick={toggle} className="no-print">
      {venue.is_open ? '🟢 Taking orders' : '⚪ Not taking orders'}
    </button>
  );
}

// ───────────────── 📋 Menu
function Menu({ venue }: { venue: Venue }) {
  const sb = supabase();
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [importing, setImporting] = useState('');

  const load = async () => {
    const { data } = await sb.from('menu_items').select('*').eq('venue_id', venue.id).order('category').order('sort').order('name');
    setItems((data as Item[]) || []);
  };
  useEffect(() => {
    setItems(null);
    load();
  }, [venue.id]);

  const cats = useMemo(() => Array.from(new Set((items || []).map((i) => i.category))), [items]);
  const shown = (items || []).filter((i) => !q || (i.name + ' ' + i.category).toLowerCase().includes(q.toLowerCase()));
  const grouped = cats.map((c) => ({ c, list: shown.filter((i) => i.category === c) })).filter((g) => g.list.length);

  const toggle = async (i: Item) => {
    setItems((l) => (l || []).map((x) => (x.id === i.id ? { ...x, available: !x.available } : x)));
    await sb.from('menu_items').update({ available: !i.available }).eq('id', i.id);
  };
  const remove = async (i: Item) => {
    if (!confirm(`Delete "${i.name}"?`)) return;
    await sb.from('menu_items').delete().eq('id', i.id);
    load();
  };

  // 📸 Snap the printed menu → AI reads every item and price
  const importPhoto = async (file: File) => {
    setImporting('Reading your menu… (about 10 seconds)');
    try {
      const base64 = await shrinkImage(file);
      const { data, error } = await sb.functions.invoke('extract-menu', { body: { image: base64 } });
      if (error || !data || data.error) throw new Error((data && data.error) || (error && error.message) || 'Could not read the menu');
      const have = new Set((items || []).map((i) => i.name.toLowerCase()));
      const rows = (data.items as any[])
        .filter((i) => !have.has(String(i.name).toLowerCase()) && i.price != null)
        .map((i, k) => ({ venue_id: venue.id, name: i.name, price: i.price, kind: i.kind, category: i.category || 'Menu', sort: k }));
      if (rows.length) {
        const { error: e2 } = await sb.from('menu_items').insert(rows);
        if (e2) throw e2;
      }
      setImporting(`✅ Added ${rows.length} item${rows.length === 1 ? '' : 's'}. Check the prices below.`);
      load();
    } catch (e: any) {
      setImporting('❌ ' + e.message);
    }
  };

  return (
    <div>
      <div style={S.toolbar}>
        <input style={{ ...S.input, margin: 0, flex: 1, minWidth: 160 }} placeholder="🔎 Search your menu" value={q} onChange={(e) => setQ(e.target.value)} />
        <label style={S.secondary}>
          📸 Import from menu photo
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files && e.target.files[0] && importPhoto(e.target.files[0])} />
        </label>
        <button style={S.primarySmall} onClick={() => setEditing({ category: cats[0] || 'Starters', kind: 'food', veg: null, price: undefined })}>＋ Add item</button>
      </div>
      {importing ? <p style={{ ...S.note, marginBottom: 12 }}>{importing}</p> : null}

      {items === null ? <p style={S.muted}>Loading…</p> : null}
      {items && !items.length ? (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <p style={{ fontSize: 34 }}>📋</p>
          <h3 style={S.h3}>Your menu is empty</h3>
          <p style={S.muted}>Add items one by one, or snap a photo of your printed menu and we’ll fill it in for you.</p>
        </div>
      ) : null}

      {grouped.map((g) => (
        <div key={g.c} style={{ marginBottom: 18 }}>
          <div style={S.catTitle}>{g.c} <span style={S.muted}>· {g.list.length}</span></div>
          <div style={S.card0}>
            {g.list.map((i, k) => (
              <div key={i.id} style={{ ...S.itemRow, ...(k ? S.line : {}), opacity: i.available ? 1 : 0.5 }}>
                <span style={{ width: 22 }}>{i.veg === true ? '🟢' : i.veg === false ? '🔴' : ''}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.itemName}>{i.name} {i.kind !== 'food' ? <span style={S.tag}>{KIND[i.kind]}</span> : null}</div>
                  {i.description ? <div style={S.mutedSmall}>{i.description}</div> : null}
                </div>
                <div style={S.price}>{rupee(i.price)}</div>
                <button style={{ ...S.chip, ...(i.available ? S.chipOn : {}) }} onClick={() => toggle(i)} title="Turn off when sold out">
                  {i.available ? 'Available' : 'Sold out'}
                </button>
                <button style={S.iconBtn} onClick={() => setEditing(i)} title="Edit">✏️</button>
                <button style={S.iconBtn} onClick={() => remove(i)} title="Delete">🗑️</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing ? <ItemForm venue={venue} item={editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
    </div>
  );
}

function ItemForm({ venue, item, cats, onClose, onSaved }: { venue: Venue; item: Partial<Item>; cats: string[]; onClose: () => void; onSaved: () => void }) {
  const sb = supabase();
  const [f, setF] = useState<Partial<Item>>(item);
  const [err, setErr] = useState('');
  const set = (k: keyof Item, v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name || !f.name.trim()) return setErr('Enter a name');
    if (f.price == null || isNaN(Number(f.price))) return setErr('Enter a price');
    const row = {
      venue_id: venue.id, name: f.name.trim(), price: Number(f.price), category: (f.category || 'Menu').trim(),
      kind: f.kind || 'food', veg: f.veg ?? null, description: f.description ? f.description.trim() : null,
    };
    const { error } = f.id ? await sb.from('menu_items').update(row).eq('id', f.id) : await sb.from('menu_items').insert(row);
    if (error) return setErr(error.message);
    onSaved();
  };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={S.h3}>{f.id ? 'Edit item' : 'Add item'}</h3>
        <label style={S.label}>Name</label>
        <input style={S.input} value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Chilli Chicken" autoFocus />
        <div style={S.row2}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Price (₹)</label>
            <input style={S.input} inputMode="decimal" value={f.price ?? ''} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="280" />
          </div>
          <div style={{ flex: 1.4 }}>
            <label style={S.label}>Category</label>
            <input style={S.input} list="cats" value={f.category || ''} onChange={(e) => set('category', e.target.value)} placeholder="Starters" />
            <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <label style={S.label}>Type</label>
        <div style={S.segment}>
          {(['food', 'soft', 'alcohol'] as const).map((k) => (
            <button key={k} style={{ ...S.seg, ...(f.kind === k ? S.segOn : {}) }} onClick={() => set('kind', k)}>{KIND[k]}</button>
          ))}
        </div>
        <label style={S.label}>Veg?</label>
        <div style={S.segment}>
          {[[true, '🟢 Veg'], [false, '🔴 Non-veg'], [null, '— Not food']].map(([v, l]) => (
            <button key={String(v)} style={{ ...S.seg, ...(f.veg === v ? S.segOn : {}) }} onClick={() => set('veg', v)}>{l as string}</button>
          ))}
        </div>
        <label style={S.label}>Description (optional)</label>
        <input style={S.input} value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Short and tasty" />
        {err ? <p style={S.err}>{err}</p> : null}
        <div style={{ ...S.row, justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button style={S.linkBtn} onClick={onClose}>Cancel</button>
          <button style={S.primarySmall} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────── 🪑 Tables + printable QR codes
function Tables({ venue }: { venue: Venue }) {
  const sb = supabase();
  const [tables, setTables] = useState<Table[] | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [count, setCount] = useState('5');

  const load = async () => {
    const { data } = await sb.from('venue_tables').select('id,label,seats,token').eq('venue_id', venue.id).order('created_at');
    const list = (data as Table[]) || [];
    setTables(list);
    const origin = window.location.origin;
    const out: Record<string, string> = {};
    for (const t of list) out[t.id] = await QRCode.toDataURL(`${origin}/t/${t.token}`, { margin: 1, width: 360, color: { dark: '#1f1235' } });
    setQr(out);
  };
  useEffect(() => {
    setTables(null);
    load();
  }, [venue.id]);

  const add = async () => {
    const n = Math.max(1, Math.min(50, parseInt(count) || 1));
    const start = (tables || []).length;
    const rows = Array.from({ length: n }, (_, i) => ({ venue_id: venue.id, label: `T${start + i + 1}` }));
    await sb.from('venue_tables').insert(rows);
    load();
  };
  const rename = async (t: Table) => {
    const label = prompt('Table name', t.label);
    if (!label || !label.trim()) return;
    await sb.from('venue_tables').update({ label: label.trim().slice(0, 20) }).eq('id', t.id);
    load();
  };
  const remove = async (t: Table) => {
    if (!confirm(`Delete table ${t.label}? Its QR code will stop working.`)) return;
    await sb.from('venue_tables').delete().eq('id', t.id);
    load();
  };

  return (
    <div>
      <div style={S.toolbar} className="no-print">
        <span style={S.muted}>Add</span>
        <input style={{ ...S.input, margin: 0, width: 70 }} value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} />
        <button style={S.primarySmall} onClick={add}>＋ Add tables</button>
        <div style={{ flex: 1 }} />
        {tables && tables.length ? <button style={S.secondary} onClick={() => window.print()}>🖨️ Print QR codes</button> : null}
      </div>
      <p style={{ ...S.note, marginBottom: 16 }} className="no-print">
        Stick a QR on each table. Guests scan it with their phone camera → see your menu → order straight to you. No app needed.
      </p>
      {tables === null ? <p style={S.muted}>Loading…</p> : null}
      <div style={S.qrGrid}>
        {(tables || []).map((t) => (
          <div key={t.id} style={S.qrCard}>
            <div style={S.qrVenue}>{venue.name}</div>
            {qr[t.id] ? <img src={qr[t.id]} alt={`QR for ${t.label}`} style={{ width: '100%', maxWidth: 200 }} /> : <div style={{ height: 200 }} />}
            <div style={S.qrLabel}>Table {t.label}</div>
            <div style={S.qrHint}>📱 Scan to see the menu & order</div>
            <div style={{ ...S.row, justifyContent: 'center', gap: 6, marginTop: 8 }} className="no-print">
              <button style={S.iconBtn} onClick={() => rename(t)} title="Rename">✏️</button>
              <a style={S.iconBtn} href={`/t/${t.token}`} target="_blank" rel="noreferrer" title="Open as a guest">👀</a>
              <button style={S.iconBtn} onClick={() => remove(t)} title="Delete">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────── ⚙️ Settings
function Settings({ venue, onSaved }: { venue: Venue; onSaved: () => void }) {
  const sb = supabase();
  const [f, setF] = useState<Venue>(venue);
  const [msg, setMsg] = useState('');
  useEffect(() => setF(venue), [venue.id]);
  const set = (k: keyof Venue, v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setMsg('');
    const { error } = await sb.from('venues').update({
      name: f.name.trim(), area: f.area, address: f.address, phone: f.phone, upi_id: f.upi_id ? f.upi_id.trim() : null,
      tax_percent: Number(f.tax_percent) || 0, service_percent: Number(f.service_percent) || 0,
    }).eq('id', venue.id);
    setMsg(error ? '❌ ' + error.message : '✅ Saved');
    if (!error) onSaved();
  };
  const field = (k: keyof Venue, label: string, ph = '') => (
    <>
      <label style={S.label}>{label}</label>
      <input style={S.input} value={(f[k] as any) ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
    </>
  );
  return (
    <div style={{ ...S.card, maxWidth: 560 }}>
      {field('name', 'Restaurant name')}
      {field('area', 'Area / city', 'Palakkad')}
      {field('address', 'Address')}
      {field('phone', 'Phone')}
      {field('upi_id', 'UPI ID (guests can pay you directly)', 'restaurant@okaxis')}
      <div style={S.row2}>
        <div style={{ flex: 1 }}>{field('tax_percent', 'GST / tax %')}</div>
        <div style={{ flex: 1 }}>{field('service_percent', 'Service charge %')}</div>
      </div>
      <button style={S.primary} onClick={save}>Save</button>
      {msg ? <p style={{ ...S.muted, marginTop: 10 }}>{msg}</p> : null}
    </div>
  );
}

// Shrink a photo in the browser before sending it to the AI (fast + cheap)
function shrinkImage(file: File, max = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.75).split(',')[1]);
    };
    img.onerror = () => reject(new Error('Could not open that photo'));
    img.src = URL.createObjectURL(file);
  });
}

// ───────────────── Styles (clean, Apple-like, light)
const P = '#7C3AED';
const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#F6F5FA', color: '#1C1530' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #ECEAF3', position: 'sticky', top: 0, zIndex: 5 },
  brand: { fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 },
  brandSub: { fontWeight: 500, color: '#8A83A3' },
  logo: { background: P, color: '#fff', borderRadius: 8, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 },
  wrap: { maxWidth: 980, margin: '0 auto', padding: '24px 18px 60px' },
  row: { display: 'flex', alignItems: 'center' },
  row2: { display: 'flex', gap: 12 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
  h1: { fontSize: 28, fontWeight: 700, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  h3: { fontSize: 18, fontWeight: 700, marginBottom: 10 },
  venueSelect: { fontSize: 24, fontWeight: 700, border: 'none', background: 'transparent', color: '#1C1530' },
  badges: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  badge: { fontSize: 12, fontWeight: 600, background: '#F1EEF8', color: '#6B6385', padding: '4px 10px', borderRadius: 20 },
  badgeOk: { background: '#E7F8EE', color: '#15803D' },
  muted: { color: '#8A83A3', fontSize: 14 },
  mutedSmall: { color: '#8A83A3', fontSize: 12, marginTop: 2 },
  note: { color: '#6B6385', fontSize: 13, background: '#F1EEF8', borderRadius: 10, padding: '10px 12px' },
  err: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  tabs: { display: 'flex', gap: 6, background: '#ECEAF3', padding: 4, borderRadius: 12, marginBottom: 18, flexWrap: 'wrap' },
  tab: { border: 'none', background: 'transparent', padding: '8px 14px', borderRadius: 9, fontSize: 14, fontWeight: 600, color: '#6B6385' },
  tabOn: { background: '#fff', color: '#1C1530', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  card: { background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #ECEAF3' },
  card0: { background: '#fff', borderRadius: 14, border: '1px solid #ECEAF3', overflow: 'hidden' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#6B6385', margin: '12px 0 6px' },
  input: { width: '100%', border: '1px solid #E2DEEC', borderRadius: 10, padding: '10px 12px', fontSize: 15, background: '#fff', outline: 'none', marginBottom: 4 },
  primary: { width: '100%', background: P, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 700, marginTop: 14 },
  primarySmall: { background: P, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700 },
  secondary: { background: '#fff', color: '#1C1530', border: '1px solid #E2DEEC', borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: P, fontSize: 14, fontWeight: 600, padding: 6 },
  pill: { border: '1px solid #E2DEEC', background: '#fff', borderRadius: 20, padding: '8px 14px', fontSize: 14, fontWeight: 600 },
  pillOn: { background: '#E7F8EE', borderColor: '#BBF0CF', color: '#15803D' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  catTitle: { fontWeight: 700, fontSize: 15, margin: '0 0 8px 4px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' },
  line: { borderTop: '1px solid #F1EEF8' },
  itemName: { fontWeight: 600, fontSize: 15 },
  tag: { fontSize: 11, fontWeight: 600, color: '#6B6385', background: '#F1EEF8', borderRadius: 8, padding: '2px 6px', marginLeft: 6 },
  price: { fontWeight: 700, fontSize: 15, minWidth: 70, textAlign: 'right' },
  chip: { border: '1px solid #E2DEEC', background: '#fff', borderRadius: 16, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: '#8A83A3' },
  chipOn: { background: '#E7F8EE', borderColor: '#BBF0CF', color: '#15803D' },
  iconBtn: { background: 'none', border: 'none', fontSize: 15, padding: 4, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(20,12,40,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 },
  modal: { background: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' },
  segment: { display: 'flex', background: '#F1EEF8', borderRadius: 10, padding: 3, gap: 3 },
  seg: { flex: 1, border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 4px', fontSize: 13, fontWeight: 600, color: '#6B6385' },
  segOn: { background: '#fff', color: '#1C1530', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  qrGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  qrCard: { background: '#fff', border: '1px solid #ECEAF3', borderRadius: 16, padding: 16, textAlign: 'center', breakInside: 'avoid' },
  qrVenue: { fontWeight: 700, fontSize: 14, marginBottom: 8 },
  qrLabel: { fontWeight: 800, fontSize: 20, marginTop: 6 },
  qrHint: { color: '#8A83A3', fontSize: 12, marginTop: 2 },
  hero: { textAlign: 'center', paddingTop: 40 },
  heroTitle: { fontSize: 34, fontWeight: 800, letterSpacing: -0.6 },
  heroSub: { color: '#6B6385', fontSize: 16, marginTop: 10 },
};
