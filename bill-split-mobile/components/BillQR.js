import { Modal, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from './QRCode';
import { C, F } from '../services/theme';

// 📲 "Show QR to the table": friends scan with their camera, tap their name, see their share
// (or tick what they had) and pay with UPI. No app needed.
export const billUrl = (token) => `https://bill-split-flax.vercel.app/b/${token}`;

export default function BillQR({ visible, token, title, byItems, onClose }) {
  if (!token) return null;
  const url = billUrl(token);
  const share = () =>
    Share.share({ message: `🌙 ${title || 'Our night out'}: see your share and pay here 👇\n${url}` }).catch(() => {});
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>PAY YOUR SHARE</Text>
          <Text style={styles.title} numberOfLines={2}>{title || 'Our night out'}</Text>
          <View style={styles.qrBox}>
            <QRCode value={url} size={210} />
          </View>
          <Text style={styles.steps}>📷 Scan with your camera → tap your name → 💸 Pay with UPI</Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
