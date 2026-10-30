import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, F } from '../services/theme';

// 👤 Guests: a friendly "save your account" card (full page, or a small banner with `small`)
export default function GuestGate({ emoji = '🔒', title = 'Save your account', body, onSave, onBack, small = false }) {
  if (small) {
    return (
      <TouchableOpacity style={styles.banner} onPress={onSave} activeOpacity={0.85}>
        <Text style={styles.bannerEmoji}>👤</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>You're trying it as a guest</Text>
          <Text style={styles.bannerSub}>{body || 'Save your account so you never lose your bills'}</Text>
        </View>
        <Text style={styles.bannerBtn}>Save</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.page}>
      {onBack ? (
        <TouchableOpacity style={styles.back} onPress={onBack} hitSlop={10}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={onSave} activeOpacity={0.85}>
        <Text style={styles.buttonText}>🔒 Save my account</Text>
      </TouchableOpacity>
      <Text style={styles.note}>Takes 20 seconds. Everything you made as a guest stays.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  back: { position: 'absolute', top: 58, left: 20 },
  backText: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  emoji: { fontSize: 56 },
  title: { fontFamily: F.display, color: C.text, fontSize: 21, marginTop: 14, textAlign: 'center' },
  body: { color: C.sub, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  button: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 26, marginTop: 24, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  buttonText: { color: C.onLime, fontSize: 16, fontWeight: '800' },
  note: { color: C.faint, fontSize: 13, marginTop: 12, textAlign: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.lime, borderRadius: 18, padding: 12, marginBottom: 14 },
  bannerEmoji: { fontSize: 24, marginRight: 10 },
  bannerTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  bannerSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  bannerBtn: { color: C.onLime, backgroundColor: C.lime, borderRadius: 12, overflow: 'hidden', paddingVertical: 6, paddingHorizontal: 12, fontWeight: '800', fontSize: 13, marginLeft: 8, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
});
