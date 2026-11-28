
import { BRAND } from './theme.js';// 📤 "Send each friend their own bill" — the WhatsApp message and links (pure: no app or database code).
// Amounts come from the existing split; this only describes them. Each message holds ONE person's amounts.

const SITE = BRAND.site;

// ₹538 or ₹538.50 (never more than 2 decimals)
export function rupees(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return '₹' + (Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

// What one person had: their part of each item before tax & service
export function personLines(items, pid) {
  const out = [];
  for (const it of items || []) {
    const claims = it.item_claims || [];
    const mine = claims.find((c) => c.participant_id === pid);
    if (!mine) continue;
    const units = claims.reduce((s, c) => s + (c.units || 1), 0) || 1;
    const myUnits = mine.units || 1;
    out.push({
      name: it.name,
      sharedBy: claims.length,
      units: myUnits,
      totalUnits: units,
      amount: Math.round(((Number(it.price) || 0) * myUnits / units) * 100) / 100,
    });
  }
  return out;
}

// Items nobody ticked (their money isn't in anyone's share)
export function unclaimed(items) {
  const left = (items || []).filter((it) => !(it.item_claims || []).length);
  return { count: left.length, amount: Math.round(left.reduce((s, it) => s + (Number(it.price) || 0), 0) * 100) / 100 };
}

// The friend's own pay page: the bill page, already set to them, showing only their share
export const payLink = (token, pid) => `${SITE}/b/${token}?p=${pid}`;

// The message. `total` is what they pay you; item lines are shown only when they add up to it
// (if someone covered part of their share, we just show the total, never other people's amounts).
export function buildBillMessage({ title, date, name, lines = [], total, link, upi }) {
  const t = Math.round((Number(total) || 0) * 100) / 100;
  const itemsSum = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const extra = Math.round((t - itemsSum) * 100) / 100;
  const showItems = lines.length > 0 && Math.abs(extra) <= Math.max(1, t * 0.5);
  const out = [`🧾 ${title || 'Our night out'}${date ? ` · ${date}` : ''}`, '', `Hi ${name}! Your share:`];
  if (showItems) {
    for (const l of lines) {
      const how = l.totalUnits > l.sharedBy ? ` (${l.units} of ${l.totalUnits})` : l.sharedBy > 1 ? ` (shared by ${l.sharedBy})` : '';
      out.push(`• ${l.name}${how} ${rupees(l.amount)}`);
    }
    if (Math.abs(extra) >= 0.01) out.push(extra > 0 ? `• Tax & service ${rupees(extra)}` : `• Discount −${rupees(-extra)}`);
    out.push('─────────');
  }
  out.push(`Total: ${rupees(t)}`);
  if (link) out.push('', 'Pay here 👇', link);
  if (upi) out.push(`${link ? 'Or send' : 'Send'} to UPI ID: ${upi}`);
  return out.join('\n');
}

// WhatsApp link. With a number it opens that chat; without one, WhatsApp asks which chat.
// Indian 10-digit numbers get +91. Everything in the text is URL-encoded (₹, emoji, spaces, &).
export function waUrl(phone, text) {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  const q = 'text=' + encodeURIComponent(text);
  return digits.length >= 11 ? `https://wa.me/${digits}?${q}` : `https://wa.me/?${q}`;
}
