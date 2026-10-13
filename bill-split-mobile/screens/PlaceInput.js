import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DONE_ID } from './KeyboardDone';
import { CATEGORIES, findPlaces, getMyLocation, knownPlaces, openPhoneSettings, showKm } from '../services/places';
import { C } from '../services/theme';

// "Where" box: shows places near you straight away, and searches as you type.
export default function PlaceInput({ value, onChange, onFocus }) {
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState(null); // { status, coords }
  const [category, setCategory] = useState('all');
  const [results, setResults] = useState([]);
  const [known, setKnown] = useState([]); // places with a menu on Vibe Out
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(8); // how many places are shown; "Show more" adds 10
  const timer = useRef(null);

  // First time the box is used: ask for location
  useEffect(() => {
    if (open && !loc) getMyLocation().then(setLoc);
  }, [open, loc]);

  // Empty box → places nearby. Typing → search (0.4s after typing stops).
  useEffect(() => {
    if (!open || !loc) return;
    clearTimeout(timer.current);
    const q = (value || '').trim();
    timer.current = setTimeout(async () => {
      setLimit(8);
      setLoading(true);
      setError('');
      try {
        const [map, ours] = await Promise.all([
          findPlaces(loc.coords, q.length >= 2 ? q : '', category),
          category === 'all' || category === 'bars' || category === 'food' ? knownPlaces(q.length >= 2 ? q : '') : Promise.resolve([]),
        ]);
        setKnown(ours);
        setResults(map);
      } catch (e) {
        setResults([]);
        setError("Couldn't load places right now. Try again in a moment, or just type the name.");
      } finally {
        setLoading(false);
      }
    }, q.length >= 2 ? 400 : 0);
    return () => clearTimeout(timer.current);
  }, [value, category, open, loc]);

  // Ask again (or open Settings if location was blocked / turned off)
  const fixLocation = async () => {
    if (loc && (loc.status === 'blocked' || loc.status === 'off')) return openPhoneSettings();
    setLoc(null);
    setLoc(await getMyLocation({ ask: true }));
  };

  const pick = (r) => {
    onChange(r.area ? `${r.name}, ${r.area.split(', ').slice(-1)[0]}` : r.name);
    setOpen(false);
  };

  const typing = (value || '').trim().length >= 2;
  const usingRealLocation = loc && loc.status === 'granted';

  return (
    <View>
      <TextInput
        inputAccessoryViewID={DONE_ID}
        style={styles.input}
        value={value}
        onChangeText={(t) => {
          onChange(t);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (onFocus) onFocus();
        }}
        placeholder="📍 Search or pick a place nearby"
        placeholderTextColor={C.faint}
        keyboardAppearance="dark"
      />

      {open && (
        <View style={styles.panel}>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c.key} style={[styles.chip, category === c.key && styles.chipOn]} onPress={() => setCategory(c.key)}>
                <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!loc ? (
            <Text style={styles.where}>Finding your location…</Text>
          ) : usingRealLocation ? (
            <Text style={styles.where}>{typing ? '🔎 Closest matches first' : '📍 Near you'}</Text>
          ) : (
            <TouchableOpacity style={styles.locBox} onPress={fixLocation}>
              <Text style={styles.locTitle}>
                {loc.status === 'off' ? '📍 Location is off on your phone' : '📍 Turn on location for places near you'}
              </Text>
              <Text style={styles.locSub}>
                {loc.status === 'blocked' || loc.status === 'off'
                  ? 'Tap to open Settings and allow location. Showing Palakkad for now.'
                  : 'Tap to allow. Showing Palakkad for now.'}
              </Text>
            </TouchableOpacity>
          )}

          {loading && <ActivityIndicator color={C.accentSoft} style={styles.loading} />}
          {!!error && <Text style={styles.none}>{error}</Text>}

          {!loading && known.length > 0 && (
            <>
              <Text style={styles.section}>🔥 On Vibe Out · has a menu</Text>
              {known.map((k) => (
                <TouchableOpacity key={'k' + k.name} style={styles.row} onPress={() => pick({ name: k.name, area: '' })}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>⭐ {k.name}</Text>
                    <Text style={styles.menuTag}>{k.items} dishes</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.section}>🗺️ On the map</Text>
            </>
          )}

          {!loading && results.slice(0, limit).map((r) => (
            <TouchableOpacity key={r.id} style={styles.row} onPress={() => pick(r)}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{r.emoji} {r.name}</Text>
                {r.km != null && <Text style={styles.km}>{showKm(r.km)}</Text>}
              </View>
              {r.area ? <Text style={styles.area} numberOfLines={1}>{r.area}</Text> : null}
            </TouchableOpacity>
          ))}

          {!loading && results.length > limit && (
            <TouchableOpacity style={styles.more} onPress={() => setLimit(limit + 10)}>
              <Text style={styles.moreText}>Show more ({results.length - limit} more) ⌄</Text>
            </TouchableOpacity>
          )}

          {!loading && !error && loc && results.length === 0 && known.length === 0 && (
            <Text style={styles.none}>Nothing found nearby. You can just type the place name 👍</Text>
          )}

          <TouchableOpacity onPress={() => setOpen(false)}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, fontSize: 16, color: C.text, marginBottom: 10 },
  panel: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 10, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  where: { color: C.faint, fontSize: 12, marginBottom: 6 },
  locBox: { backgroundColor: C.amberBg, borderRadius: 10, padding: 10, marginBottom: 8 },
  locTitle: { color: C.amber, fontSize: 14, fontWeight: '800' },
  locSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  loading: { marginVertical: 10 },
  row: { paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: C.border },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: C.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  km: { color: C.accentSoft, fontSize: 13, fontWeight: '700' },
  area: { color: C.faint, fontSize: 12, marginTop: 2 },
  none: { color: C.faint, fontSize: 13, paddingVertical: 8 },
  section: { color: C.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 8, marginBottom: 2 },
  menuTag: { color: C.pink, fontSize: 12, fontWeight: '700' },
  more: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10, alignItems: 'center' },
  moreText: { color: C.accentSoft, fontSize: 14, fontWeight: '800' },
  close: { color: C.accentSoft, fontSize: 14, fontWeight: '700', textAlign: 'center', paddingTop: 8 },
});
