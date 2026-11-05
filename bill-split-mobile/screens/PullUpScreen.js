import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { recentFriends } from '../services/bills';
import { myFriends } from '../services/friends';
import { show } from '../services/names';
import { createParty } from '../services/parties';
import { findPlaces, getMyLocation, placeDetails, showKm } from '../services/places';
import { C, F, STICK } from '../services/theme';
import { eventsNear, eventWhen } from '../services/events';
import { Image, Linking } from 'react-native';
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
// 🌙 Plan a Night: discover first. Places (by type) and Events (DJ nights, live music, concerts) are separate.
export const PLACE_CATS = [
  { key: 'restaurants', label: 'Restaurants', emoji: '🍽️', kind: 'party', cat: 'food', table: true },
  { key: 'cafes', label: 'Cafés', emoji: '☕', kind: 'hangout', cat: 'cafes', table: true },
  { key: 'pubs', label: 'Pubs', emoji: '🍺', kind: 'nightout', cat: 'pubs', table: true },
  { key: 'clubs', label: 'Clubs', emoji: '🪩', kind: 'party', cat: 'bars', table: false },
  { key: 'movies', label: 'Movies', emoji: '🎬', kind: 'movie', cat: 'cinema', table: false },
];
const EVENT_WHEN = [
  ['tonight', 'Tonight'],
  ['weekend', 'This weekend'],
  ['upcoming', 'Upcoming'],
];
const eventFits = (e, w, now = new Date()) => {
  const d = new Date(e.start_at);
  if (w === 'tonight') return d.toDateString() === now.toDateString();
  if (w === 'weekend') {
    const days = (d - now) / 864e5;
    return days < 7 && [5, 6, 0].includes(d.getDay());
  }
  return true;
};
const HUES = [C.lime, C.pink, C.violet, C.cyan, '#FFD84D', '#7CFFB2', '#FF8A3D', '#FFB3D9'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];
const dayText = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function PullUpScreen({ initialVibe = 'restaurants', onBack, onCreated }) {
  const [vibe, setVibe] = useState(PLACE_CATS.find((v) => v.key === initialVibe) || VIBES.find((v) => v.key === initialVibe) || PLACE_CATS[0]);
  const [step, setStep] = useState(0); // 0 discover · 1 people · 2 lock it in
  const [mode, setMode] = useState('places'); // places · events
  const [found, setFound] = useState(null); // places for the picked type
  const [events, setEvents] = useState(null);
  const [when, setWhen] = useState('upcoming');
  const [picked, setPicked] = useState(null); // { place } or { event } chosen in discover
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

  // 🧭 discover: places of the picked type, and big events
  useEffect(() => {
    if (step !== 0 || mode !== 'places') return;
    setFound(null);
    getMyLocation({ ask: true })
      .then((loc) => findPlaces(loc.coords, '', vibe.cat))
      .then((list) => setFound((list || []).slice(0, 12)))
      .catch(() => setFound([]));
  }, [step, mode, vibe.key]);
  useEffect(() => {
    if (mode !== 'events' || events) return;
    eventsNear().then((l) => setEvents((l || []).filter((e) => e.status !== 'cancelled'))).catch(() => setEvents([]));
  }, [mode]);
  const pickPlace = (p) => { setPicked({ place: p }); setSpot(p); setStep(1); };
  const pickEvent = (e) => {
    setPicked({ event: e });
    setSpot({ id: `ev-${e.id}`, name: e.venue_name });
    if (!spaceName) setSpaceName(e.title.slice(0, 60));
    const d = new Date(e.start_at);
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(new Date().toDateString())) / 864e5);
    setDay(Math.max(0, diff));
    setStep(1);
  };
  const vote = () => { setPicked(null); setSpot(null); setStep(1); };
  const [standalone, setStandalone] = useState(null); // 🍽️ Book table straight from discover

  useEffect(() => {
    if (step !== 2 || picked) return;
    setSpots(null);
    getMyLocation({ ask: true })
      .then((loc) => findPlaces(loc.coords, '', vibe.cat))
      .then((list) => setSpots((list || []).slice(0, 8)))
      .catch(() => setSpots([]));
  }, [step, vibe.key]);

  const dayWord = day === 0 ? 'tonight' : day === 1 ? 'tomorrow' : 'soon';
  const autoName = `${vibe.label} ${dayWord} ${vibe.emoji}`;
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
        eventId: picked && picked.event ? picked.event.id : null,
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
        <TouchableOpacity onPress={step > 0 ? () => setStep(step - 1) : onBack} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{step === 0 ? 'PLAN A\nNIGHT' : step === 1 ? 'WHO’S IN?' : picked ? 'LOCK IT IN' : 'WHERE FIRST?'}</Text>
        <Text style={styles.kicker}>STEP {step + 1} OF 3 · {step === 0 ? 'FIND THE SPOT' : step === 1 ? 'PICK YOUR PEOPLE' : picked ? 'CHECK AND GO' : 'PICK A SPOT'}</Text>

        {step === 0 ? (
          <>
            <View style={styles.seg}>
              {[['places', '📍 Places'], ['events', '🎉 Events']].map(([k, label]) => (
                <TouchableOpacity key={k} style={[styles.segBtn, mode === k && styles.segOn]} onPress={() => setMode(k)} activeOpacity={0.85}>
                  <Text style={[styles.segText, mode === k && { color: C.onLime }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {(mode === 'places' ? PLACE_CATS.map((v) => [v.key, `${v.emoji} ${v.label}`, vibe.key === v.key, () => setVibe(v)]) : EVENT_WHEN.map(([k, l]) => [k, l, when === k, () => setWhen(k)])).map(([k, label, on, go]) => (
                <TouchableOpacity key={k} style={[styles.chip, on && styles.chipOn]} onPress={go} activeOpacity={0.85}>
                  <Text style={[styles.chipText, on && { color: C.onLime }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {mode === 'places' ? (
              <>
                {found === null ? <ActivityIndicator color={C.lime} style={{ marginTop: 16 }} /> : null}
                {(found || []).map((p) => (
                  <View key={p.id} style={styles.placeCard}>
                    <View style={styles.placeTop}>
                      <Text style={styles.placeEmoji}>{p.emoji || vibe.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.placeName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.placeMeta} numberOfLines={1}>{[p.km != null ? showKm(p.km) : null, p.area].filter(Boolean).join(' · ')}</Text>
                      </View>
                    </View>
                    <View style={styles.placeBtns}>
                      <TouchableOpacity style={styles.planBtn} onPress={() => pickPlace(p)} activeOpacity={0.85}>
                        <Text style={styles.planBtnText}>Plan here →</Text>
                      </TouchableOpacity>
                      {vibe.table ? (
                        <TouchableOpacity style={styles.bookBtn} onPress={async () => { const det = await placeDetails([p.id]).catch(() => ({})); setStandalone({ ...p, phone: (det[p.id] || {}).phone || null }); }} activeOpacity={0.85}>
                          <Text style={styles.bookBtnText}>🍽️ Book table</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
                {found && !found.length ? <Text style={styles.muted}>Nothing found nearby for {vibe.label.toLowerCase()}. Try another type, or let the squad vote.</Text> : null}
              </>
            ) : (
              <>
                {events === null ? <ActivityIndicator color={C.lime} style={{ marginTop: 16 }} /> : null}
                {(events || []).filter((e) => eventFits(e, when)).map((e) => (
                  <View key={e.id} style={styles.eventCard}>
                    {e.poster_url ? <Image source={{ uri: e.poster_url }} style={styles.eventPoster} resizeMode="cover" /> : <View style={[styles.eventPoster, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 40 }}>🎉</Text></View>}
                    <View style={{ padding: 14 }}>
                      <Text style={styles.eventWhen}>{eventWhen(e).toUpperCase()}{e.status === 'sold_out' ? ' · SOLD OUT' : ''}</Text>
                      <Text style={styles.eventTitle} numberOfLines={2}>{e.title}</Text>
                      <Text style={styles.placeMeta} numberOfLines={1}>{e.venue_name}{e.price_from != null ? ` · ${Number(e.price_from) === 0 ? 'Free' : `from ₹${Math.round(e.price_from).toLocaleString('en-IN')}`}` : ''}</Text>
                      <View style={styles.placeBtns}>
                        <TouchableOpacity style={styles.planBtn} onPress={() => pickEvent(e)} activeOpacity={0.85}>
                          <Text style={styles.planBtnText}>Plan with squad →</Text>
                        </TouchableOpacity>
                        {e.booking_url && e.status !== 'sold_out' ? (
                          <TouchableOpacity style={styles.bookBtn} onPress={() => Linking.openURL(e.booking_url).catch(() => {})} activeOpacity={0.85}>
                            <Text style={styles.bookBtnText}>🎟️ Tickets</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
                {events && !events.filter((e) => eventFits(e, when)).length ? <Text style={styles.muted}>No events {when === 'tonight' ? 'tonight' : when === 'weekend' ? 'this weekend' : 'coming up'} near you yet. Check Upcoming, or plan a place.</Text> : null}
              </>
            )}

            <TouchableOpacity style={[styles.spot, { marginTop: 8 }]} onPress={vote} activeOpacity={0.85}>
              <Text style={styles.spotEmoji}>🗳️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.spotName}>Not sure yet? Let the squad vote</Text>
                <Text style={styles.spotMeta}>Pick your people, everyone suggests and votes in the Space</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 1 ? (
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          {['Tonight', 'Tomorrow'].map((t, i) => (
            <TouchableOpacity key={t} style={[styles.chip, day === i && styles.chipPink]} onPress={() => setDay(i)} activeOpacity={0.85}>
              <Text style={[styles.chipText, day === i && { color: C.onLime }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        ) : null}

        {step === 1 ? (
          <>
            {picked ? (
              <View style={styles.pickedBox}>
                <Text style={styles.pickedText} numberOfLines={1}>{picked.event ? `🎉 ${picked.event.title} · ${eventWhen(picked.event)}` : `${vibe.emoji} ${picked.place.name}`}</Text>
              </View>
            ) : null}
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
              <Text style={styles.ctaText}>{picked ? 'NEXT: LOCK IT IN →' : 'NEXT: PICK A SPOT →'}</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {step === 2 ? (
          <>
            {picked ? (
              <View style={[styles.spot, styles.spotOn]}>
                <Text style={styles.spotEmoji}>{picked.event ? '🎉' : vibe.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.spotName, { color: C.onLime }]} numberOfLines={1}>{picked.event ? picked.event.title : picked.place.name}</Text>
                  <Text style={[styles.spotMeta, { color: C.onLime }]} numberOfLines={1}>{picked.event ? `${picked.event.venue_name} · ${eventWhen(picked.event)}` : [picked.place.km != null ? showKm(picked.place.km) : null, picked.place.area].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
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
            </>
            )}
            {spot && !(picked && picked.event) && vibe.table !== false ? (
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
            <Text style={styles.foot}>{people.length + 1} people · {picked && picked.event ? 'event' : vibe.label} · {dayWord}</Text>
          </>
        ) : null}
      </ScrollView>
      {/* 🍽️ Book table straight from discover: its own Space is made (or joined) for the booking */}
      <BookTable
        visible={!!standalone}
        place={standalone}
        party={null}
        guestsDefault={2}
        onBooked={(b) => { if (b && b.party_id) setStandalone({ ...standalone, spaceId: b.party_id }); }}
        onClose={() => {
          const id = standalone && standalone.spaceId;
          setStandalone(null);
          if (id) onCreated(id, false);
        }}
      />
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
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  segBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  segOn: { backgroundColor: C.lime },
  segText: { color: C.sub, fontSize: 15, fontWeight: '900' },
  placeCard: { backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  placeTop: { flexDirection: 'row', alignItems: 'center' },
  placeEmoji: { fontSize: 30, marginRight: 12 },
  placeName: { fontFamily: F.bold, color: C.text, fontSize: 16 },
  placeMeta: { color: C.sub, fontSize: 13, marginTop: 2 },
  placeBtns: { flexDirection: 'row', marginTop: 12 },
  planBtn: { flex: 1, backgroundColor: C.lime, borderRadius: 14, paddingVertical: 11, alignItems: 'center', marginRight: 8 },
  planBtnText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  bookBtn: { flex: 1, borderWidth: 2, borderColor: C.cyan, borderRadius: 14, paddingVertical: 9, alignItems: 'center' },
  bookBtnText: { color: C.cyan, fontSize: 14, fontWeight: '900' },
  eventCard: { backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12, borderWidth: 2, borderColor: C.violet },
  eventPoster: { width: '100%', height: 150, backgroundColor: '#2A1B5E' },
  eventWhen: { fontFamily: F.pixel, color: C.lime, fontSize: 10 },
  eventTitle: { fontFamily: F.display, color: C.text, fontSize: 20, marginTop: 4 },
  pickedBox: { backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 },
  pickedText: { color: C.text, fontSize: 14, fontWeight: '800' },
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
