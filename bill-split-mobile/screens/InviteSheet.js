import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from '../components/QRCode';
import { C, F } from '../services/theme';

// 📨 Invite the squad (Final UX): a QR code friends can scan at the table, the link for WhatsApp groups,
// or add people straight into the plan.
export default function InviteSheet({ visible, onClose, party, link, onShare, onAddPeople }) {
  if (!party) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>INVITE THE SQUAD</Text>
          <Text style={styles.title}>{party.title}</Text>
          <View style={styles.qrCard}>
            <QRCode value={link} size={210} />
          </View>
          <Text style={styles.scan}>📷 Friends scan this with their camera to join. No app needed.</Text>
          <Text style={styles.link} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>

          <TouchableOpacity style={styles.primary} onPress={onShare} activeOpacity={0.85}>
            <Text style={styles.primaryText}>💬 SHARE THE LINK</Text>
          </TouchableOpacity>
          {onAddPeople ? (
            <TouchableOpacity style={styles.secondary} onPress={onAddPeople} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>👥 Add people</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.note}>🔒 Only people with this link or code can see the plan. Anyone who joins shows up in the squad.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 40, alignItems: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, letterSpacing: 1.5 },
  title: { fontFamily: F.display, color: C.text, fontSize: 22, marginTop: 4, textAlign: 'center' },
  qrCard: { backgroundColor: '#fff', borderRadius: 22, padding: 10, marginTop: 16, borderWidth: 4, borderColor: C.lime },
  scan: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 12 },
  link: { color: C.faint, fontSize: 12, marginTop: 4, maxWidth: '90%' },
  primary: { alignSelf: 'stretch', backgroundColor: C.lime, borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 16, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  primaryText: { color: C.onLime, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  secondary: { alignSelf: 'stretch', borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: C.text, fontSize: 15, fontWeight: '800' },
  note: { color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
