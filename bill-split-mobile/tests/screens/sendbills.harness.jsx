// 📤 Bill screen with sample data: the "Send each friend their bill" section
import { createRoot } from 'react-dom/client';
import BillDetailScreen from '../../screens/BillDetailScreen';
window.__sent = [];
window.__amounts = [];
window.__opened = [];
window.__profile = { upi_id: 'musthaq@upi' };
window.open = (u) => { window.__opened.push(u); return null; };
navigator.share = async () => {};
window.__phones = { alina: '98470 12345' };
const P = (id, name, due, extra = {}) => ({ id, name, amount_due: due, paid_amount: 0, not_drinking: false, paid_at: null, paid_claimed_at: null, ...extra });
window.__bill = {
  id: 'b1', title: 'Brik Oven', restaurant: 'Brik Oven', total: 1660, paid_mode: 'me', party_id: 'pt', share_token: 'tok-9',
  created_at: '2026-11-27T20:00:00Z', status: 'split', sent_at: null,
  bill_participants: [P('me', 'Me', 485, { paid_amount: 1660 }), P('al', 'Alina', 175), P('vj', 'Vijay', 400), P('ka', 'Kanchan', 600, { paid_at: '2026-11-27T21:00:00Z' })],
  bill_items: [
    { id: 'i1', name: 'French Fries', price: 350, quantity: 1, kind: 'food', item_claims: [{ participant_id: 'me' }, { participant_id: 'al' }] },
    { id: 'i2', name: 'Pizza', price: 620, quantity: 1, kind: 'food', item_claims: [{ participant_id: 'me' }, { participant_id: 'vj' }] },
    { id: 'i3', name: 'Beer', price: 600, quantity: 3, kind: 'alcohol', item_claims: [{ participant_id: 'ka', units: 3 }] },
    { id: 'i4', name: 'Coke', price: 90, quantity: 1, kind: 'soft', item_claims: [] },
  ],
};
createRoot(document.getElementById('root')).render(<BillDetailScreen billId="b1" onBack={() => {}} onDeleted={() => {}} onEdit={() => {}} onAddRound={() => {}} />);
