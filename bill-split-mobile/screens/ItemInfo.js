import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { kindOf } from '../services/kinds';
import { C } from '../services/theme';

// "What's this?" pop-up for one item (works with scanned and saved items)
export default function ItemInfo({ item, onClose }) {
  if (!item) return null;

  const kind = kindOf(item);
  const tag = kind === 'alcohol'
    ? { text: '🍺 Contains alcohol', style: styles.tagAlcohol }
    : kind === 'soft'
      ? { text: '🥤 No alcohol', style: styles.tagSoft }
      : { text: '🍽️ Food', style: styles.tagFood };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card}>
          <Text style={styles.title}>{item.name}</Text>
          <View style={[styles.tag, tag.style]}>
            <Text style={styles.tagText}>{tag.text}</Text>
          </View>
          <Text style={styles.about}>
            {item.about ? item.about : "We don't have a description for this one yet."}
          </Text>
          <Text style={styles.note}>AI's best guess from the bill. Ask the staff if you're not sure.</Text>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: C.text },
  tag: { alignSelf: 'flex-start', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 14 },
  tagAlcohol: { backgroundColor: C.amberBg },
  tagSoft: { backgroundColor: C.greenBg },
  tagFood: { backgroundColor: C.cardHi },
  tagText: { fontSize: 14, fontWeight: '700', color: C.text },
  about: { fontSize: 16, color: C.sub, lineHeight: 22 },
  note: { fontSize: 12, color: C.faint, marginTop: 14 },
  btn: { backgroundColor: C.accent, padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 18 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});