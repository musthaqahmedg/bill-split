import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { getThread, sendSupport, watchThread } from '../services/support';
import { C } from '../services/theme';

const QUICK = ['🧾 The scan didn’t work', '💸 Question about paying', '🐞 Something’s broken', '🍽️ I own a restaurant'];
const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// 💬 Chat with us. thread = { userId, name } when the team opens someone's chat from the inbox
export default function SupportChatScreen({ onBack, thread }) {
  const team = !!thread;
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef(null);

  useEffect(() => {
    let stop = null;
    let alive = true;
    getThread(thread && thread.userId).then((m) => alive && setMsgs(m)).catch(() => alive && setMsgs([]));
    watchThread(thread && thread.userId, (m) =>
      setMsgs((old) => (old && old.find((x) => x.id === m.id) ? old : [...(old || []), m]))
    ).then((s) => (alive ? (stop = s) : s()));
    return () => {
      alive = false;
      if (stop) stop();
    };
  }, [thread && thread.userId]);

  const send = async (body) => {
    const b = (body || text).trim();
    if (!b) return;
    setBusy(true);
    try {
      await sendSupport(b, thread && thread.userId);
      setText('');
      const m = await getThread(thread && thread.userId);
      setMsgs(m);
    } catch (e) {
      Alert.alert("Couldn't send", e.message);
    } finally {
      setBusy(false);
    }
  };

  const mine = (m) => (team ? m.from_team : !m.from_team);

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.top}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.head}>
          <Text style={styles.title}>{team ? thread.name : 'Chat with us'}</Text>
          <Text style={styles.sub}>{team ? 'Support chat' : '🟢 Usually replies within a few hours'}</Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {msgs === null ? (
        <ActivityIndicator color={C.accentSoft} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: true })}
        >
          {!team ? (
            <View style={[styles.bubble, styles.theirs]}>
              <Text style={styles.text}>Hey 👋 We’re Musthaq & Gautham, the team behind the app. Ask us anything, report a problem, or share an idea. We read every message 💜</Text>
            </View>
          ) : null}
          {msgs.map((m) => (
            <View key={m.id} style={[styles.bubble, mine(m) ? styles.mine : styles.theirs]}>
              {!mine(m) && !team ? <Text style={styles.from}>Team</Text> : null}
              <Text style={[styles.text, mine(m) && styles.textMine]}>{m.body}</Text>
              <Text style={[styles.time, mine(m) && styles.timeMine]}>{time(m.created_at)}</Text>
            </View>
          ))}
          {!team && msgs.length === 0 ? (
            <View style={styles.quick}>
              {QUICK.map((q) => (
                <TouchableOpacity key={q} style={styles.chip} onPress={() => send(q)} disabled={busy}>
                  <Text style={styles.chipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <View style={styles.bar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={team ? 'Reply…' : 'Type your message…'}
          placeholderTextColor={C.faint}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity style={[styles.send, !text.trim() && styles.sendOff]} onPress={() => send()} disabled={busy || !text.trim()}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingTop: 56 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  back: { color: C.accentSoft, fontSize: 16, width: 50 },
  head: { alignItems: 'center' },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  list: { padding: 14, paddingBottom: 20 },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 13, marginBottom: 8 },
  theirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 6 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.accent, borderBottomRightRadius: 6 },
  from: { color: C.accentSoft, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  text: { color: C.text, fontSize: 15, lineHeight: 20 },
  textMine: { color: '#fff' },
  time: { color: C.faint, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.7)' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
  chipText: { color: C.sub, fontSize: 13 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, color: C.text, fontSize: 15, maxHeight: 110 },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
