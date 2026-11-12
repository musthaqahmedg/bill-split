import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardDone from './KeyboardDone';
import { INVITE_XP, inviteLink, myInvite, redeemInvite } from '../services/invite';
import { C, F } from '../services/theme';

// 🎁 Invite friends → become friends automatically + XP (no cash value)

export default function InviteScreen({ onBack }) {
  const [inv, setInv] = useState(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => myInvite().then(setInv).catch(() => setFailed(true));
  useEffect(() => { load(); }, []);

  const share = () => {
    const link = inviteLink(inv.code);
    Share.share({
      message: `🌙 Join me on VibeOut — plan nights out, book tables and split bills without the drama.\n\nUse my invite code *${inv.code}* when you sign up 👇\n${link}`,
    }).catch(() => {});
  };

  const redeem = async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) return Alert.alert('Check the code', 'Invite codes have 6 letters and numbers.');
    setBusy(true);
    try {
      const name = await redeemInvite(c);
      setCode('');
      Alert.alert('You’re in 🎉', `You and ${name} are now friends on VibeOut.`);
      load();
    } catch (e) {
      Alert.alert("Couldn't use that code", e.message);
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Invite friends 🎁</Text>
        <Text style={styles.sub}>Nights are better with your squad on the app.</Text>

        {!inv && !failed ? <ActivityIndicator color={C.lime} style={{ marginTop: 40 }} /> : null}
        {failed ? <Text style={styles.sub}>Couldn't load your invite. Check your internet and try again.</Text> : null}

        {inv ? (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.kicker}>YOUR INVITE CODE</Text>
              <Text style={styles.code} selectable>{inv.code}</Text>
              <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85} accessibilityRole="button">
                <Text style={styles.shareText}>📤 Share invite</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{inv.joined}</Text>
                <Text style={styles.statLabel}>joined</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{inv.active}</Text>
                <Text style={styles.statLabel}>got going</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: C.lime }]}>+{inv.active * INVITE_XP}</Text>
                <Text style={styles.statLabel}>XP earned</Text>
              </View>
            </View>

            <Text style={styles.label}>HOW IT WORKS</Text>
            <View style={styles.box}>
              <Text style={styles.step}>1️⃣  Share your code or link</Text>
              <Text style={styles.step}>2️⃣  Your friend signs up and enters it → you're friends instantly</Text>
              <Text style={styles.step}>3️⃣  When they make their first plan or split a bill, you get +{INVITE_XP} XP ⭐</Text>
              <Text style={styles.note}>XP levels you up (Rookie → Vibe Legend). It's just for fun — no cash value.</Text>
            </View>

            <Text style={styles.label}>GOT A FRIEND'S CODE?</Text>
            {inv.used_code ? (
              <View style={styles.box}>
                <Text style={styles.step}>✅ You joined with {inv.inviter}'s invite</Text>
              </View>
            ) : (
              <View style={styles.redeemRow}>
                <TextInput
                  style={styles.input} value={code} onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123" placeholderTextColor={C.faint} autoCapitalize="characters" autoCorrect={false}
                  keyboardAppearance="dark" returnKeyType="done" onSubmitEditing={redeem} />
                <TouchableOpacity style={[styles.useBtn, (code.length !== 6 || busy) && styles.off]} onPress={redeem} disabled={code.length !== 6 || busy}>
                  <Text style={styles.useText}>{busy ? '…' : 'Use code'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  body: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 60 },
  back: { color: C.lime, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  title: { fontFamily: F.display, color: C.text, fontSize: 30 },
  sub: { color: C.sub, fontSize: 15, marginTop: 4 },
  codeCard: { backgroundColor: C.violet, borderRadius: 24, padding: 20, marginTop: 20, alignItems: 'center' },
  kicker: { fontFamily: F.pixel, color: C.onLime, fontSize: 11, opacity: 0.8 },
  code: { fontFamily: F.display, color: C.onLime, fontSize: 44, letterSpacing: 6, marginTop: 6 },
  shareBtn: { backgroundColor: C.onLime, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 24, marginTop: 14 },
  shareText: { color: C.lime, fontSize: 16, fontWeight: '900' },
  stats: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 12, alignItems: 'center', marginHorizontal: 3 },
  statNum: { fontFamily: F.display, color: C.text, fontSize: 22 },
  statLabel: { color: C.sub, fontSize: 13, marginTop: 2 },
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 22, marginBottom: 8 },
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14 },
  step: { color: C.text, fontSize: 15, lineHeight: 22, marginBottom: 6 },
  note: { color: C.faint, fontSize: 13, marginTop: 4 },
  redeemRow: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  useBtn: { backgroundColor: C.lime, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center', marginLeft: 8 },
  useText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  off: { backgroundColor: C.disabled },
});
