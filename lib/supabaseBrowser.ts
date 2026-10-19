'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbenotupawglvkufjkni.supabase.co';
// Publishable key: safe to be public. Security comes from the database rules (RLS).
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sE_I9O5ZkMTnWj_SRZTebA_d31syfSV';

let client: SupabaseClient | null = null;
export function supabase() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
