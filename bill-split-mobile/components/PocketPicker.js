import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, F } from '../services/theme';

// 💰 "Which pocket does your share come out of?" — shown after a bill is saved (or from a saved bill).
// The suggested pocket is pre-picked; the user can change it or skip.
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export default function PocketPicker({ visible, amount, pockets, suggested, current = null, onPick, onSkip, title = 'Which pocket?' }) {
  const [pick, setPick] = useState(suggested || current);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setPick(current || suggested);
  }, [visible]);

  const save = async () => {
    setBusy(true);
    try { Haptics.selectionAsync(); } catch (e) {}
    await onPick(pick);
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <Pressable style={styles.overlay} onPress={onSkip}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>💰 {title}</Text>
          <Text style={styles.sub}>Your share {inr(amount)} comes out of this pocket. Only what you had, never an even split.</Text>
          <View style={styles.grid}>
            {pockets.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.chip, pick === p.id && styles.on]} onPress={() => setPick(p.id)} activeOpacity={0.8}>
                <Text style={styles.emoji}>{p.emoji}</Text>
                <Text style={[styles.name, pick === p.id && { color: C.onLime }]} numberOfLines={1}>{p.name}</Text>
                {p.id === suggested ? <Text style={[styles.tag, pick === p.id && { color: C.onLime }]}>suggested</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.cta, !pick && { opacity: 0.45 }]} onPress={save} disabled={!pick || busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={C.onLime} /> : <Text style={styles.ctaText}>Take {inr(amount)} from {(pockets.find((p) => p.id === pick) || {}).name || 'a pocket'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} style={{ alignSelf: 'center', marginTop: 12 }}>
            <Text style={styles.skip}>{current ? 'Leave it out of my pockets' : 'Skip for now'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 12 },
  title: { fontFamily: F.display, color: C.text, fontSize: 20 },
  sub: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  chip: { width: '31.5%', alignItems: 'center', backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8 },
  on: { backgroundColor: C.lime, borderColor: C.lime },
  emoji: { fontSize: 22 },
  name: { color: C.text, fontSize: 12, fontWeight: '800', marginTop: 3 },
  tag: { color: C.lime, fontSize: 10, fontWeight: '800', marginTop: 1 },
  cta: { backgroundColor: C.lime, borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 8, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  ctaText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  skip: { color: C.sub, fontSize: 14, textDecorationLine: 'underline' },
});
