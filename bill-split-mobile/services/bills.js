import { kindOf } from './kinds';
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

// payers: one object per item, e.g. { Shajaaz: 'Shafil' } = Shafil pays for Shajaaz's part of this item
// nonDrinkers: names of people marked "Not drinking"
export async function saveBill({ bill, items, people, claims, payers, nonDrinkers, amounts, createdAt, paidAt }) {
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
      ...(createdAt ? { created_at: createdAt } : {}),
    })
    .select()
    .single();
  if (e1) throw e1;

  // 2. The items (with their type: alcohol / soft / food, and a short description)
  const { data: savedItems, error: e2 } = await supabase
    .from('bill_items')
    .insert(items.map((it) => ({
      bill_id: saved.id, name: it.name, price: it.price, quantity: it.qty, kind: kindOf(it),
      about: it.about || null,
    })))
    .select();
  if (e2) throw e2;

  // 3. The people, what each owes, and who's not drinking
  const dry = nonDrinkers || [];
  const { data: savedPeople, error: e3 } = await supabase
    .from('bill_participants')
    .insert(people.map((name) => ({
      bill_id: saved.id, name, amount_due: amounts[name] || 0, not_drinking: dry.includes(name),
      paid_at: (paidAt && paidAt[name]) || null,
    })))
    .select();
  if (e3) throw e3;

  // 4. Who had what, and who's paying for it
  const idOf = Object.fromEntries(savedPeople.map((p) => [p.name, p.id]));
  const rows = [];
  items.forEach((_, i) => {
    (claims[i] || []).forEach((name) => {
      const payer = payers && payers[i] && payers[i][name];
      rows.push({
        item_id: savedItems[i].id,
        participant_id: idOf[name],
        paid_by: payer && idOf[payer] ? idOf[payer] : null,
      });
    });
  });
  if (rows.length) {
    const { error: e4 } = await supabase.from('item_claims').insert(rows);
    if (e4) throw e4;
  }

  return saved;
}

// Edit: save a clean new copy (keeping the original date), then remove the old one
export async function updateBill(oldId, payload) {
  const { data: old, error: e0 } = await supabase
    .from('bills')
    .select('created_at, bill_participants(name, paid_at)')
    .eq('id', oldId)
    .single();
  if (e0) throw e0;

  // Keep "paid" ticks for people who are still on the bill
  const paidAt = Object.fromEntries(
    (old.bill_participants || []).filter((p) => p.paid_at).map((p) => [p.name, p.paid_at])
  );

  const saved = await saveBill({ ...payload, createdAt: old.created_at, paidAt });
  await deleteBill(oldId);
  return saved;
}

// Turn a saved bill back into the shapes the screens use
export function billToFlow(saved) {
  const items = (saved.bill_items || []).map((it) => ({
    name: it.name,
    qty: it.quantity || 1,
    price: Number(it.price) || 0,
    ...(it.kind ? { kind: it.kind } : {}),
    ...(it.about ? { about: it.about } : {}),
  }));

  const bill = {
    restaurant: saved.restaurant || '',
    bill_no: saved.bill_no || '',
    date: saved.bill_date || '',
    total: Number(saved.total) || 0,
    tax: Number(saved.tax) || 0,
    service_charge: Number(saved.service_charge) || 0,
    discount: Number(saved.discount) || 0,
  };

  const participants = saved.bill_participants || [];
  const people = participants.map((p) => p.name);
  const nonDrinkers = participants.filter((p) => p.not_drinking).map((p) => p.name);
  const nameOf = Object.fromEntries(participants.map((p) => [p.id, p.name]));

  const claims = (saved.bill_items || []).map((it) =>
    (it.item_claims || []).map((c) => nameOf[c.participant_id]).filter(Boolean)
  );

  const payers = (saved.bill_items || []).map((it) => {
    const map = {};
    (it.item_claims || []).forEach((c) => {
      if (c.paid_by && c.paid_by !== c.participant_id && nameOf[c.paid_by]) {
        map[nameOf[c.participant_id]] = nameOf[c.paid_by];
      }
    });
    return map;
  });

  return { items, bill, people, nonDrinkers, claims, payers };
}

export async function listBills() {
  const { data, error } = await supabase
    .from('bills')
    .select('id, title, total, bill_date, created_at, bill_participants(name, amount_due)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBill(id) {
  const { data, error } = await supabase
    .from('bills')
    .select('*, bill_items(id, name, price, quantity, kind, about, item_claims(participant_id, paid_by)), bill_participants(id, name, amount_due, not_drinking, paid_at)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBill(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}

// Settle up: tick (or untick) that someone has paid you
export async function setPaid(participantId, paid) {
  const { error } = await supabase
    .from('bill_participants')
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq('id', participantId);
  if (error) throw error;
}