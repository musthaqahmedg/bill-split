import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShareView, { SharedBill } from './ShareView';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbenotupawglvkufjkni.supabase.co';
// Publishable key: safe to be public. A bill can only be read with its secret share link.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sE_I9O5ZkMTnWj_SRZTebA_d31syfSV';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getBill(token: string): Promise<SharedBill | null> {
  if (!UUID.test(token)) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_bill`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.people ? (data as SharedBill) : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const bill = await getBill(token);
  return {
    title: `${bill?.restaurant || 'Night out'} · Your share`,
    description: 'Tap your name to see what you had and what you owe.',
  };
}

export default async function SharedBillPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const bill = await getBill(token);
  if (!bill) notFound();
  return <ShareView bill={bill} />;
}