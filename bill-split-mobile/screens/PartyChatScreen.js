import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { REACTIONS, createPoll, getPolls, getReactions, listMessages, onNewMessage, react, sendMessage, votePoll, postPayRequest } from '../services/chat';
import FloatUp from './FloatUp';
import NewPollSheet from './NewPollSheet';
import PollCard from './PollCard';
import { getParty } from '../services/parties';
import { getProfile } from '../services/profile';
import { C, F } from '../services/theme';
import { useFriendsActive } from '../services/active';

const time = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

// Colour for each friend's name, so the chat is easy to follow
const NAME_COLORS = ['#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#C6FF3D', '#FB923C', '#2DD4BF'];
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
    try {
      const rs = await getReactions(token);
      const byMsg = {};
      rs.forEach((r) => {
        (byMsg[r.message_id] = byMsg[r.message_id] || []).push(r);
      });
      setReactions(byMsg);
    } catch (e) {}
  };

  // 😂 Long-press a message → pick a reaction → emojis float up
  const [reactions, setReactions] = useState({});
  const [picker, setPicker] = useState(null); // message id showing the reaction bar
  const floater = useRef(null);
  const doReact = async (messageId, emoji) => {
    setPicker(null);
    if (!me) return;
    try {
      const added = await react({ token, memberId: me.id, messageId, emoji });
      if (added && floater.current) floater.current.burst(emoji);
      loadPolls();
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

  const send = async (quick) => {
    const body = (typeof quick === 'string' ? quick : text).trim();
    if (!body || sending) return;
    setSending(true);
    if (typeof quick !== 'string') setText('');
    try {
      const saved = await sendMessage({ partyId, memberId: me && me.id, senderName: myName || 'Host', body });
      if (saved) setMessages((list) => (list.some((x) => x.id === saved.id) ? list : [...list, saved]));
    } catch (e) {
      if (typeof quick !== 'string') setText(body);
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
    const rs = reactions[item.id] || [];
    const counts = REACTIONS.map((e) => [e, rs.filter((r) => r.emoji === e).length]).filter(([, n]) => n);
    const myR = me && rs.find((r) => r.member_id === me.id);
    return (
      <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
        {picker === item.id ? (
          <View style={[styles.picker, mine ? { alignSelf: 'flex-end' } : null]}>
            {REACTIONS.map((e) => (
              <TouchableOpacity key={e} onPress={() => doReact(item.id, e)} style={[styles.pickBtn, myR && myR.emoji === e && styles.pickOn]} hitSlop={4}>
                <Text style={styles.pickEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <TouchableOpacity activeOpacity={0.85} onLongPress={() => setPicker(picker === item.id ? null : item.id)} delayLongPress={250} style={[styles.bubble, mine ? styles.mine : styles.theirs, { maxWidth: '100%', alignSelf: 'auto' }]}>
          {!mine && <Text style={[styles.sender, { color: colorFor(item.sender_name) }]}>{item.sender_name}</Text>}
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{time(item.created_at)}</Text>
        </TouchableOpacity>
        {counts.length ? (
          <View style={[styles.reacts, mine ? { alignSelf: 'flex-end' } : null]}>
            {counts.map(([e, n]) => (
              <TouchableOpacity key={e} style={[styles.reactChip, myR && myR.emoji === e && styles.reactMine]} onPress={() => doReact(item.id, e)}>
                <Text style={styles.reactText}>{e}{n > 1 ? ` ${n}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
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
        <Text style={styles.vanish}>🔒 Only people in this plan can read it · 🔥 disappears 30 days after the last message</Text>
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

      {/* 🏷️ Quick sticker replies (v14) */}
      <View style={styles.stickers}>
        {[['HOT! 🔥', C.lime], ['OK! 👌', C.cyan], ['THANKS 🙏', '#FFB347'], ["THAT'S LIT! 🤟", C.pink]].map(([t, col]) => (
          <TouchableOpacity key={t} style={[styles.stick, { backgroundColor: col }]} onPress={() => send(t)} disabled={sending} activeOpacity={0.8}>
            <Text style={styles.stickText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
      <FloatUp ref={floater} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', backgroundColor: C.cardHi, borderRadius: 22, paddingHorizontal: 6, paddingVertical: 4, marginBottom: 4, borderWidth: 1, borderColor: C.border },
  pickBtn: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 14 },
  pickOn: { backgroundColor: C.accent + '55' },
  pickEmoji: { fontSize: 24 },
  reacts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: -2, marginBottom: 6 },
  reactChip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  reactMine: { borderColor: C.accentSoft },
  reactText: { color: C.text, fontSize: 12 },
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60 },
  header: { paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 8 },
  vanish: { color: C.faint, fontSize: 11, marginTop: 4 },
  title: { fontFamily: F.display, color: C.text, fontSize: 18 },
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
  stickers: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 8, backgroundColor: C.bg },
  stick: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center', marginHorizontal: 3, transform: [{ rotate: '-2deg' }], borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  stickText: { fontFamily: F.pixel, color: C.onLime, fontSize: 10 },
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
