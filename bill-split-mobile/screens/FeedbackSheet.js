import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { FORM_URL, KINDS, pickScreenshot, sendFeedback } from '../services/feedback';
import { C } from '../services/theme';

// 📝 Send feedback / report a bug. Opens from Profile, or by shaking the phone 📳
export default function FeedbackSheet({ visible, onClose, screen, startKind = 'bug', shaken }) {
  const [kind, setKind] = useState(startKind);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setKind(startKind);
      setText('');
      setPhoto(null);
    }
  }, [visible, startKind]);

  const k = KINDS.find((x) => x.key === kind) || KINDS[0];

  const addPhoto = async () => {
    try {
      const p = await pickScreenshot();
      if (p) setPhoto(p);
    } catch (e) {
      Alert.alert('Photos', e.message);
    }
  };

  const send = async () => {
    if (!text.trim()) return Alert.alert('Tell us a little', k.hint);
    setBusy(true);
    try {
      await sendFeedback({ kind, message: text, screen, photo });
      onClose();
      Alert.alert('Thank you 💜', kind === 'bug' ? "We're on it. You'll see the fix in a new update." : 'We read every single one.');
    } catch (e) {
      Alert.alert("Couldn't send", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Feedback</Text>
          <TouchableOpacity onPress={send} disabled={busy}>
            {busy ? <ActivityIndicator color={C.accentSoft} /> : <Text style={styles.send}>Send</Text>}
          </TouchableOpacity>
        </View>

        {shaken ? <Text style={styles.shake}>📳 You shook your phone. Something not right?</Text> : null}

        <View style={styles.kinds}>
          {KINDS.map((x) => (
            <TouchableOpacity key={x.key} style={[styles.kind, kind === x.key && styles.kindOn]} onPress={() => setKind(x.key)}>
              <Text style={styles.kindEmoji}>{x.emoji}</Text>
              <Text style={[styles.kindText, kind === x.key && styles.kindTextOn]}>{x.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={k.hint}
          placeholderTextColor={C.faint}
          multiline
          maxLength={2000}
          autoFocus
        />

        <TouchableOpacity style={styles.photo} onPress={photo ? () => setPhoto(null) : addPhoto}>
          {photo ? (
            <>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              <Text style={styles.photoText}>Screenshot added · tap to remove</Text>
            </>
          ) : (
            <Text style={styles.photoText}>📸 Add a screenshot (optional)</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>
          {screen ? `We'll also send the page you were on and your phone model, to find bugs faster.` : 'We also send your phone model, to find bugs faster.'}
        </Text>

        {FORM_URL ? (
          <TouchableOpacity onPress={() => Linking.openURL(FORM_URL)}>
            <Text style={styles.form}>📋 Open the full feedback form</Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, padding: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cancel: { color: C.sub, fontSize: 16 },
  title: { color: C.text, fontSize: 17, fontWeight: '700' },
  send: { color: C.accentSoft, fontSize: 16, fontWeight: '700' },
  shake: { color: C.amber, fontSize: 13, marginBottom: 12 },
  kinds: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3 },
  kind: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  kindOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  kindEmoji: { fontSize: 15, marginRight: 6 },
  kindText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  kindTextOn: { color: C.text },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, color: C.text, fontSize: 16,
    minHeight: 140, textAlignVertical: 'top', marginTop: 14,
  },
  photo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginTop: 10 },
  thumb: { width: 40, height: 60, borderRadius: 6, marginRight: 10 },
  photoText: { color: C.sub, fontSize: 14 },
  note: { color: C.faint, fontSize: 12, marginTop: 12, lineHeight: 17 },
  form: { color: C.accentSoft, fontSize: 15, fontWeight: '600', marginTop: 18, textAlign: 'center' },
});
