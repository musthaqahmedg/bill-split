import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { pickScreenshot, sendBug } from '../services/bugs';
import { screenName } from '../services/track';
import { C } from '../services/theme';

const KINDS = [
  { key: 'bug', label: '🐞 Bug', hint: 'What went wrong? What did you tap just before?' },
  { key: 'idea', label: '💡 Idea', hint: 'What would make this better?' },
];

// 📳 Opens when you shake the phone. Notes go to the team with the page you were on.
export default function BugSheet({ visible, onClose, screen }) {
  const [kind, setKind] = useState('bug');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setKind('bug');
      setText('');
      setPhoto(null);
    }
  }, [visible]);

  const k = KINDS.find((x) => x.key === kind);

  const addPhoto = async () => {
    try {
      const p = await pickScreenshot();
      if (p) setPhoto(p);
    } catch (e) {
      Alert.alert('Photos', e.message);
    }
  };

  const send = async () => {
    if (!text.trim()) return Alert.alert('Write a quick note', k.hint);
    setBusy(true);
    try {
      await sendBug({ kind, message: text, screen, photo });
      onClose();
      Alert.alert('Noted 📝', 'Thanks! It’s on our fix list.');
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
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
          <Text style={styles.title}>📳 Report</Text>
          <TouchableOpacity onPress={send} disabled={busy}>
            {busy ? <ActivityIndicator color={C.accentSoft} /> : <Text style={styles.send}>Send</Text>}
          </TouchableOpacity>
        </View>

        {screen ? <Text style={styles.where}>📍 On: {screenName(screen)}</Text> : null}

        <View style={styles.kinds}>
          {KINDS.map((x) => (
            <TouchableOpacity key={x.key} style={[styles.kind, kind === x.key && styles.kindOn]} onPress={() => setKind(x.key)}>
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
        <Text style={styles.note}>We also save the page and your phone model, so we can find it fast.</Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, padding: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cancel: { color: C.sub, fontSize: 16 },
  title: { color: C.text, fontSize: 17, fontWeight: '700' },
  send: { color: C.accentSoft, fontSize: 16, fontWeight: '700' },
  where: { color: C.faint, fontSize: 13, marginBottom: 10 },
  kinds: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3 },
  kind: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  kindOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  kindText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  kindTextOn: { color: C.text },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, color: C.text, fontSize: 16, minHeight: 140, textAlignVertical: 'top', marginTop: 12 },
  photo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginTop: 10 },
  thumb: { width: 40, height: 60, borderRadius: 6, marginRight: 10 },
  photoText: { color: C.sub, fontSize: 14 },
  note: { color: C.faint, fontSize: 12, marginTop: 12 },
});
