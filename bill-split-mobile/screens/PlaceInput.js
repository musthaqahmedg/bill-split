import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORIES, getMyLocation, nearbyPlaces, searchPlaces, showKm } from '../services/places';
import { C } from '../services/theme';

// "Where" box: shows places near you straight away, and searches as you type.
export default function PlaceInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState(null); // your location (or Palakkad if location is off)
  const [category, setCategory] = useState('all');
  const [openNow, setOpenNow] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  // First time the box is used: ask for location
  useEffect(() => {
    if (open && !me) getMyLocation().then(setMe);
  }, [open, me]);

  // Empty box → places nearby. Typing → search (0.4s after typing stops).
  useEffect(() => {
    if (!open || !me) return;
    clearTimeout(timer.current);
    const q = (value || '').trim();
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        setResults(q.length >= 2 ? await searchPlaces(q, me, category) : await nearbyPlaces(me, category));
      } catch (e) {
        setResults([]);
        setError("Couldn't load places. Check your internet and try again.");
      } finally {
        setLoading(false);
      }
    }, q.length >= 2 ? 400 : 0);
    return () => clearTimeout(timer.current);
  }, [value, category, open, me]);

  const pick = (r) => {
    onChange(r.area ? `${r.name}, ${r.area.split(', ').slice(-1)[0]}` : r.name);
    setOpen(false);
  };

  const typing = (value || '').trim().length >= 2;
  const shown = (openNow ? results.filter((r) => r.open === true) : results).slice(0, 15);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => {
          onChange(t);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
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
            {!typing && (
              <TouchableOpacity style={[styles.chip, openNow && styles.chipGreen]} onPress={() => setOpenNow(!openNow)}>
                <Text style={[styles.chipText, openNow && styles.chipTextOn]}>🟢 Open now</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.where}>
            {!me ? 'Finding your location…' : me.fallback ? '📍 Showing places in Palakkad (location is off)' : typing ? '🔎 Closest matches first' : '📍 Near you'}
          </Text>

          {loading && <ActivityIndicator color={C.accentSoft} style={styles.loading} />}
          {!!error && <Text style={styles.none}>{error}</Text>}

          {!loading && shown.map((r) => (
            <TouchableOpacity key={r.id} style={styles.row} onPress={() => pick(r)}>
              <View style={styles.rowTop}>
                <Text style={styles.name} numberOfLines={1}>{r.emoji} {r.name}</Text>
                {r.km != null && <Text style={styles.km}>{showKm(r.km)}</Text>}
              </View>
              <View style={styles.rowTop}>
                <Text style={styles.area} numberOfLines={1}>{r.area || ' '}</Text>
                {r.open === true && <Text style={styles.openTag}>Open now</Text>}
                {r.open === false && <Text style={styles.closedTag}>Closed</Text>}
              </View>
            </TouchableOpacity>
          ))}

          {!loading && !error && me && shown.length === 0 && (
            <Text style={styles.none}>
              {openNow ? 'No places with "open now" info nearby. Turn off the filter to see all.' : 'Nothing found. You can just type the place name 👍'}
            </Text>
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
  chipGreen: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  where: { color: C.faint, fontSize: 12, marginBottom: 6 },
  loading: { marginVertical: 10 },
  row: { paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: C.border },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: C.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  km: { color: C.accentSoft, fontSize: 13, fontWeight: '700' },
  area: { color: C.faint, fontSize: 12, marginTop: 2, flex: 1, marginRight: 8 },
  openTag: { color: C.green, fontSize: 12, fontWeight: '700' },
  closedTag: { color: C.red, fontSize: 12, fontWeight: '700' },
  none: { color: C.faint, fontSize: 13, paddingVertical: 8 },
  close: { color: C.accentSoft, fontSize: 14, fontWeight: '700', textAlign: 'center', paddingTop: 8 },
});
