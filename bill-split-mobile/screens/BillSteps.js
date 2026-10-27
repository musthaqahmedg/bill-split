import { StyleSheet, Text, View } from 'react-native';
import { C } from '../services/theme';

// 🧾 Where you are in "Split a bill": Scan · Check · People · Who had what · Split
const STEPS = ['Scan', 'Check', 'People', 'Items', 'Split'];

export default function BillSteps({ at = 0 }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.bar, i <= at && styles.barOn]} />
        ))}
      </View>
      <Text style={styles.text}>
        Step {at + 1} of {STEPS.length} · <Text style={styles.now}>{STEPS[at]}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  bars: { flexDirection: 'row' },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border, marginRight: 4 },
  barOn: { backgroundColor: C.lime },
  text: { color: C.faint, fontSize: 12, fontWeight: '600', marginTop: 6 },
  now: { color: C.text },
});
