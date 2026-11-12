import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// 🎁 Invite link: shows who invited you + the code to enter after signing up.
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbenotupawglvkufjkni.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sE_I9O5ZkMTnWj_SRZTebA_d31syfSV';
const CODE = /^[A-Z2-9]{6}$/;

async function inviter(code: string): Promise<string | null> {
  if (!CODE.test(code)) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/invite_info`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.name ? String(data.name) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const name = await inviter(code.toUpperCase());
  return {
    title: `${name || 'A friend'} invited you to VibeOut 🌙`,
    description: 'Plan nights out, book tables and split bills without the drama.',
  };
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0E0E12', color: '#F7F7F9', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, textAlign: 'center' },
  kicker: { color: '#E2FF3B', fontSize: 12, letterSpacing: 2, fontWeight: 800 },
  title: { fontSize: 32, fontWeight: 900, margin: '10px 0 6px', lineHeight: 1.15 },
  sub: { color: '#B7B7C4', fontSize: 16, margin: 0 },
  codeBox: { background: '#A98BFF', color: '#0E0E12', borderRadius: 24, padding: '22px 16px', marginTop: 24 },
  codeLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 2, opacity: 0.8 },
  code: { fontSize: 44, fontWeight: 900, letterSpacing: 8, margin: '6px 0 0', userSelect: 'all' },
  steps: { textAlign: 'left', background: '#1A1A21', border: '1px solid #2A2A35', borderRadius: 18, padding: 16, marginTop: 16, lineHeight: 1.6, fontSize: 15 },
  foot: { color: '#6E6E7E', fontSize: 13, marginTop: 18 },
};

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const name = await inviter(code);
  if (!name) notFound();
  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={s.kicker}>🌙 VIBEOUT</div>
        <h1 style={s.title}>{name} invited you!</h1>
        <p style={s.sub}>Plan nights out, book tables and split bills without the drama.</p>
        <div style={s.codeBox}>
          <div style={s.codeLabel}>YOUR INVITE CODE</div>
          <div style={s.code}>{code}</div>
        </div>
        <div style={s.steps}>
          1️⃣ Get the VibeOut app<br />
          2️⃣ Sign up, then open <b>Me → 🎁 Invite</b><br />
          3️⃣ Enter <b>{code}</b> — you and {name} become friends instantly 🎉
        </div>
        <p style={s.foot}>VibeOut is in early testing. Ask {name} to get you in.</p>
      </div>
    </main>
  );
}
