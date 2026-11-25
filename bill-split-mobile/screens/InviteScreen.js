import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardDone from './KeyboardDone';
import { INVITE_XP, inviteLink, myInvite, redeemInvite } from '../services/invite';
import { BRAND, C, F } from '../services/theme';

// 🎁 Invite friends → become friends automatically + XP (no cash value)
// 🎟️ Ticket printer (Gautham's ref): tap → your invite ticket prints out of the slot → share it as an image

const TICKET_H = 230;

function Ticket({ code }) {
  return (
    <View style={tk.ticket}>
      <View style={[tk.notch, { left: -11 }]} />
      <View style={[tk.notch, { right: -11 }]} />
      <View style={tk.topRow}>
        <Text style={tk.brand}>{BRAND.upper}</Text>
        <Text style={tk.admit}>ADMIT YOUR SQUAD 🎟️</Text>
      </View>
      <Text style={tk.kicker}>INVITE CODE</Text>
      <Text style={tk.code}>{code}</Text>
      <View style={tk.dash} />
      <Text style={tk.line}>Plan nights · book tables · split bills</Text>
      <Text style={tk.link}>{inviteLink(code).replace('https://', '')}</Text>
    </View>
  );
}

function Printer({ code, onShare, onLink, sharing }) {
  const out = useRef(new Animated.Value(0)).current; // 0 = inside the printer, 1 = printed
  const [state, setState] = useState('idle'); // idle → printing → done
  const ticketRef = useRef(null);

  const print = () => {
    if (state !== 'idle') return;
    setState('printing');
    // print in small jerky steps, like a real ticket machine
    const steps = [0.18, 0.34, 0.5, 0.66, 0.82, 1];
    Animated.sequence(
      steps.map((v) => Animated.timing(out, { toValue: v, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: true }))
    ).start(() => {
      setState('done');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    });
    steps.forEach((_, i) => setTimeout(() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }, i * 230));
  };

  const y = out.interpolate({ inputRange: [0, 1], outputRange: [-TICKET_H, 0] });

  return (
    <View style={{ marginTop: 20 }}>
      <View style={tk.printer}>
        <Text style={tk.pTitle}>Earn +{INVITE_XP} XP</Text>
        <Text style={tk.pSub}>for every friend who makes their first plan</Text>
        <View style={tk.lights}>
          <View style={[tk.light, { backgroundColor: state === 'printing' ? C.lime : '#3A3A44' }]} />
          <View style={[tk.light, { backgroundColor: state === 'done' ? C.pink : '#3A3A44' }]} />
        </View>
        <TouchableOpacity style={[tk.printBtn, state !== 'idle' && { opacity: 0.5 }]} onPress={print} disabled={state !== 'idle'} activeOpacity={0.85}>
          <Text style={tk.printText}>{state === 'idle' ? 'TAP TO PRINT YOUR TICKET' : state === 'printing' ? 'PRINTING…' : 'PRINTED ✓'}</Text>
        </TouchableOpacity>
        <View style={tk.slot} />
      </View>

      {/* the ticket slides out from under the slot */}
      <View style={{ height: state === 'idle' ? 0 : TICKET_H + 6, overflow: 'hidden', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ translateY: y }] }}>
          <View ref={ticketRef} collapsable={false} style={{ backgroundColor: C.bg, paddingHorizontal: 12 }}>
            <Ticket code={code} />
          </View>
        </Animated.View>
      </View>

      {state === 'done' ? (
        <>
          <TouchableOpacity style={tk.shareBtn} onPress={() => onShare(ticketRef)} disabled={sharing} activeOpacity={0.85}>
            <Text style={tk.shareText}>{sharing ? 'Getting it ready…' : '📤 Share ticket'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLink} style={{ alignSelf: 'center', marginTop: 10 }}>
            <Text style={tk.linkBtn}>or send the link as text</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

export default function InviteScreen({ onBack }) {
  const [inv, setInv] = useState(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = () => myInvite().then(setInv).catch(() => setFailed(true));
  useEffect(() => { load(); }, []);

  const share = () => {
    const link = inviteLink(inv.code);
    Share.share({
      message: `🌙 Join me on ${BRAND.name} — plan nights out, book tables and split bills without the drama.\n\nUse my invite code *${inv.code}* when you sign up 👇\n${link}`,
    }).catch(() => {});
  };

  const shareTicket = async (ref) => {
    setSharing(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) return share();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your invite ticket' });
    } catch (e) {
      share(); // image didn't work → fall back to the text invite
    } finally {
      setSharing(false);
    }
  };

  const redeem = async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) return Alert.alert('Check the code', 'Invite codes have 6 letters and numbers.');
    setBusy(true);
    try {
      const name = await redeemInvite(c);
      setCode('');
      Alert.alert('You’re in 🎉', `You and ${name} are now friends on ${BRAND.name}.`);
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
            <Printer code={inv.code} onShare={shareTicket} onLink={share} sharing={sharing} />

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

const tk = StyleSheet.create({
  printer: { backgroundColor: '#1F1D26', borderRadius: 26, borderWidth: 2, borderColor: '#2E2B38', paddingTop: 22, paddingHorizontal: 18, paddingBottom: 0, alignItems: 'center' },
  pTitle: { fontFamily: F.display, color: C.text, fontSize: 26 },
  pSub: { color: C.sub, fontSize: 14, marginTop: 4, textAlign: 'center' },
  lights: { flexDirection: 'row', marginTop: 14 },
  light: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 5 },
  printBtn: { backgroundColor: C.pink, borderRadius: 16, paddingVertical: 14, alignSelf: 'stretch', alignItems: 'center', marginTop: 14 },
  printText: { fontFamily: F.pixel, color: '#FFFFFF', fontSize: 13, letterSpacing: 1 },
  slot: { height: 12, alignSelf: 'stretch', marginHorizontal: 24, marginTop: 18, marginBottom: 10, borderRadius: 6, backgroundColor: '#050507', borderTopWidth: 2, borderTopColor: '#000' },
  ticket: { width: 290, height: TICKET_H, backgroundColor: C.lime, borderRadius: 18, padding: 18, overflow: 'hidden' },
  notch: { position: 'absolute', top: 108, width: 22, height: 22, borderRadius: 11, backgroundColor: C.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: F.display, color: C.onLime, fontSize: 16 },
  admit: { fontFamily: F.pixel, color: C.onLime, fontSize: 9 },
  kicker: { fontFamily: F.pixel, color: C.onLime, fontSize: 10, marginTop: 18, opacity: 0.7 },
  code: { fontFamily: F.display, color: C.onLime, fontSize: 40, letterSpacing: 6, marginTop: 2 },
  dash: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(14,14,18,0.35)', marginVertical: 12 },
  line: { color: C.onLime, fontSize: 13, fontWeight: '700' },
  link: { color: C.onLime, fontSize: 12, marginTop: 4, opacity: 0.75 },
  shareBtn: { backgroundColor: C.lime, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  shareText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  linkBtn: { color: C.sub, fontSize: 14, textDecorationLine: 'underline' },
});
