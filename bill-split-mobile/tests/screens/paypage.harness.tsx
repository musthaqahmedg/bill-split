// 📤 The private pay page a friend opens from their WhatsApp bill
import { createRoot } from 'react-dom/client';
import PayView from '../../../app/pay/[member]/PayView';
(window as any).__rpc = [];
const bill: any = {
  restaurant: 'Brik Oven', bill_date: '2026-11-25 14:32:42', payee_name: 'Musthaq', payee_upi: 'musthaq@upi',
  name: 'Alina', amount: 355, paid: false, says_paid: false,
  lines: [
    { name: 'French Fries', shared_by: 6, units: 1, total_units: 6, amount: 58.33 },
    { name: 'Pepperoni Pizza', shared_by: 5, units: 1, total_units: 5, amount: 162 },
    { name: 'Kingfisher', shared_by: 2, units: 2, total_units: 3, amount: 160 },
  ],
};
createRoot(document.getElementById('root')!).render(<PayView bill={bill} member="al" />);
