import React from 'react';
import { createRoot } from 'react-dom/client';
import PartyView from '../../../app/p/[token]/PartyView';

// Same set-up as the real "Yu" plan: planned as a treat, then a real bill was split by items
const withBill = location.hash !== '#nobill';
(window as any).__calls = [];
const BILLS = [{ restaurant: 'Brik Oven', total: 1825, share_token: 'tok-1', payer: 'Gauthamnath', people: 5, created_at: '2026-11-26' }];
window.fetch = (async (url: string, init: any) => {
  const fn = String(url).split('/rpc/')[1];
  (window as any).__calls.push(fn);
  const body = fn === 'get_party_bills' ? (withBill ? BILLS : []) : fn === 'get_party_pot' ? { target: null, paid: 0, people: [] } : [];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as any;
const party: any = {
  title: 'Yu', kind: 'nightout', party_date: '2026-11-26', place: 'Brik Oven', budget: 660, hide_bill: false, split_mode: 'treat',
  special_person: null, host_name: 'Gauthamnath', host_upi: null,
  members: [
    { id: 'm0', name: 'Me', share: 0, paid: false, rsvp: 'in' },
    { id: 'm1', name: 'Alina', share: 0, paid: false, rsvp: 'in' },
    { id: 'm2', name: 'Ram', share: 0, paid: false, rsvp: 'in' },
  ],
};
createRoot(document.getElementById('root')!).render(<PartyView party={party} token="t" supabaseUrl="https://x.supabase.co" supabaseKey="k" />);
