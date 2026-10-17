import { supabase } from './supabaseClient';

// 🍽️ Table bookings (stage 1: we send the restaurant a WhatsApp / call, you mark it confirmed)

export const NOTE_CHIPS = ['Birthday 🎂', 'Quiet corner 🤫', 'Veg only 🥗', 'Outdoor seating 🌿', 'Big table 👥'];

export const STATUS = {
  pending: { icon: '⏳', label: 'Waiting for the restaurant' },
  confirmed: { icon: '✅', label: 'Confirmed' },
  declined: { icon: '❌', label: 'They said no' },
  cancelled: { icon: '🚫', label: 'Cancelled' },
};

export async function partyBooking(partyId) {
  const { data, error } = await supabase
    .from('table_bookings')
    .select('*')
    .eq('party_id', partyId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

export async function createBooking(b) {
  const { data, error } = await supabase.from('table_bookings').insert(b).select().single();
  if (error) throw error;
  return data;
}

export async function setBookingStatus(id, status) {
  const { error } = await supabase.from('table_bookings').update({ status }).eq('id', id);
  if (error) throw error;
}

export const bookingMessage = (b) =>
  `Hi ${b.place_name}! I'd like to book a table for ${b.guests} on ${b.booking_date} at ${b.booking_time}.` +
  (b.notes ? `\nNotes: ${b.notes}` : '') +
  '\nPlease confirm. Thank you! 🙏';

// 🚕 Uber straight to the place
export const cabUrl = (place) =>
  `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(place)}&dropoff[nickname]=${encodeURIComponent(place)}`;

export const mapsUrl = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

// Bars / pubs need an age check first
export const isBar = (place) => /\b(bar|pub|lounge|beer|brew|club|wine)\b/i.test(`${place.name || ''} ${place.kind || ''}`);
