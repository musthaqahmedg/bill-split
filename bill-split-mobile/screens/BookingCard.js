import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BookTable from './BookTable';
import { STATUS, cabUrl, mapsUrl, partyBooking, setBookingStatus } from '../services/bookings';
import { C } from '../services/theme';

// 🍽️ Table booking on a plan: book, track the reply, then cab + directions
export default function BookingCard({ party, onTakeOut, refreshKey }) {
  const [booking, setBooking] = useState(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const going = (party.party_members || []).filter((m) => m.rsvp !== 'out').length;
  const home = !party.place || /^my place|current location/i.test(party.place);

  const load = () => partyBooking(party.id).then(setBooking).catch(() => setBooking(null));
  useEffect(() => { load(); }, [party.id, refreshKey]);

  const mark = (status, ask) => {
    const go = async () => {
      try {
        await setBookingStatus(booking.id, status);
        load();
      } catch (e) {
        Alert.alert("Couldn't update", e.message);
      }
    };
    if (!ask) return go();
    Alert.alert(ask, undefined, [{ text: 'No', style: 'cancel' }, { text: 'Yes', style: status === 'cancelled' ? 'destructive' : 'default', onPress: go }]);
  };

  if (booking === undefined) return null;

  // No booking yet
  if (!booking) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>🍽️ Table</Text>
        {party.kind === 'house' || home ? (
          <TouchableOpacity style={styles.btn} onPress={onTakeOut}>
            <Text style={styles.btnText}>🍽️ Take the group out</Text>
            <Text style={styles.btnSub}>Find a place nearby and book for {going}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}>
              <Text style={styles.btnText}>🍽️ Book a table at {party.place.split(',')[0]}</Text>
              <Text style={styles.btnSub}>For {going} {going === 1 ? 'person' : 'people'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onTakeOut}>
              <Text style={styles.link}>Or pick another place ›</Text>
            </TouchableOpacity>
          </>
        )}
        <BookTable visible={open} onClose={() => setOpen(false)} place={{ name: party.place || '' }} party={party} guestsDefault={going} onBooked={load} />
      </View>
    );
  }

  const st = STATUS[booking.status] || STATUS.pending;
  return (
    <View style={[styles.box, booking.status === 'confirmed' && styles.boxOk]}>
      <View style={styles.row}>
        <Text style={styles.title}>🍽️ Table</Text>
        <Text style={[styles.status, booking.status === 'confirmed' ? styles.ok : booking.status === 'declined' ? styles.bad : styles.wait]}>
          {st.icon} {st.label}
        </Text>
      </View>
      <Text style={styles.place}>{booking.place_name}</Text>
      <Text style={styles.meta}>{booking.booking_date} · {booking.booking_time} · {booking.guests} people</Text>
      {booking.notes ? <Text style={styles.meta}>📝 {booking.notes}</Text> : null}

      <View style={styles.actions}>
        {booking.status === 'pending' && (
          <>
            <TouchableOpacity style={[styles.small, styles.smallOk]} onPress={() => mark('confirmed')}>
              <Text style={styles.smallTextDark}>✅ They confirmed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => mark('declined')}>
              <Text style={styles.smallText}>❌ They said no</Text>
            </TouchableOpacity>
          </>
        )}
        {booking.status === 'confirmed' && (
          <>
            <TouchableOpacity style={styles.small} onPress={() => Linking.openURL(cabUrl(booking.place_name))}>
              <Text style={styles.smallText}>🚕 Book a cab</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => Linking.openURL(mapsUrl(booking.place_name))}>
              <Text style={styles.smallText}>🧭 Directions</Text>
            </TouchableOpacity>
          </>
        )}
        {booking.status === 'declined' ? (
          <TouchableOpacity style={styles.small} onPress={() => { mark('cancelled'); onTakeOut(); }}>
            <Text style={styles.smallText}>🔄 Try another place</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.small} onPress={() => mark('cancelled', 'Cancel this booking?')}>
            <Text style={styles.smallText}>🚫 Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Everyone in the plan sees this in the chat and on the invite link.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  boxOk: { borderColor: C.green },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  status: { fontSize: 13, fontWeight: '600' },
  ok: { color: C.green },
  bad: { color: C.red },
  wait: { color: C.amber },
  place: { color: C.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  meta: { color: C.sub, fontSize: 13, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  small: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
  smallOk: { backgroundColor: C.green },
  smallText: { color: C.text, fontSize: 13, fontWeight: '600' },
  smallTextDark: { color: '#06281C', fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  link: { color: C.accentSoft, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  hint: { color: C.faint, fontSize: 11, marginTop: 6 },
});
