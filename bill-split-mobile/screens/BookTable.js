import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { NOTE_CHIPS, bookingMessage, createBooking, isBar } from '../services/bookings';
import { waNumber } from '../services/parties';
import { C, F } from '../services/theme';

const AGE_KEY = 'vibeout.ageOk';
const TIMES = ['12:30 PM', '1:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM'];

// Next 7 days: "Today", "Tomorrow", "Sat, 24 Oct"…
const days = () => {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({ label, value: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return out;
};

// 🍽️ Book a table: pick day, time, people, notes → we message the restaurant for you
export default function BookTable({ visible, onClose, place, party, guestsDefault = 2, onBooked }) {
  const DAYS = days();
  const [day, setDay] = useState(DAYS[0].value);
  const [time, setTime] = useState('8:00 PM');
  const [guests, setGuests] = useState(guestsDefault);
  const [chips, setChips] = useState([]);
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setGuests(Math.max(1, guestsDefault));
    setChips(party && party.kind === 'birthday' ? ['Birthday 🎂'] : []);
    setExtra('');
    // Plan already has one of the next 7 days as its date? Start there.
    const match = party && DAYS.find((d) => party.party_date && party.party_date.includes(d.value.split(', ')[1] || '~'));
    setDay(match ? match.value : DAYS[0].value);
    // Bars and pubs: check age first (asked once)
    if (place && isBar(place)) {
      AsyncStorage.getItem(AGE_KEY).then((v) => {
        if (v === 'yes') return;
        Alert.alert('Age check 🔞', "Are you of legal drinking age where you live? (In Kerala it's 23+)", [
          { text: 'No', style: 'cancel', onPress: onClose },
          { text: "Yes, I'm of age", onPress: () => AsyncStorage.setItem(AGE_KEY, 'yes').catch(() => {}) },
        ]);
      }).catch(() => {});
    }
  }, [visible]);

  if (!place) return null;

  const toggle = (c) => setChips((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  const notes = [...chips.map((c) => c.replace(/\s\S+$/, '')), extra.trim()].filter(Boolean).join(', ');

  const send = async () => {
    setSaving(true);
    let b;
    try {
      b = await createBooking({
        party_id: party ? party.id : null,
        place_name: place.name,
        place_id: place.id || null,
        phone: place.phone || null,
        booking_date: day,
        booking_time: time,
        guests,
        notes: notes || null,
      });
    } catch (e) {
      setSaving(false);
      return Alert.alert("Couldn't save the booking", e.message);
    }
    setSaving(false);
    const msg = bookingMessage(b);
    onBooked && onBooked(b);
    onClose();
    // Send it to the restaurant
    if (place.phone) {
      const phone = place.phone.split(';')[0];
      Alert.alert('Send to the restaurant', `How do you want to reach ${place.name}?`, [
        { text: '💬 WhatsApp', onPress: () => Linking.openURL(`whatsapp://send?phone=${waNumber(phone)}&text=${encodeURIComponent(msg)}`).catch(() => Share.share({ message: msg })) },
        { text: '📞 Call', onPress: () => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`) },
        { text: 'Later', style: 'cancel' },
      ]);
    } else {
      Alert.alert(
        'Booking saved ⏳',
        `${place.name} has no number on the map yet. Send them this message on WhatsApp or Instagram, then mark it confirmed when they reply.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Share message', onPress: () => Share.share({ message: msg }) },
        ]
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>🍽️ Book a table</Text>
            <Text style={styles.place} numberOfLines={2}>{place.name}</Text>

            <Text style={styles.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DAYS.map((d) => (
                <TouchableOpacity key={d.value} style={[styles.chip, day === d.value && styles.chipOn]} onPress={() => setDay(d.value)}>
                  <Text style={[styles.chipText, day === d.value && styles.chipTextOn]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TIMES.map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, time === t && styles.chipOn]} onPress={() => setTime(t)}>
                  <Text style={[styles.chipText, time === t && styles.chipTextOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>People</Text>
            <View style={styles.stepRow}>
              <TouchableOpacity style={styles.step} onPress={() => setGuests(Math.max(1, guests - 1))}>
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.guests}>{guests}</Text>
              <TouchableOpacity style={styles.step} onPress={() => setGuests(Math.min(500, guests + 1))}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
              {party ? <Text style={styles.fromPlan}>from your plan</Text> : null}
            </View>

            <Text style={styles.label}>Notes</Text>
            <View style={styles.wrap}>
              {NOTE_CHIPS.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, styles.mb, chips.includes(c) && styles.chipOn]} onPress={() => toggle(c)}>
                  <Text style={[styles.chipText, chips.includes(c) && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={extra}
              onChangeText={setExtra}
              placeholder="Anything else? (optional)"
              placeholderTextColor={C.faint}
              keyboardAppearance="dark"
              maxLength={120}
            />

            <TouchableOpacity style={styles.btn} onPress={send} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : `Request table for ${guests}`}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>We message the restaurant for you. No payment needed.</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  flex: { flex: 1 },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 12 },
  title: { fontFamily: F.display, color: C.text, fontSize: 22 },
  place: { color: C.sub, fontSize: 15, marginTop: 2 },
  label: { color: C.faint, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  chip: { borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.sub, fontSize: 14, fontWeight: '500' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  mb: { marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.text, fontSize: 20, fontWeight: '600' },
  guests: { color: C.text, fontSize: 20, fontWeight: '700', marginHorizontal: 16, minWidth: 28, textAlign: 'center' },
  fromPlan: { color: C.faint, fontSize: 12, marginLeft: 10 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 12, fontSize: 15, color: C.text, marginTop: 4 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
