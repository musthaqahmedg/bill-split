import React from 'react';
import { createRoot } from 'react-dom/client';
import ShareView from '../../../app/b/[token]/ShareView';
(window as any).__rpc = [];
const P = (id: string, name: string, due: number) => ({ id, name, amount_due: due, not_drinking: false, paid: false });
const bill: any = {
  restaurant: 'Brik Oven', bill_date: '25 Nov', total: 1660, payee_name: 'Musthaq', payee_upi: 'musthaq@upi', paid_mode: 'me',
  people: [P('me', 'Me', 485), P('al', 'Alina', 175), P('an', 'Anuraj', 0), P('ka', 'Kanchan', 1000)],
  items: [
    { id: 'i1', name: 'French Fries', price: 350, quantity: 1, kind: 'food', about: null, claims: [{ participant_id: 'me', paid_by: 'me' }, { participant_id: 'al', paid_by: 'al' }] },
    { id: 'i2', name: 'Rei Cotta Pizza', price: 620, quantity: 1, kind: 'food', about: null, claims: [{ participant_id: 'me', paid_by: 'me' }, { participant_id: 'ka', paid_by: 'ka' }] },
    { id: 'i3', name: 'Kingfisher Ultra', price: 600, quantity: 3, kind: 'alcohol', about: null, claims: [{ participant_id: 'ka', paid_by: 'ka', units: 3 }] },
    { id: 'i4', name: 'Coke', price: 90, quantity: 1, kind: 'soft', about: null, claims: [] },
  ],
};
createRoot(document.getElementById('root')!).render(<ShareView bill={bill} token="t1" start={location.hash.startsWith('#p=') ? location.hash.slice(3) : undefined} />);
