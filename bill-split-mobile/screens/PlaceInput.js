import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// Free place search from OpenStreetMap (Photon). No API key, no bill.
// For now we search around Palakkad town; later we can use the phone's location.
const CENTER = { lat: 10.7867, lon: 76.6548 }; // Palakkad

const FILTERS = [
  { key: 'all', label: 'All', tags: ['amenity:restaurant', 'amenity:bar', 'amenity:pub', 'amenity:cafe', 'amenity:fast_food', 'amenity:food_court', 'tourism:hotel'] },
  { key: 'food', label: '🍽️ Food', tags: ['amenity:restaurant', 'amenity:fast_food', 'amenity:food_court'] },
  { key: 'bars', label: '🍻 Bars', tags: ['amenity:bar', 'amenity:pub'] },
  { key: 'cafes', label: '☕ Cafés', tags: ['amenity:cafe'] },
  { key: 'hotels', label: '🏨 Hotels', tags: ['tourism:hotel'] },
];

const EMOJI = { restaurant: '🍽️', fast_food: '🍔', food_court: '🍽️', bar: '🍻', pub: '🍺', cafe: '☕', hotel: '🏨' };

export default function PlaceInput({ value, onChange }) {
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  // Search 0.4s after the person stops typing
  useEffect(() => {
    clearTimeout(timer.current);
    const q = (value || '').trim();
    if (!open || q.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const tags = FILTERS.find((f) => f.key === filter).tags.map((t) => `&osm_tag=${encodeURIComponent(t)}`).join('');
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${CENTER.lat}&lon=${CENTER.lon}&limit=8&lang=en${tags}`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(
          (data.features || []).map((f) => {
            const p = f.properties || {};
            return {
              id: `${p.osm_type}${p.osm_id}`,
              name: p.name,
              emoji: EMOJI[p.osm_value] || '📍',
              area: [p.street, p.district || p.locality, p.city || p.county].filter(Boolean).join(', '),
            };
          }).filter((r) => r.name)
        );
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [value, filter, open]);

  const pick = (r) => {
    onChange(r.area ? `${r.name}, ${r.area.split(', ').slice(-1)[0]}` : r.name);
    setOpen(false);
    setResults([]);
  };

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
        placeholder="Search a restaurant, bar or café"
        placeholderTextColor={C.faint}
        keyboardAppearance="dark"
      />

      {open && (
        <>
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipOn]} onPress={() => setFilter(f.key)}>
                <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && <ActivityIndicator color={C.accentSoft} style={styles.loading} />}

          {results.length > 0 && (
            <View style={styles.list}>
              {results.map((r) => (
                <TouchableOpacity key={r.id} style={styles.row} onPress={() => pick(r)}>
                  <Text style={styles.name}>{r.emoji} {r.name}</Text>
                  {r.area ? <Text style={styles.area}>{r.area}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!loading && (value || '').trim().length >= 2 && results.length === 0 && (
            <Text style={styles.none}>No matches nearby. You can just type the place name 👍</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, fontSize: 16, color: C.text, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  loading: { marginVertical: 8 },
  list: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 14, overflow: 'hidden' },
  row: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  name: { color: C.text, fontSize: 15, fontWeight: '700' },
  area: { color: C.faint, fontSize: 12, marginTop: 2 },
  none: { color: C.faint, fontSize: 13, marginBottom: 14 },
});
