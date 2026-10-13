import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PartyView, { SharedParty } from './PartyView';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbenotupawglvkufjkni.supabase.co';
// Publishable key: safe to be public. A party can only be read with its secret invite link.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sE_I9O5ZkMTnWj_SRZTebA_d31syfSV';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getParty(token: string): Promise<SharedParty | null> {
  if (!UUID.test(token)) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_party`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.members ? (data as SharedParty) : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const party = await getParty(token);
  return {
    title: `${party?.title || 'Party'} · You're invited 🎉`,
    description: 'Tap your name and tell us if you are coming.',
  };
}

export default async function SharedPartyPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const party = await getParty(token);
  if (!party) notFound();
  return <PartyView party={party} token={token} supabaseUrl={SUPABASE_URL} supabaseKey={SUPABASE_KEY} />;
}
