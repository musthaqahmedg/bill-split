import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

// ✍️ Privacy notice + consent (India DPDP Act 2023 / Rules 2025).
// Shown once to everyone (guests too) before we use their data, and again if the notice changes.
export const CONSENT_VERSION = '2026-10-25'; // bumped: live location sharing added
export const GRIEVANCE_EMAIL = 'maginfosystems@gmail.com';

const DATA = [
  ['👤', 'Name, and your email or phone', 'To log you in and show your name to friends in your plans'],
  ['🧾', 'Bills, items and who had what', 'To split bills and show who owes whom'],
  ['🎉', 'Plans, who’s coming, chat and photos', 'To run your plans with your group'],
  ['📸', 'Bill photos you scan', 'To read the items (sent to Google Gemini, not kept)'],
  ['🎂', 'Birthday (optional)', 'For friend birthday reminders'],
  ['📍', 'Location (only when you allow it)', 'To show places near you, and to share live location with your plan’s crew when YOU turn it on. Deleted when sharing ends'],
  ['📱', 'Phone model, crash and bug reports', 'To fix problems'],
];

const Tick = ({ on, onPress, children }) => (
  <TouchableOpacity style={styles.tickRow} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tickMark}>✓</Text> : null}</View>
    <Text style={styles.tickText}>{children}</Text>
  </TouchableOpacity>
);

export default function ConsentScreen({ onDone, onDecline }) {
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);

  const tap = (fn) => () => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    fn();
  };

  const accept = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('record_consent', { p_version: CONSENT_VERSION, p_adult: adult });
      if (error) throw error;
      onDone();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const decline = () =>
    Alert.alert('No problem', 'We can’t run the app without this. You’ll be logged out, and nothing more is collected.', [
      { text: 'Go back', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onDecline },
    ]);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Before we start</Text>
        <Text style={styles.title}>🔒 Your privacy</Text>
        <Text style={styles.lead}>Short and clear: what we use, why, and your rights. Nothing hidden.</Text>

        <Text style={styles.section}>What we use, and why</Text>
        <View style={styles.card}>
          {DATA.map(([e, what, why], i) => (
            <View key={what} style={[styles.row, i && styles.rowLine]}>
              <Text style={styles.rowEmoji}>{e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowWhat}>{what}</Text>
                <Text style={styles.rowWhy}>{why}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.section}>We never</Text>
        <Text style={styles.body}>Sell your data · show ads based on it · upload your contacts · hold your money · read your SMS or bank.</Text>

        <Text style={styles.section}>Your rights</Text>
        <Text style={styles.body}>
          • <Text style={styles.b}>See or download</Text> your data: Profile → Your data & privacy{'\n'}
          • <Text style={styles.b}>Correct</Text> it: edit your profile, bills and plans{'\n'}
          • <Text style={styles.b}>Withdraw consent and erase</Text> everything: Profile → Delete my account{'\n'}
          • <Text style={styles.b}>Complain:</Text> email our grievance officer at{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${GRIEVANCE_EMAIL}`)}>{GRIEVANCE_EMAIL}</Text>
          {' '}(we reply within 7 days). You can also complain to the Data Protection Board of India.
        </Text>

        <TouchableOpacity onPress={() => Linking.openURL('https://bill-split-flax.vercel.app/privacy')}>
          <Text style={styles.full}>Read the full privacy policy ›</Text>
        </TouchableOpacity>

        <View style={styles.ticks}>
          <Tick on={adult} onPress={tap(() => setAdult(!adult))}>I’m <Text style={styles.b}>18 or older</Text></Tick>
          <Tick on={agree} onPress={tap(() => setAgree(!agree))}>I agree to Vibe Out using my data as explained above</Tick>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <TouchableOpacity style={[styles.button, !(adult && agree) && styles.buttonOff]} onPress={accept} disabled={!(adult && agree) || saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Agree and continue</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={decline} hitSlop={8}>
          <Text style={styles.decline}>I don’t agree</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pad: { paddingTop: 64, paddingHorizontal: 22, paddingBottom: 24 },
  kicker: { color: C.accentSoft, fontSize: 14, fontWeight: '700' },
  title: { color: C.text, fontSize: 30, fontWeight: '800', marginTop: 2 },
  lead: { color: C.sub, fontSize: 15, lineHeight: 22, marginTop: 6 },
  section: { color: C.text, fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: 'row', paddingVertical: 11 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.border },
  rowEmoji: { fontSize: 18, width: 30 },
  rowWhat: { color: C.text, fontSize: 14, fontWeight: '700' },
  rowWhy: { color: C.sub, fontSize: 13, marginTop: 2, lineHeight: 18 },
  body: { color: C.sub, fontSize: 14, lineHeight: 22 },
  b: { color: C.text, fontWeight: '700' },
  link: { color: C.accentSoft, textDecorationLine: 'underline' },
  full: { color: C.accentSoft, fontSize: 14, fontWeight: '600', marginTop: 14 },
  ticks: { marginTop: 18 },
  tickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
  tickMark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  tickText: { color: C.text, fontSize: 15, flex: 1, lineHeight: 21 },
  bottom: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34, borderTopWidth: 1, borderTopColor: C.border },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 18, alignItems: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  decline: { color: C.faint, fontSize: 14, textAlign: 'center', marginTop: 14 },
});
