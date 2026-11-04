import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { recentFriends } from '../services/bills';
import { myFriends } from '../services/friends';
import { show } from '../services/names';
import { createParty } from '../services/parties';
import { findPlaces, getMyLocation, placeDetails, showKm } from '../services/places';
import { C, F, STICK } from '../services/theme';
import BookTable from './BookTable';
import ContactPicker from './ContactPicker';

// 🤟 "Pull up?" (new UX): the fast way to plan tonight. Vibe → your people → a spot → LOCK IT IN.
// No budget, no long form. The room is created and the squad gets the invite.
export const VIBES = [
  { key: 'predrinks', label: 'Pre-drinks', emoji: '🍹', kind: 'nightout', cat: 'bars' },
  { key: 'club', label: 'Club', emoji: '🪩', kind: 'party', cat: 'pubs' },
  { key: 'crawl', label: 'Bar crawl', emoji: '🍻', kind: 'nightout', cat: 'bars' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️', kind: 'party', cat: 'food' },
  { key: 'chai', label: 'Chai & chill', emoji: '☕', kind: 'party', cat: 'cafes' },
  { key: 'movie', label: 'Movie', emoji: '🎬', kind: 'movie', cat: 'cinema' },
];
const HUES = [C.lime, C.pink, C.violet, C.cyan, '#FFD84D', '#7CFFB2', '#FF8A3D', '#FFB3D9'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];
const dayText = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function PullUpScreen({ initialVibe = 'predrinks', onBack, onCreated }) {
  const [vibe, setVibe] = useState(VIBES.find((v) => v.key === initialVibe) || VIBES[0]);
  const [step, setStep] = useState(1); // 1 people · 2 spot
  const [day, setDay] = useState(0); // 0 tonight · 1 tomorrow
  const [spaceName, setSpaceName] = useState(''); // 🗂️ the Space's name (blank → a suggestion)
  const [pool, setPool] = useState([]); // friend names to pick from
  const [people, setPeople] = useState([]); // picked (not including Me)
  const [phones, setPhones] = useState({});
  const [typed, setTyped] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [spots, setSpots] = useState(null);
  const [spot, setSpot] = useState(null); // null = squad votes later
  const [saving, setSaving] = useState(false);
  const [wantTable, setWantTable] = useState(false); // 🍽️ also request a table at the spot
  const [booking, setBooking] = useState(null); // { party, place } → BookTable sheet

  useEffect(() => {
    Promise.all([recentFriends(20).catch(() => []), myFriends().catch(() => [])]).then(([recent, app]) => {
      const appNames = (app || []).filter((f) => f.status === 'accepted').map((f) => f.name).filter(Boolean);
      const seen = new Set();
      setPool([...appNames, ...(recent || [])].filter((n) => n && n !== 'Me' && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase())));
    });
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    setSpots(null);
    getMyLocation({ ask: true })
      .then((loc) => findPlaces(loc.coords, '', vibe.cat))
      .then((list) => setSpots((list || []).slice(0, 8)))
      .catch(() => setSpots([]));
  }, [step, vibe.key]);

  const autoName = `${vibe.label} ${day ? 'tomorrow' : 'tonight'} ${vibe.emoji}`;
  const toggle = (name) => setPeople(people.includes(name) ? people.filter((p) => p !== name) : [...people, name]);
  const addTyped = () => {
    const n = typed.trim();
    if (!n) return;
    if (!pool.some((p) => p.toLowerCase() === n.toLowerCase())) setPool([n, ...pool]);
    if (!people.some((p) => p.toLowerCase() === n.toLowerCase())) setPeople([...people, n]);
    setTyped('');
  };

  const lockIn = async () => {
    setSaving(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + day);
      const party = await createParty({
        title: (spaceName.trim() || autoName).slice(0, 60),
        kind: vibe.kind,
        party_date: dayText(d),
        place: spot ? spot.name : '',
        budget: 0,
        people: ['Me', ...people],
        phones,
      });
      if (spot && wantTable) {
        // 🍽️ ask the venue for a table (WhatsApp / call), then open the room
        const det = await placeDetails([spot.id]).catch(() => ({}));
        setBooking({ party: { ...party, party_members: [] }, place: { ...spot, phone: (det[spot.id] || {}).phone || null } });
        return;
      }
      onCreated(party.id, !spot); // no spot → open the room on the vote
    } catch (e) {
      Alert.alert("Couldn't create", e.message);
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <NightSky height={240} />
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={step === 2 ? () => setStep(1) : onBack} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{step === 1 ? 'PULL UP?' : 'WHERE FIRST?'}</Text>
        <Text style={styles.kicker}>STEP {step + 1} OF 3 · {step === 1 ? 'PICK YOUR PEOPLE' : 'PICK A SPOT'}</Text>

        {/* vibe + day, always editable */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {VIBES.map((v) => (
            <TouchableOpacity key={v.key} style={[styles.chip, vibe.key === v.key && styles.chipOn]} onPress={() => setVibe(v)} activeOpacity={0.85}>
              <Text style={[styles.chipText, vibe.key === v.key && { color: C.onLime }]}>{v.emoji} {v.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          {['Tonight', 'Tomorrow'].map((t, i) => (
            <TouchableOpacity key={t} style={[styles.chip, day === i && styles.chipPink]} onPress={() => setDay(i)} activeOpacity={0.85}>
              <Text style={[styles.chipText, day === i && { color: C.onLime }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {step === 1 ? (
          <>
            <Text style={styles.nameLabel}>NAME YOUR SPACE</Text>
            <TextInput style={[styles.input, { flex: 0, marginBottom: 16 }]} value={spaceName} onChangeText={setSpaceName} placeholder={autoName} placeholderTextColor={C.faint} maxLength={60} keyboardAppearance="dark" />
            <Text style={styles.lead}>Who's pulling up? Tap to add. They get the invite instantly.</Text>
            {pool.map((n) => {
              const on = people.includes(n);
              return (
                <TouchableOpacity key={n} style={styles.person} onPress={() => toggle(n)} activeOpacity={0.85}>
                  <View style={[styles.face, { backgroundColor: hue(n) }]}>
                    <Text style={styles.faceText}>{show(n).slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{show(n)}</Text>
                  <View style={[styles.inPill, on && styles.inOn]}>
                    <Text style={[styles.inText, on && { color: C.onLime }]}>{on ? 'IN ✓' : 'ADD'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {!pool.length ? <Text style={styles.muted}>No friends yet. Type a name or pick from contacts 👇</Text> : null}
            <View style={styles.addRow}>
              <TextInput style={styles.input} value={typed} onChangeText={setTyped} placeholder="Add a name" placeholderTextColor={C.faint} onSubmitEditing={addTyped} returnKeyType="done" keyboardAppearance="dark" />
              <TouchableOpacity style={styles.addBtn} onPress={addTyped}>
                <Text style={styles.addText}>＋</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setContactsOpen(true)} style={{ marginTop: 10 }}>
              <Text style={styles.link}>📇 Pick from contacts</Text>
            </TouchableOpacity>
            <ContactPicker
              visible={contactsOpen}
              already={['Me', ...people]}
              onClose={() => setContactsOpen(false)}
              onPick={(list) => {
                const fresh = list.filter((c) => !people.some((p) => p.toLowerCase() === c.name.toLowerCase()));
                setPool([...fresh.map((c) => c.name).filter((n) => !pool.includes(n)), ...pool]);
                setPeople([...people, ...fresh.map((c) => c.name)]);
                setPhones({ ...phones, ...Object.fromEntries(fresh.map((c) => [c.name, c.phone])) });
                setContactsOpen(false);
              }}
            />
            <TouchableOpacity style={[styles.cta, !people.length && styles.ctaOff]} onPress={() => (people.length ? setStep(2) : Alert.alert('Add your people', 'Pick at least one friend'))} activeOpacity={0.85}>
              <Text style={styles.ctaText}>NEXT: PICK A SPOT →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={[styles.spot, !spot && styles.spotOn]} onPress={() => setSpot(null)} activeOpacity={0.85}>
              <Text style={styles.spotEmoji}>🗳️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.spotName, !spot && { color: C.onLime }]}>Let the squad vote</Text>
                <Text style={[styles.spotMeta, !spot && { color: C.onLime }]}>Everyone suggests and votes in the room</Text>
              </View>
            </TouchableOpacity>
            {spots === null ? <ActivityIndicator color={C.lime} style={{ marginTop: 16 }} /> : null}
            {(spots || []).map((p) => {
              const on = spot && spot.id === p.id;
              return (
                <TouchableOpacity key={p.id} style={[styles.spot, on && styles.spotOn]} onPress={() => setSpot(p)} activeOpacity={0.85}>
                  <Text style={styles.spotEmoji}>{p.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.spotName, on && { color: C.onLime }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.spotMeta, on && { color: C.onLime }]} numberOfLines={1}>{[p.km != null ? showKm(p.km) : null, p.area].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {spots && !spots.length ? <Text style={styles.muted}>Couldn't find spots nearby. Let the squad vote instead.</Text> : null}
            {spot ? (
              <TouchableOpacity style={styles.tableRow} onPress={() => setWantTable(!wantTable)} activeOpacity={0.85}>
                <View style={[styles.box, wantTable && styles.boxOn]}>
                  <Text style={styles.boxTick}>{wantTable ? '✓' : ''}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableTitle}>🍽️ Request a table at {spot.name}</Text>
                  <Text style={styles.tableSub}>Pick a time, and we message them on WhatsApp for you</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.cta} onPress={lockIn} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.ctaText}>{saving ? 'Creating…' : 'LOCK IT IN 🤟'}</Text>
            </TouchableOpacity>
            <Text style={styles.foot}>{people.length + 1} people · {vibe.label} · {day ? 'tomorrow' : 'tonight'}</Text>
          </>
        )}
      </ScrollView>
      <BookTable
        visible={!!booking}
        place={booking ? booking.place : null}
        party={booking ? booking.party : null}
        guestsDefault={people.length + 1}
        onClose={() => {
          const id = booking && booking.party.id;
          setBooking(null);
          if (id) onCreated(id, false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 50 },
  back: { color: C.lime, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  title: { fontFamily: F.display, color: C.text, fontSize: 40 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, marginTop: 4, marginBottom: 14 },
  nameLabel: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginBottom: 8 },
  lead: { color: C.sub, fontSize: 15, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipPink: { backgroundColor: C.pink, borderColor: C.pink },
  chipText: { color: C.text, fontSize: 14, fontWeight: '800' },
  person: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  face: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  faceText: { fontFamily: F.bold, color: C.onLime, fontSize: 14 },
  name: { flex: 1, color: C.text, fontSize: 16, fontWeight: '800' },
  inPill: { borderWidth: 2, borderColor: C.lime, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 12 },
  inOn: { backgroundColor: C.lime },
  inText: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  muted: { color: C.sub, fontSize: 14, marginVertical: 10 },
  addRow: { flexDirection: 'row', marginTop: 8 },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  addBtn: { width: 48, marginLeft: 8, borderRadius: 14, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  addText: { color: C.onLime, fontSize: 22, fontWeight: '900' },
  link: { color: C.lime, fontSize: 15, fontWeight: '700' },
  cta: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 17, alignItems: 'center', marginTop: 20, ...STICK },
  ctaOff: { opacity: 0.5 },
  ctaText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  spot: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  spotOn: { backgroundColor: C.lime, borderColor: C.lime },
  spotEmoji: { fontSize: 26, marginRight: 12 },
  spotName: { color: C.text, fontSize: 16, fontWeight: '800' },
  spotMeta: { color: C.sub, fontSize: 13, marginTop: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 14, marginTop: 8, borderWidth: 1, borderColor: C.lime },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.lime, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  boxOn: { backgroundColor: C.lime },
  boxTick: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  tableTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  tableSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  foot: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 10 },
});
