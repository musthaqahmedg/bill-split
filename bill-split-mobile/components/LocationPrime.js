import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { setLocationPrimer } from '../services/places';
import { C, F, STICK } from '../services/theme';

// 📍 Friendly "why we need location" screen, shown once before the phone's own permission pop-up
export default function LocationPrime() {
  const [ask, setAsk] = useState(null); // resolver while showing
  useEffect(() => {
    setLocationPrimer(() => new Promise((resolve) => setAsk(() => resolve)));
    return () => setLocationPrimer(null);
  }, []);
  const answer = (ok) => {
    const r = ask;
    setAsk(null);
    r && r(ok);
  };
  return (
    <Modal visible={!!ask} transparent animationType="fade" onRequestClose={() => answer(false)}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <Text style={styles.pin}>📍</Text>
          <Text style={styles.title}>What's happening near you?</Text>
          {[
            ['🎉', 'Big events in your city'],
            ['🍻', 'Cafés, clubs and spots for tonight'],
            ['🛟', 'Squad radar, only when you share it'],
          ].map(([e, t]) => (
            <View key={t} style={styles.row}>
              <Text style={styles.rowEmoji}>{e}</Text>
              <Text style={styles.rowText}>{t}</Text>
            </View>
          ))}
          <Text style={styles.note}>Only while the app is open. Never in the background. For alerts we keep just your city name.</Text>
          <TouchableOpacity style={styles.allow} onPress={() => answer(true)} activeOpacity={0.85}>
            <Text style={styles.allowText}>ALLOW LOCATION →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => answer(false)} hitSlop={10}>
            <Text style={styles.later}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(8,8,12,0.88)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: C.card, borderRadius: 26, padding: 22, borderWidth: 3, borderColor: C.lime },
  pin: { fontSize: 52, textAlign: 'center' },
  title: { fontFamily: F.display, color: C.text, fontSize: 22, textAlign: 'center', marginTop: 8, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rowEmoji: { fontSize: 22, width: 34 },
  rowText: { color: C.text, fontSize: 15, fontWeight: '700', flex: 1 },
  note: { color: C.sub, fontSize: 12, lineHeight: 17, marginTop: 6 },
  allow: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 18, ...STICK },
  allowText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  later: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 14 },
});
