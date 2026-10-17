import { StyleSheet, Text, View } from 'react-native';
import { C } from '../services/theme';

// 🟢 "Active now" / "Active 5m ago" under a friend's name
export default function ActiveTag({ status }) {
  if (!status) return null;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, status.now ? styles.on : styles.off]} />
      <Text style={[styles.text, status.now && styles.textOn]}>{status.text}</Text>
    </View>
  );
}

// Green dot to put on an avatar
export function ActiveDot({ status, style }) {
  if (!status || !status.now) return null;
  return <View style={[styles.badge, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  on: { backgroundColor: C.green },
  off: { backgroundColor: 'rgba(255,255,255,0.3)' },
  text: { color: C.faint, fontSize: 12 },
  textOn: { color: C.green, fontWeight: '600' },
  badge: { position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg },
});
