import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import BookTable from './BookTable';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import {
  EMOJI, NEARBY, directionsUrl, findPlaces, getMyLocation, listSaved, openPhoneSettings, openStatus, placeDetails,
  savePlace, showKm, unsavePlace,
} from '../services/places';
import { C } from '../services/theme';

const AGE_KEY = 'vibeout.ageOk';

// 📍 Nearby: restobars, pubs, cafés, restaurants, supermarkets, beverage shops, pan shops
export default function NearbyScreen({ onBack, initialCategory = 'restobars', title, bookFor, onBooked }) {
  const [category, setCategory] = useState(initialCategory);
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState(null);
  const [places, setPlaces] = useState([]);
  const [details, setDetails] = useState({});
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(null); // null | 'open' | 'late'
  const [ageOk, setAgeOk] = useState(false);
  const timer = useRef(null);
  const [booking, setBooking] = useState(null); // place we're booking a table at
  const going = bookFor ? (bookFor.party_members || []).filter((m) => m.rsvp !== 'out').length : 2;

  useEffect(() => {
    getMyLocation().then(setLoc);
    listSaved().then(setSaved).catch(() => {});
    AsyncStorage.getItem(AGE_KEY).then((v) => setAgeOk(v === 'yes')).catch(() => {});
  }, []);

  const cat = NEARBY.find((c) => c.key === category);
  const blocked = cat && cat.adult && !ageOk;

  // Load places for the chosen chip (0.4s after typing stops)
  useEffect(() => {
    if (!loc || category === 'saved' || blocked) return;
    clearTimeout(timer.current);
    const text = q.trim();
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const list = await findPlaces(loc.coords, text.length >= 2 ? text : '', category);
        setPlaces(list);
        // Phone + hours, 40 at a time
        const ids = list.map((p) => p.id);
        const parts = await Promise.all([placeDetails(ids.slice(0, 40)), ids.length > 40 ? placeDetails(ids.slice(40, 80)) : {}]);
        setDetails((d) => ({ ...d, ...parts[0], ...parts[1] }));
      } catch (e) {
        setPlaces([]);
        setError("Couldn't load places right now. Pull down or try again in a moment.");
      } finally {
        setLoading(false);
      }
    }, text.length >= 2 ? 400 : 0);
    return () => clearTimeout(timer.current);
  }, [loc, category, q, blocked]);

  const choose = (key) => {
    const c = NEARBY.find((x) => x.key === key);
    if (c && c.adult && !ageOk) {
      return Alert.alert(
        'Age check 🔞',
        "Are you of legal drinking age where you live? (In Kerala it's 23+)",
        [
          { text: 'No', style: 'cancel' },
          {
            text: "Yes, I'm of age",
            onPress: () => {
              setAgeOk(true);
              AsyncStorage.setItem(AGE_KEY, 'yes').catch(() => {});
              setCategory(key);
            },
          },
        ]
      );
    }
    setCategory(key);
  };

  const toggleSave = async (p) => {
    const isSaved = saved.some((s) => s.id === p.id);
    try {
      if (isSaved) {
        await unsavePlace(p.id);
        setSaved((list) => list.filter((s) => s.id !== p.id));
      } else {
        await savePlace(p, category);
        setSaved((list) => [{ ...p, place_id: p.id }, ...list]);
      }
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };

  const fixLocation = async () => {
    if (loc && (loc.status === 'blocked' || loc.status === 'off')) return openPhoneSettings();
    setLoc(await getMyLocation({ ask: true }));
  };

  // What to show
  let shown = category === 'saved' ? saved : places;
  if (category === 'saved' && loc) {
    shown = shown.map((p) => ({ ...p, km: p.km != null ? p.km : distance(loc.coords, p) }));
  }
  if (filter) {
    shown = shown.filter((p) => {
      const st = openStatus((details[p.id] || {}).hours);
      return st && (filter === 'open' ? st.open : st.open && st.late);
    });
  }

  const renderPlace = ({ item: p }) => {
    const d = details[p.id] || {};
    const st = openStatus(d.hours);
    const isSaved = saved.some((s) => s.id === p.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.name} numberOfLines={2}>{p.emoji || EMOJI[p.kind] || '📍'} {p.name}</Text>
          {p.km != null && <Text style={styles.km}>{showKm(p.km)}</Text>}
        </View>
        {p.area ? <Text style={styles.area} numberOfLines={1}>{p.area}</Text> : null}
        {st ? (
          <Text style={[styles.status, st.soon ? styles.soon : st.open ? styles.open : styles.closed]}>
            {st.soon ? '🟠' : st.open ? '🟢' : '🔴'} {st.label}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(directionsUrl(p))}>
            <Text style={styles.btnText}>🧭 Directions</Text>
          </TouchableOpacity>
          {d.phone ? (
            <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(`tel:${d.phone.split(';')[0].replace(/[^\d+]/g, '')}`)}>
              <Text style={styles.btnText}>📞 Call</Text>
            </TouchableOpacity>
          ) : null}
          {['restobars', 'pubs', 'cafes', 'food', 'saved'].includes(category) ? (
            <TouchableOpacity style={[styles.btn, styles.bookBtn]} onPress={() => setBooking({ ...p, phone: d.phone || null })}>
              <Text style={[styles.btnText, styles.bookText]}>🍽️ Book</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.btn, isSaved && styles.btnOn]} onPress={() => toggleSave(p)}>
            <Text style={[styles.btnText, isSaved && styles.btnTextOn]}>{isSaved ? '⭐ Saved' : '☆ Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title || '📍 Nearby'}</Text>

      <FlatList
        data={blocked ? [] : shown}
        keyExtractor={(p) => p.id}
        renderItem={renderPlace}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[...NEARBY, { key: 'saved', label: `⭐ Saved${saved.length ? ` (${saved.length})` : ''}` }]}
              keyExtractor={(c) => c.key}
              style={styles.chips}
              renderItem={({ item: c }) => (
                <TouchableOpacity style={[styles.chip, category === c.key && styles.chipOn]} onPress={() => choose(c.key)}>
                  <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.label}</Text>
                </TouchableOpacity>
              )}
            />
            {category !== 'saved' && (
              <TextInput
                inputAccessoryViewID={DONE_ID}
                style={styles.search}
                value={q}
                onChangeText={setQ}
                placeholder={`🔍 Search ${cat ? cat.label.replace(/^\S+\s/, '').toLowerCase() : 'places'}`}
                placeholderTextColor={C.faint}
                keyboardAppearance="dark"
                returnKeyType="search"
              />
            )}
            <View style={styles.filters}>
              {[['open', '🟢 Open now'], ['late', '🌙 Open late']].map(([k, label]) => (
                <TouchableOpacity key={k} style={[styles.filter, filter === k && styles.chipOn]} onPress={() => setFilter(filter === k ? null : k)}>
                  <Text style={[styles.chipText, filter === k && styles.chipTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {filter ? <Text style={styles.note}>Only places that list their hours on the map show here.</Text> : null}
            {category === 'beverages' && !blocked ? (
              <Text style={styles.note}>🗓️ Beverage shops close on dry days and have fixed hours. Check before you go.</Text>
            ) : null}
            {loc && loc.status !== 'granted' ? (
              <TouchableOpacity style={styles.locBox} onPress={fixLocation}>
                <Text style={styles.locTitle}>📍 Turn on location for places near you</Text>
                <Text style={styles.locSub}>Showing Palakkad for now. Tap to fix.</Text>
              </TouchableOpacity>
            ) : null}
            {(loading || !loc) && category !== 'saved' ? <ActivityIndicator color={C.accentSoft} style={styles.loading} /> : null}
            {!!error && <Text style={styles.note}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          blocked ? (
            <Text style={styles.empty}>🔞 This list is only for people of legal drinking age.</Text>
          ) : loading || !loc ? null : (
            <Text style={styles.empty}>
              {category === 'saved'
                ? 'No saved places yet. Tap ☆ Save on any place.'
                : filter
                ? 'No places with hours found. Try without the filter.'
                : 'Nothing found nearby. Try searching by name.'}
            </Text>
          )
        }
        contentContainerStyle={styles.listPad}
      />
      <KeyboardDone />
      <BookTable
        visible={!!booking}
        onClose={() => setBooking(null)}
        place={booking}
        party={bookFor}
        guestsDefault={going}
        onBooked={() => onBooked && onBooked()}
      />
    </KeyboardAvoidingView>
  );
}

function distance(a, b) {
  const R = 6371;
  const r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontSize: 30, fontWeight: '800', color: C.text, marginBottom: 12 },
  chips: { marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.sub, fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  search: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text, marginBottom: 10 },
  filters: { flexDirection: 'row', marginBottom: 6 },
  filter: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 11, marginRight: 8 },
  note: { color: C.faint, fontSize: 12, marginBottom: 8 },
  locBox: { backgroundColor: C.amberBg, borderRadius: 10, padding: 10, marginBottom: 8 },
  locTitle: { color: C.amber, fontSize: 14, fontWeight: '800' },
  locSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  loading: { marginVertical: 16 },
  listPad: { paddingBottom: 40 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { color: C.text, fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
  km: { color: C.accentSoft, fontSize: 13, fontWeight: '800' },
  area: { color: C.faint, fontSize: 12, marginTop: 3 },
  status: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  open: { color: C.green },
  soon: { color: C.amber },
  closed: { color: C.pink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  btn: { borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11, marginRight: 6, marginBottom: 4 },
  bookBtn: { backgroundColor: C.accent, borderColor: C.accent },
  bookText: { color: '#fff' },
  btnOn: { backgroundColor: C.amberBg, borderColor: C.amber },
  btnText: { color: C.text, fontSize: 13, fontWeight: '700' },
  btnTextOn: { color: C.amber },
  empty: { color: C.faint, fontSize: 14, textAlign: 'center', marginTop: 30 },
});
