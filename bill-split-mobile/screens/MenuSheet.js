import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VenueMenu from './VenueMenu';
import { C, F } from '../services/theme';

// 📋 Check a place's menu before you go
export default function MenuSheet({ place, onClose }) {
  return (
    <Modal visible={!!place} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.title}>📋 Menu</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.link}>Done</Text>
          </TouchableOpacity>
        </View>
        {place ? <VenueMenu place={place} /> : null}
      </View>
    </Modal>
  );
}

// Small "📋 See the menu" pill
export function MenuButton({ onPress, label = '📋 See the menu', style }) {
  return (
    <TouchableOpacity style={[styles.pill, style]} onPress={onPress}>
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, padding: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: F.display, color: C.text, fontSize: 19 },
  link: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  pill: { alignSelf: 'flex-start', backgroundColor: 'rgba(139,92,246,0.18)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14 },
  pillText: { color: C.accentSoft, fontSize: 14, fontWeight: '700' },
});
