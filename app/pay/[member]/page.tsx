import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PayView, { MemberBill } from './PayView';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbenotupawglvkufjkni.supabase.co';
// Publishable key: safe to be public. This page only ever gets ONE friend's own share.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sE_I9O5ZkMTnWj_SRZTebA_d31syfSV';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getShare(member: string): Promise<MemberBill | null> {
  if (!UUID.test(member)) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_member_bill`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_member: member }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.name ? (data as MemberBill) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ member: string }> }): Promise<Metadata> {
  const { member } = await params;
  const b = await getShare(member);
  return { title: `${b?.restaurant || 'Night out'} · Your share`, description: 'Your share of the bill, with a UPI link to pay.', robots: { index: false, follow: false } };
}

// 📤 The link each friend gets on WhatsApp: only their own amount
export default async function PayPage({ params }: { params: Promise<{ member: string }> }) {
  const { member } = await params;
  const b = await getShare(member);
  if (!b) notFound();
  return <PayView bill={b} member={member} />;
}
