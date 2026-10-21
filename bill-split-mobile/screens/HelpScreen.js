import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { LayoutAnimation, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { FAQ, SUPPORT_EMAIL } from '../services/support';
import { isAdmin } from '../services/track';
import { C } from '../services/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

// ℹ️ About & Help: who we are, quick answers, and 💬 chat with the team
export default function HelpScreen({ onBack, onChat, onInbox, onBugs }) {
  const [open, setOpen] = useState(null);
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    isAdmin().then(setAdmin).catch(() => {});
  }, []);
  const version = (Constants.expoConfig && Constants.expoConfig.version) || '1.0.0';
  const toggle = (i) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === i ? null : i);
  };

  return (
    <View style={styles.page}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        <View style={styles.about}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🌙</Text>
          </View>
          <Text style={styles.name}>Vibe Out</Text>
          <Text style={styles.tag}>The night, sorted ✨</Text>
          <Text style={styles.meta}>Version {version}</Text>
        </View>

        <TouchableOpacity style={styles.chat} activeOpacity={0.85} onPress={onChat}>
          <Text style={styles.chatEmoji}>💬</Text>
          <View style={styles.flex}>
            <Text style={styles.chatTitle}>Chat with us</Text>
            <Text style={styles.chatSub}>Questions, problems or ideas. A real person replies.</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>

        {admin ? (
          <TouchableOpacity style={styles.row} onPress={onInbox}>
            <Text style={styles.rowText}>🛟 Support inbox (team only)</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}
        {admin ? (
          <TouchableOpacity style={styles.row} onPress={onBugs}>
            <Text style={styles.rowText}>🐞 Bug reports (team only)</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.tip}>📳 Found a bug? Shake your phone on any page to report it.</Text>

        <Text style={styles.section}>QUICK ANSWERS</Text>
        <View style={styles.group}>
          {FAQ.map((f, i) => (
            <TouchableOpacity key={f.q} style={[styles.faq, i > 0 && styles.line]} activeOpacity={0.7} onPress={() => toggle(i)}>
              <View style={styles.faqTop}>
                <Text style={styles.q}>{f.q}</Text>
                <Text style={[styles.plus, open === i && styles.plusOpen]}>＋</Text>
              </View>
              {open === i ? <Text style={styles.a}>{f.a}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>MORE</Text>
        <View style={styles.group}>
          <TouchableOpacity style={styles.item} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={styles.rowText}>✉️ Email us</Text>
            <Text style={styles.sub}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.item, styles.line]} onPress={() => Linking.openURL('https://bill-split-flax.vercel.app/privacy')}>
            <Text style={styles.rowText}>🔒 Privacy policy</Text>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.foot}>Made with 💜 by Musthaq & Gautham · Kerala</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 18 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 6 },
  pad: { paddingBottom: 50 },
  flex: { flex: 1 },
  about: { alignItems: 'center', marginTop: 8, marginBottom: 22 },
  logo: { width: 72, height: 72, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 34 },
  name: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 12 },
  tag: { color: C.sub, fontSize: 14, marginTop: 3 },
  meta: { color: C.faint, fontSize: 12, marginTop: 6 },
  chat: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accent, borderRadius: 16, padding: 14, marginBottom: 10 },
  chatEmoji: { fontSize: 24, marginRight: 12 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chatSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  chev: { color: C.faint, fontSize: 22, marginLeft: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 10 },
  rowText: { color: C.text, fontSize: 15, fontWeight: '500' },
  tip: { color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 6 },
  section: { color: C.faint, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden' },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  faq: { paddingVertical: 13, paddingHorizontal: 14 },
  faqTop: { flexDirection: 'row', alignItems: 'center' },
  q: { flex: 1, color: C.text, fontSize: 15 },
  plus: { color: C.faint, fontSize: 16, marginLeft: 8 },
  plusOpen: { transform: [{ rotate: '45deg' }], color: C.accentSoft },
  a: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14 },
  sub: { color: C.faint, fontSize: 13 },
  foot: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
