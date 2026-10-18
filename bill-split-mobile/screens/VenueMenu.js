import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getVenueMenu, placeName, scanMenu } from '../services/menus';
import { C } from '../services/theme';

const inr = (n) => (n ? '₹' + Math.round(Number(n)).toLocaleString('en-IN') : '');

// 🍽️ Menu at the restaurant / bar: real items and prices, built from everyone's scans and bills
export default function VenueMenu({ place }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('drinks');
  const [busy, setBusy] = useState(false);
  const name = placeName(place);

  const load = useCallback(() => getVenueMenu(name).then(setItems).catch(() => setItems([])), [name]);
  useEffect(() => {
    load();
  }, [load]);

  const scan = () =>
    Alert.alert(`Scan the menu at ${name} 📸`, 'Snap one page at a time. Everyone planning here will see it.', [
      { text: '📷 Take a photo', onPress: () => run(true) },
      { text: '🖼️ From gallery', onPress: () => run(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const run = async (camera) => {
    setBusy(true);
    try {
      const n = await scanMenu(place, camera);
      if (n) {
        Alert.alert(`Added ${n} items ✅`, 'Thanks! Scan another page if there is one.');
        load();
      }
    } catch (e) {
      Alert.alert("Couldn't read the menu", e.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = (items || []).filter((i) =>
    filter === 'all' ? true : filter === 'drinks' ? i.kind === 'alcohol' || i.kind === 'soft' : i.kind === 'food'
  );
  const groups = {};
  for (const i of shown) {
    const g = i.category || (i.kind === 'alcohol' ? 'Drinks' : i.kind === 'soft' ? 'Soft drinks & mocktails' : 'Food');
    (groups[g] = groups[g] || []).push(i);
  }
  const scanned = (items || []).some((i) => i.source !== 'bills');

  return (
    <View style={styles.flex}>
      <Text style={styles.place}>📍 {name}</Text>
      <View style={styles.chips}>
        {[['drinks', '🍸 Drinks'], ['food', '🍽️ Food'], ['all', 'All']].map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.chip, filter === k && styles.chipOn]} onPress={() => setFilter(k)}>
            <Text style={[styles.chipText, filter === k && styles.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.pad}>
        {items === null ? <ActivityIndicator color={C.accentSoft} style={styles.mv} /> : null}
        {items && shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No {filter === 'food' ? 'food' : filter === 'drinks' ? 'drinks' : ''} menu here yet</Text>
            <Text style={styles.faint}>Be the first to scan it at the table 📸 and everyone gets it.</Text>
          </View>
        ) : null}
        {Object.entries(groups).map(([g, list]) => (
          <View key={g}>
            <Text style={styles.section}>{g.toUpperCase()}</Text>
            {list.map((i) => (
              <View key={g + i.name} style={styles.row}>
                <Text style={styles.icon}>{i.kind === 'alcohol' ? '🍸' : i.kind === 'soft' ? '🧃' : '🍽️'}</Text>
                <View style={styles.flex}>
                  <Text style={styles.name}>{i.name}</Text>
                  {Number(i.orders) > 0 ? <Text style={styles.hot}>🔥 Ordered {i.orders}× on Vibe Out</Text> : null}
                </View>
                <Text style={styles.price}>{inr(i.price)}</Text>
              </View>
            ))}
          </View>
        ))}
        {items && items.length > 0 ? (
          <Text style={styles.note}>
            {scanned ? 'From menus scanned by people here' : 'From bills scanned here'} · prices may have changed
          </Text>
        ) : null}
      </ScrollView>

      <TouchableOpacity style={styles.scanBtn} onPress={scan} disabled={busy}>
        <Text style={styles.scanText}>{busy ? 'Reading the menu… ✨' : scanned ? '📸 Scan another menu page' : '📸 Scan the menu'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  place: { color: C.sub, fontSize: 14, fontWeight: '600', marginTop: 12 },
  chips: { flexDirection: 'row', marginTop: 10 },
  chip: { borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  pad: { paddingBottom: 110 },
  mv: { marginVertical: 30 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 8 },
  faint: { color: C.faint, fontSize: 13, marginTop: 4, textAlign: 'center' },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  icon: { fontSize: 18, width: 30 },
  name: { color: C.text, fontSize: 15, fontWeight: '500' },
  hot: { color: C.pink, fontSize: 11, fontWeight: '600', marginTop: 2 },
  price: { color: C.green, fontSize: 15, fontWeight: '700', marginLeft: 8 },
  note: { color: C.faint, fontSize: 11, marginTop: 14 },
  scanBtn: { position: 'absolute', left: 0, right: 0, bottom: 30, backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  scanText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
