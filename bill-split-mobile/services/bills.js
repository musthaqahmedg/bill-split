import { supabase } from './supabaseClient';

// A bill's "fingerprint": restaurant + bill number + date + total.
// Same fingerprint twice = probably the same bill scanned again.
export function makeFingerprint(bill) {
  if (!bill || (!bill.restaurant && !bill.bill_no)) return null;
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return [clean(bill.restaurant), clean(bill.bill_no), clean(bill.date), Math.round(bill.total || 0)].join('|');
}

export async function findDuplicate(bill) {
  const fp = makeFingerprint(bill);
  if (!fp) return null;
  const { data } = await supabase
    .from('bills')
    .select('id, title, created_at')
    .eq('fingerprint', fp)
    .limit(1);
  return data && data.length ? data[0] : null;
}

export async function saveBill({ bill, items, people, claims, amounts }) {
  // 1. The bill itself
  const { data: saved, error: e1 } = await supabase
    .from('bills')
    .insert({
      title: bill.restaurant || 'Night out',
      restaurant: bill.restaurant || null,
      bill_no: bill.bill_no || null,
      bill_date: bill.date || null,
      total: bill.total || 0,
      tax: bill.tax || 0,
      service_charge: bill.service_charge || 0,
      discount: bill.discount || 0,
      fingerprint: makeFingerprint(bill),
      status: 'split',
    })
    .select()
    .single();
  if (e1) throw e1;

  // 2. The items
  const { data: savedItems, error: e2 } = await supabase
    .from('bill_items')
    .insert(items.map((it) => ({ bill_id: saved.id, name: it.name, price: it.price, quantity: it.qty })))
    .select();
  if (e2) throw e2;

  // 3. The people and what each owes
  const { data: savedPeople, error: e3 } = await supabase
    .from('bill_participants')
    .insert(people.map((name) => ({ bill_id: saved.id, name, amount_due: amounts[name] || 0 })))
    .select();
  if (e3) throw e3;

  // 4. Who had what
  const idOf = Object.fromEntries(savedPeople.map((p) => [p.name, p.id]));
  const rows = [];
  items.forEach((_, i) => {
    (claims[i] || []).forEach((name) => rows.push({ item_id: savedItems[i].id, participant_id: idOf[name] }));
  });
  if (rows.length) {
    const { error: e4 } = await supabase.from('item_claims').insert(rows);
    if (e4) throw e4;
  }

  return saved;
}

export async function listBills() {
  const { data, error } = await supabase
    .from('bills')
    .select('id, title, total, bill_date, created_at, bill_participants(name, amount_due)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}