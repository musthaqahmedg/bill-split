import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { knownUpi, openUpi, rememberUpi, UPI_APPS, validUpi } from '../services/upi';
import { C, F, STICK } from '../services/theme';

// 💸 Pay ₹X with UPI: picks up their UPI ID (or you type it once), then opens your UPI app with everything filled in
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function PayUpiSheet({ visible, onClose, to, amount, note, participantId, shareToken, isCreator, onPaid }) {
  const [upi, setUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setOpened(false);
    setLoading(true);
    knownUpi({ participantId, name: to, shareToken, isCreator }).then((u) => { setUpi(u); setLoading(false); });
  }, [visible]);

  const name = to === 'Me' ? 'the host' : to;
  const pay = async (app) => {
    if (!validUpi(upi)) return Alert.alert('UPI ID needed', `Ask ${name} for their UPI ID, e.g. name@okaxis`);
    rememberUpi(to, upi);
    try {
      await openUpi(app, { upi, name: to === 'Me' ? 'Host' : to, amount, note });
      setOpened(true);
    } catch (e) {
      Alert.alert(`${app.label} didn't open`, Platform.OS === 'ios' ? 'Try another app, or copy the UPI ID.' : 'No UPI app found on this phone. Copy the UPI ID instead.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet}>
            <Text style={styles.kicker}>PAY WITH UPI</Text>
            <Text style={styles.title}>{inr(amount)} to {to === 'Me' ? 'the host' : to}</Text>
            {loading ? (
              <ActivityIndicator color={C.lime} style={{ marginVertical: 20 }} />
            ) : (
              <>
                <Text style={styles.label}>Their UPI ID</Text>
                <TextInput
                  style={styles.input}
                  value={upi}
                  onChangeText={setUpi}
                  placeholder="e.g. name@okaxis"
                  placeholderTextColor={C.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  keyboardAppearance="dark"
                />
                {UPI_APPS.map((a, i) => (
                  <TouchableOpacity key={a.key} style={[styles.app, i === 0 && styles.appMain]} onPress={() => pay(a)} activeOpacity={0.85}>
                    <Text style={[styles.appText, i === 0 && { color: C.onLime }]}>{i === 0 ? `PAY ${inr(amount)} · ${a.label.toUpperCase()} →` : a.label}</Text>
                  </TouchableOpacity>
                ))}
                {validUpi(upi) ? (
                  <TouchableOpacity onPress={() => Share.share({ message: upi.trim() }).catch(() => {})} hitSlop={8}>
                    <Text style={styles.copy}>📋 Copy / share UPI ID</Text>
                  </TouchableOpacity>
                ) : null}
                {opened ? (
                  <TouchableOpacity style={styles.done} onPress={() => { onPaid && onPaid(); onClose(); }} activeOpacity={0.85}>
                    <Text style={styles.doneText}>✅ I've paid, mark it</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.note}>Money goes straight from your UPI app to them. VibeOut never touches it.</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 38 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  title: { fontFamily: F.display, color: C.text, fontSize: 24, marginTop: 4, marginBottom: 12 },
  label: { color: C.sub, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 16, marginBottom: 12 },
  app: { borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  appMain: { backgroundColor: C.lime, borderColor: C.lime, paddingVertical: 16, ...STICK },
  appText: { color: C.text, fontSize: 15, fontWeight: '900' },
  copy: { color: C.lime, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  done: { backgroundColor: C.green || '#7CFFB2', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  doneText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  note: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
