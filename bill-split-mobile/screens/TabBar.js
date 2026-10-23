import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { C } from '../services/theme';

// 📱 Bottom tabs (like Instagram / Swiggy): Home · Plans · ➕ · Friends · Profile
const TABS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'parties', icon: '🎉', label: 'Plans' },
  { key: 'plus' },
  { key: 'friends', icon: '👥', label: 'Friends' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

const tap = () => {
  try {
    Haptics.selectionAsync();
  } catch (e) {}
};

export default function TabBar({ current, onTab, onPlan, onBill }) {
  const [menu, setMenu] = useState(false);
  const bottom = Math.max((initialWindowMetrics && initialWindowMetrics.insets.bottom) || 0, Platform.OS === 'ios' ? 20 : 10);

  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {TABS.map((t) =>
        t.key === 'plus' ? (
          <View key="plus" style={styles.slot}>
            <TouchableOpacity
              style={styles.plus}
              activeOpacity={0.85}
              onPress={() => {
                tap();
                setMenu(true);
              }}
            >
              <Text style={styles.plusText}>＋</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            key={t.key}
            style={styles.slot}
            activeOpacity={0.7}
            onPress={() => {
              if (t.key !== current) tap();
              onTab(t.key);
            }}
          >
            <Text style={[styles.icon, t.key !== current && styles.iconOff]}>{t.icon}</Text>
            <Text style={[styles.label, t.key === current && styles.labelOn]}>{t.label}</Text>
            {t.key === current ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
        )
      )}

      {/* ➕ What do you want to start? */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenu(false)}>
          <View style={[styles.sheet, { paddingBottom: bottom + 14 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Start something</Text>
            <TouchableOpacity
              style={styles.option}
              activeOpacity={0.85}
              onPress={() => {
                setMenu(false);
                onPlan();
              }}
            >
              <Text style={styles.optEmoji}>🎉</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optTitle}>Plan a night</Text>
                <Text style={styles.optSub}>Pick a place, invite friends, vote</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.option}
              activeOpacity={0.85}
              onPress={() => {
                setMenu(false);
                onBill();
              }}
            >
              <Text style={styles.optEmoji}>🧾</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optTitle}>Split a bill</Text>
                <Text style={styles.optSub}>Scan the receipt, tag who had what</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 21 },
  iconOff: { opacity: 0.45 },
  label: { color: C.faint, fontSize: 11, fontWeight: '600', marginTop: 2 },
  labelOn: { color: C.text },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 3 },
  plus: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: -18, borderWidth: 4, borderColor: C.bg },
  plusText: { color: '#fff', fontSize: 26, fontWeight: '600', marginTop: -2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cardHi, borderRadius: 16, padding: 14, marginBottom: 10 },
  optEmoji: { fontSize: 26, marginRight: 12 },
  optTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  optSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  chev: { color: C.faint, fontSize: 24, marginLeft: 8 },
});
