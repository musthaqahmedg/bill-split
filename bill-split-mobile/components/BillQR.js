import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getProfile, isValidUpi, saveUpi } from '../services/profile';
import QRCode from './QRCode';
import { C, F } from '../services/theme';

// 📲 "Show QR to the table": friends scan with their camera, tap their name, see their share
// (or tick what they had) and pay with UPI. No app needed.
export const billUrl = (token) => `https://bill-split-flax.vercel.app/b/${token}`;

export default function BillQR({ visible, token, title, byItems, mePaid, onClose }) {
  // 💸 friends can only pay you if your UPI ID is set: ask for it right here
  const [upi, setUpi] = useState(null); // null = loading, '' = missing
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible && mePaid) getProfile().then((p) => setUpi((p && p.upi_id) || '')).catch(() => setUpi(''));
  }, [visible, mePaid]);
  const saveIt = async () => {
    if (!isValidUpi(draft)) return Alert.alert('Check the UPI ID', 'It looks like name@okbank, e.g. musthaq@okicici');
    setSaving(true);
    try {
      await saveUpi(draft);
      setUpi(draft.trim());
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
    setSaving(false);
  };
  if (!token) return null;
  const needUpi = mePaid && upi === '';
  const url = billUrl(token);
  const share = () =>
    Share.share({ message: `🌙 ${title || 'Our night out'}: see your share and pay here 👇\n${url}` }).catch(() => {});
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          {needUpi ? (
            <View style={styles.upiBox}>
              <Text style={styles.upiTitle}>💸 Where should friends pay you?</Text>
              <Text style={styles.upiSub}>Add your UPI ID once. Then every friend's "Pay with UPI" button sends money straight to you.</Text>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TextInput style={styles.upiInput} value={draft} onChangeText={setDraft} placeholder="name@okicici" placeholderTextColor={C.faint}
                  autoCapitalize="none" autoCorrect={false} keyboardType="email-address" keyboardAppearance="dark" />
                <TouchableOpacity style={styles.upiSave} onPress={saveIt} disabled={saving}>
                  <Text style={styles.upiSaveText}>{saving ? '…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          <Text style={styles.kicker}>PAY YOUR SHARE</Text>
          <Text style={styles.title} numberOfLines={2}>{title || 'Our night out'}</Text>
          <View style={styles.qrBox}>
            <QRCode value={url} size={210} />
          </View>
          <Text style={styles.steps}>📷 Scan with your camera → tap your face → 💸 Pay with UPI</Text>
          {mePaid && upi ? <Text style={styles.sub}>Money goes straight to your UPI ({upi}). Tap "Received" on the bill when it lands.</Text> : null}
          <Text style={styles.sub}>
            {byItems ? "Not sure what you had? Tick your items there and your share updates. No app needed." : 'Everyone sees their own share. No app needed.'}
          </Text>
          <TouchableOpacity style={styles.cta} onPress={share} activeOpacity={0.85}>
            <Text style={styles.ctaText}>💬 SEND THE LINK INSTEAD</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ alignSelf: 'center', marginTop: 12 }}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  upiBox: { alignSelf: 'stretch', backgroundColor: C.bg, borderWidth: 2, borderColor: C.pink, borderRadius: 18, padding: 14, marginBottom: 14 },
  upiTitle: { color: C.text, fontSize: 16, fontWeight: '900' },
  upiSub: { color: C.sub, fontSize: 13, marginTop: 4 },
  upiInput: { flex: 1, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 15 },
  upiSave: { backgroundColor: C.lime, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  upiSaveText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: F.display, color: C.text, fontSize: 24, textAlign: 'center', marginTop: 6 },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginTop: 16, borderWidth: 4, borderColor: C.lime },
  steps: { color: C.text, fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  sub: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 6 },
  cta: { alignSelf: 'stretch', backgroundColor: C.lime, borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 18, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  ctaText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  close: { color: C.sub, fontSize: 15, fontWeight: '700' },
});
