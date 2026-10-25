import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listBills } from '../services/bills';
import { listParties } from '../services/parties';
import { getProfile } from '../services/profile';
import { C, F } from '../services/theme';

// 🔒 Your data, in plain words: what we keep, what we never do, who sees what, and your controls
const NEVER = [
  ['💸', 'Sell your data or show ads based on it'],
  ['📇', 'Upload or store your contacts (only scrambled codes are checked, nothing is kept)'],
  ['💳', 'Hold your money. Payments go straight between friends'],
  ['📩', 'Read your SMS, bank or other apps'],
  ['📍', 'Track your location in the background'],
];
const KEEP = [
  ['👤', 'Your name, and your email or phone to log you in'],
  ['🧾', 'Bills and plans you create, and who was in them'],
  ['📸', 'Photos you choose to add to a plan'],
  ['💸', 'Spends you log in My Money (only you can see them)'],
  ['📍', 'Live location, only while you share it with a plan’s crew (15 min to 8 hours). Deleted the moment it ends'],
  ['💬', 'Messages in your plan chats. They disappear from the app 30 days after the last message, are kept locked away for 1 year (Indian law), then deleted for good'],
  ['🐞', 'Bug notes you send us'],
];
const WHO = [
  ['🔐', 'Only people in a bill or plan can see it. Everyone else is blocked by the database itself.'],
  ['🔗', 'A share link shows that one bill or plan to whoever you send it to. Only share it with your group.'],
  ['🧠', 'Bill photos are sent to Google Gemini to read the items. We don’t keep the photo.'],
  ['🚨', 'Crash reports (Sentry) carry no names, numbers or bill details.'],
];

export default function YourDataScreen({ onBack, onDelete }) {
  const [busy, setBusy] = useState(false);

  // 📦 Download my data: everything we hold about you, as one file you can save or send
  const exportData = async () => {
    setBusy(true);
    try {
      const [profile, bills, plans] = await Promise.all([getProfile(), listBills(), listParties()]);
      const data = { exported_at: new Date().toISOString(), profile, bills, plans };
      await Share.share({ title: 'My Vibe Out data', message: JSON.stringify(data, null, 2) });
    } catch (e) {
      Alert.alert("Couldn't export", e.message);
    } finally {
      setBusy(false);
    }
  };

  const Section = ({ title, rows, tint }) => (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, tint && { color: tint }]}>{title}</Text>
      {rows.map(([e, t]) => (
        <View key={t} style={styles.row}>
          <Text style={styles.rowEmoji}>{e}</Text>
          <Text style={styles.rowText}>{t}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.kicker}>Private by design</Text>
        <Text style={styles.title}>🔒 Your data</Text>
        <Text style={styles.lead}>Plain words, no legal fog. Here’s exactly what happens to your data.</Text>

        <Section title="🙅 We never" rows={NEVER} tint={C.green} />
        <Section title="📦 What we keep" rows={KEEP} />
        <Section title="👀 Who can see it" rows={WHO} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛡️ How it’s protected</Text>
          <Text style={styles.body}>
            Stored on secure cloud servers (Supabase), encrypted on disk and on the way there (HTTPS). Every request is checked so each person can only reach their own data.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📮 Questions or complaints</Text>
          <Text style={styles.body}>
            Email our grievance officer at maginfosystems@gmail.com. We reply within 7 days. You can also complain to the Data Protection Board of India. The app is for people aged 18+.
          </Text>
        </View>

        <Text style={styles.section}>Your controls</Text>
        <TouchableOpacity style={styles.action} onPress={exportData} disabled={busy}>
          <Text style={styles.actionEmoji}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Download my data</Text>
            <Text style={styles.actionSub}>Your profile, bills and plans as one file</Text>
          </View>
          {busy ? <ActivityIndicator color={C.accentSoft} /> : <Text style={styles.chev}>›</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => Linking.openURL('https://bill-split-flax.vercel.app/privacy')}>
          <Text style={styles.actionEmoji}>📄</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Full privacy policy</Text>
            <Text style={styles.actionSub}>The detailed version</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
        {onDelete ? (
          <TouchableOpacity style={styles.action} onPress={onDelete}>
            <Text style={styles.actionEmoji}>🗑️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: C.red }]}>Delete my account</Text>
              <Text style={styles.actionSub}>Removes everything for good</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.note}>🗑️ To delete your account and everything in it: Profile → Delete my account (at the bottom).</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 50 },
  back: { color: C.accentSoft, fontSize: 17, marginBottom: 10 },
  kicker: { color: C.accentSoft, fontSize: 14, fontWeight: '700' },
  title: { fontFamily: F.display, color: C.text, fontSize: 29, marginTop: 2 },
  lead: { color: C.sub, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 6 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginTop: 12 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', marginTop: 8 },
  rowEmoji: { fontSize: 16, width: 28 },
  rowText: { color: C.sub, fontSize: 14, lineHeight: 20, flex: 1 },
  body: { color: C.sub, fontSize: 14, lineHeight: 21 },
  section: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 6 },
  action: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, marginTop: 10 },
  actionEmoji: { fontSize: 22, marginRight: 12 },
  actionTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  actionSub: { color: C.faint, fontSize: 12, marginTop: 2 },
  chev: { color: C.faint, fontSize: 22 },
  note: { color: C.faint, fontSize: 13, lineHeight: 19, marginTop: 14 },
});
