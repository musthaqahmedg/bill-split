import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { createPoll, getPolls, listMessages, onNewMessage, sendMessage, votePoll, postPayRequest } from '../services/chat';
import NewPollSheet from './NewPollSheet';
import PollCard from './PollCard';
import { getParty } from '../services/parties';
import { getProfile } from '../services/profile';
import { C } from '../services/theme';
import { useFriendsActive } from '../services/active';

const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// Colour for each friend's name, so the chat is easy to follow
const NAME_COLORS = ['#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#B3A1FF', '#FB923C', '#2DD4BF'];
const colorFor = (name) => NAME_COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % NAME_COLORS.length];

export default function PartyChatScreen({ partyId, onBack }) {
  const activeOf = useFriendsActive();
  const [party, setParty] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [myName, setMyName] = useState('');
  const [polls, setPolls] = useState({}); // poll id -> poll
  const [pollOpen, setPollOpen] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    getProfile().then((p) => setMyName((p && p.name) || '')).catch(() => {});
    getParty(partyId).then(setParty).catch(() => {});
    listMessages(partyId).then(setMessages).catch(() => setMessages([]));
    // Live: add new messages as they arrive (skip ones we already have)
    return onNewMessage(partyId, (m) => {
      setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
      if (m.kind === 'system') getParty(partyId).then(setParty).catch(() => {}); // e.g. someone paid
    });
  }, [partyId]);

  const me = party && (party.party_members || []).find((m) => m.name === 'Me');
  const token = party && party.share_token;

  const loadPolls = async () => {
    if (!token) return;
    try {
      const list = await getPolls(token);
      setPolls(Object.fromEntries(list.map((p) => [p.id, p])));
    } catch (e) {}
  };

  // Keep vote counts fresh while the chat is open
  useEffect(() => {
    if (!token) return;
    loadPolls();
    const t = setInterval(loadPolls, 5000);
    return () => clearInterval(t);
  }, [token, messages && messages.length]);

  const vote = async (pollId, option) => {
    if (!me) return;
    try {
      await votePoll({ token, memberId: me.id, pollId, option });
      loadPolls();
    } catch (e) {}
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      const saved = await sendMessage({ partyId, memberId: me && me.id, senderName: myName || 'Host', body });
      if (saved) setMessages((list) => (list.some((x) => x.id === saved.id) ? list : [...list, saved]));
    } catch (e) {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  // 💸 Settle-up card: everyone sees "Pay ₹X" on the invite link, you see who has paid
  const askToPay = () => {
    const owing = (party.party_members || []).filter((m) => m.name !== 'Me' && Number(m.share) > 0);
    if (party.split_mode === 'treat' || party.split_mode === 'free' || !owing.length) {
      return Alert.alert('Nothing to collect', 'This plan is a treat or has no shares to pay.');
    }
    Alert.alert('Ask everyone to pay? 💸', 'A pay card goes into the chat. Friends tap it to pay you by UPI.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            await postPayRequest(party.id);
            getParty(partyId).then(setParty).catch(() => {});
          } catch (e) {
            Alert.alert("Couldn't send", e.message);
          }
        },
      },
    ]);
  };

  const isMine = (m) => me && m.member_id === me.id && m.kind !== 'system';

  const renderItem = ({ item }) => {
    if (item.is_pay) return <PayCard party={party} />;
    if (item.kind === 'system') {
      return <Text style={styles.system}>{item.body}</Text>;
    }
    if (item.poll_id) {
      return <PollCard poll={polls[item.poll_id]} myId={me && me.id} sender={isMine(item) ? 'You' : item.sender_name} onVote={vote} />;
    }
    const mine = isMine(item);
    return (
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {!mine && <Text style={[styles.sender, { color: colorFor(item.sender_name) }]}>{item.sender_name}</Text>}
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{time(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>💬 {party ? party.title : 'Party chat'}</Text>
        {(() => {
          const on = party ? (party.party_members || []).filter((m) => m.name !== 'Me' && (activeOf(m) || {}).now) : [];
          return on.length ? (
            <Text style={[styles.sub, { color: C.green }]}>🟢 {on.map((m) => m.name).join(', ')} {on.length === 1 ? 'is' : 'are'} active now</Text>
          ) : (
            <Text style={styles.sub}>Friends join from your invite link. No app needed.</Text>
          );
        })()}
      </View>

      {messages === null ? (
        <ActivityIndicator color={C.accentSoft} style={styles.loading} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current && listRef.current.scrollToEnd({ animated: true })}
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyText}>Say hi and start planning!</Text>
              <Text style={styles.emptySub}>Who's bringing what? Where are we going?</Text>
            </View>
          }
        />
      )}

      <NewPollSheet
        visible={pollOpen}
        onClose={() => setPollOpen(false)}
        onCreate={(question, options) => createPoll({ token, memberId: me && me.id, question, options })}
      />

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.pollBtn} onPress={() => setPollOpen(true)} disabled={!token}>
          <Text style={styles.pollText}>📊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pollBtn} onPress={askToPay} disabled={!party}>
          <Text style={styles.pollText}>💸</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message the group…"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity style={[styles.sendBtn, !text.trim() && styles.sendOff]} onPress={send} disabled={!text.trim() || sending}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60 },
  header: { paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 8 },
  title: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  loading: { marginTop: 40 },
  list: { padding: 14, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.accent, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  sender: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  body: { color: C.text, fontSize: 16 },
  time: { color: 'rgba(255,255,255,0.55)', fontSize: 10, alignSelf: 'flex-end', marginTop: 3 },
  system: { alignSelf: 'center', color: C.sub, fontSize: 13, backgroundColor: C.cardHi, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 12, marginVertical: 6, overflow: 'hidden' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 44 },
  emptyText: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 8 },
  emptySub: { color: C.faint, fontSize: 14, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16, color: C.text, maxHeight: 120 },
  pollBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  pollText: { fontSize: 20 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

const inrPay = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
function PayCard({ party }) {
  if (!party) return null;
  const owing = (party.party_members || []).filter((m) => m.name !== 'Me' && Number(m.share) > 0);
  const paid = owing.filter((m) => m.paid_at);
  const total = owing.reduce((a, m) => a + Number(m.share), 0);
  const got = paid.reduce((a, m) => a + Number(m.share), 0);
  return (
    <View style={payStyles.card}>
      <Text style={payStyles.title}>💸 Settle up</Text>
      <Text style={payStyles.big}>{inrPay(got)} <Text style={payStyles.of}>of {inrPay(total)}</Text></Text>
      <View style={payStyles.track}>
        <View style={[payStyles.fill, { width: `${total ? (got / total) * 100 : 0}%` }]} />
      </View>
      {owing.map((m) => (
        <Text key={m.id} style={[payStyles.row, m.paid_at && payStyles.paid]}>
          {m.paid_at ? '✅' : '⏳'} {m.name} · {inrPay(m.share)}
        </Text>
      ))}
      <Text style={payStyles.hint}>Friends pay you by UPI from the invite link, then tap “I’ve paid”.</Text>
    </View>
  );
}
const payStyles = StyleSheet.create({
  card: { alignSelf: 'center', width: '88%', backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', borderRadius: 18, padding: 14, marginVertical: 8 },
  title: { color: C.green, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  big: { color: C.text, fontSize: 24, fontWeight: '800', marginTop: 4 },
  of: { color: C.faint, fontSize: 14, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: C.green },
  row: { color: C.sub, fontSize: 14, marginTop: 3 },
  paid: { color: C.text },
  hint: { color: C.faint, fontSize: 11, marginTop: 8 },
});
