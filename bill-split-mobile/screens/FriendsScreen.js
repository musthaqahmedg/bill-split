import * as Contacts from 'expo-contacts/legacy';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import FriendButton from './FriendButton';
import Pulse from './Pulse';
import { activeLabel } from '../services/active';
import { findUser, myFriends, removeFriend, respond } from '../services/friends';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const INVITE = 'Join me on Vibe Out 🎉 Plan parties, split bills, no fights → https://bill-split-flax.vercel.app';

// 👫 Your circle: who's vibing now, all friends, requests, and ＋ Add friends
export default function FriendsScreen({ onBack, startAdding = false }) {
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('now');
  const [adding, setAdding] = useState(startAdding);

  const load = useCallback(() => myFriends().then((l) => setList(l || [])).catch(() => setList([])), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const all = list || [];
  const friends = all.filter((f) => f.status === 'accepted').map((f) => ({ ...f, st: activeLabel(f.last_seen) }));
  const vibing = friends.filter((f) => f.st && f.st.now);
  const recent = friends.filter((f) => f.st && !f.st.now);
  const incoming = all.filter((f) => f.status === 'pending' && f.incoming);
  const sent = all.filter((f) => f.status === 'pending' && !f.incoming);

  useEffect(() => {
    if (list && incoming.length && tab === 'now' && !vibing.length) setTab('requests');
  }, [list]);

  const act = async (fn) => {
    try {
      await fn();
      load();
    } catch (e) {
      Alert.alert('Something went wrong', e.message);
    }
  };

  const TABS = [
    ['now', `🟢 Vibing${vibing.length ? ` ${vibing.length}` : ''}`],
    ['all', `👫 Circle${friends.length ? ` ${friends.length}` : ''}`],
    ['requests', `📨 Requests${incoming.length ? ` ${incoming.length}` : ''}`],
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addText}>＋ Add friends</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Your circle</Text>

      <View style={styles.tabs}>
        {TABS.map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={list === null} onRefresh={load} tintColor={C.accentSoft} />} contentContainerStyle={styles.pad}>
        {tab === 'now' && (
          <>
            {vibing.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🌙</Text>
                <Text style={styles.emptyTitle}>Nobody’s vibing right now</Text>
                <Text style={styles.faint}>{friends.length ? 'Your friends show up here when they open Vibe Out.' : 'Add friends to see when they’re around.'}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {vibing.map((f) => (
                  <View key={f.user_id} style={styles.tile}>
                    <Pulse name={f.name} on size={64} />
                    <Text style={styles.tileName} numberOfLines={1}>{f.name.split(' ')[0]}</Text>
                    <Text style={styles.tileNow}>Active now</Text>
                  </View>
                ))}
              </View>
            )}
            {recent.length > 0 && (
              <>
                <Text style={styles.section}>RECENTLY ACTIVE</Text>
                {recent.map((f) => (
                  <Row key={f.user_id} f={f} />
                ))}
              </>
            )}
          </>
        )}

        {tab === 'all' && (
          <>
            {friends.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>👫</Text>
                <Text style={styles.emptyTitle}>Your circle is empty</Text>
                <TouchableOpacity style={[styles.addBtn, styles.mt]} onPress={() => setAdding(true)}>
                  <Text style={styles.addText}>＋ Add friends</Text>
                </TouchableOpacity>
              </View>
            ) : (
              friends.map((f) => (
                <Row
                  key={f.user_id}
                  f={f}
                  onLongPress={() =>
                    Alert.alert(`Remove ${f.name}?`, undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => act(() => removeFriend(f.user_id)) },
                    ])
                  }
                />
              ))
            )}
            {friends.length > 0 && <Text style={styles.hint}>Hold a friend to remove them.</Text>}
          </>
        )}

        {tab === 'requests' && (
          <>
            {incoming.length === 0 && sent.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📨</Text>
                <Text style={styles.emptyTitle}>No requests</Text>
              </View>
            )}
            {incoming.map((f) => (
              <View key={f.user_id} style={styles.row}>
                <Pulse name={f.name} size={44} />
                <View style={styles.rowText}>
                  <Text style={styles.name}>{f.name}</Text>
                  <Text style={styles.faint}>wants to join your circle</Text>
                </View>
                <TouchableOpacity style={styles.accept} onPress={() => act(() => respond(f.user_id, true))}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => act(() => respond(f.user_id, false))} hitSlop={8}>
                  <Text style={styles.decline}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {sent.length > 0 && <Text style={styles.section}>SENT</Text>}
            {sent.map((f) => (
              <View key={f.user_id} style={styles.row}>
                <Pulse name={f.name} size={44} />
                <View style={styles.rowText}>
                  <Text style={styles.name}>{f.name}</Text>
                  <Text style={styles.faint}>Waiting for them…</Text>
                </View>
                <TouchableOpacity onPress={() => act(() => removeFriend(f.user_id))}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <AddSheet visible={adding} onClose={() => { setAdding(false); load(); }} />
    </View>
  );
}

function Row({ f, onLongPress }) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={onLongPress ? 0.7 : 1} onLongPress={onLongPress}>
      <Pulse name={f.name} on={f.st && f.st.now} size={44} />
      <View style={styles.rowText}>
        <Text style={styles.name}>{f.name}</Text>
        <Text style={[styles.faint, f.st && f.st.now && styles.green]}>{f.st ? f.st.text : 'Not active recently'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ＋ Add friends: search by number / email, or see which contacts are on Vibe Out
function AddSheet({ visible, onClose }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [onApp, setOnApp] = useState(null); // contacts already on Vibe Out
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQ('');
    setFound(undefined);
  }, [visible]);

  const search = async () => {
    const text = q.trim();
    if (!text.includes('@') && text.replace(/\D/g, '').length < 10) {
      return Alert.alert('Check the number', 'Type the full 10-digit phone number or an email.');
    }
    setBusy(true);
    try {
      setFound(await findUser(text));
    } catch (e) {
      Alert.alert("Couldn't search", e.message);
    } finally {
      setBusy(false);
    }
  };

  // Look through phone contacts for people already on Vibe Out
  const scanContacts = async () => {
    setScanning(true);
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setScanning(false);
        return Alert.alert('Contacts are off', 'Allow contacts in Settings to find friends, or search by number above.');
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails] });
      const byKey = {};
      for (const c of data || []) {
        for (const p of c.phoneNumbers || []) {
          const d = String(p.number || '').replace(/\D/g, '');
          if (d.length >= 10) byKey[d.slice(-10)] = c.name;
        }
        for (const e of c.emails || []) if (e.email) byKey[e.email.trim().toLowerCase()] = c.name;
      }
      const keys = Object.keys(byKey);
      const seen = {};
      for (let i = 0; i < keys.length; i += 300) {
        const { data: rows } = await supabase.rpc('app_users_in', { p_keys: keys.slice(i, i + 300) });
        for (const r of rows || []) if (!seen[r.user_id]) seen[r.user_id] = { ...r, contactName: byKey[r.key] };
      }
      setOnApp(Object.values(seen));
    } catch (e) {
      Alert.alert("Couldn't read contacts", e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheetTop}>
          <Text style={styles.sheetTitle}>Add friends</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.searchRow}>
            <TextInput
              style={styles.search}
              value={q}
              onChangeText={(t) => {
                setQ(t);
                setFound(undefined);
              }}
              placeholder="Phone number or email"
              placeholderTextColor={C.faint}
              keyboardAppearance="dark"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <TouchableOpacity style={styles.findBtn} onPress={search}>
              <Text style={styles.addText}>Find</Text>
            </TouchableOpacity>
          </View>
          {busy && <ActivityIndicator color={C.accentSoft} style={styles.mt} />}
          {found === null && (
            <View style={styles.notFound}>
              <Text style={styles.name}>Not on Vibe Out yet</Text>
              <Text style={styles.faint}>Send them an invite. You can add them once they join.</Text>
              <TouchableOpacity style={[styles.findBtn, styles.inviteBtn]} onPress={() => Share.share({ message: INVITE })}>
                <Text style={styles.addText}>📨 Invite</Text>
              </TouchableOpacity>
            </View>
          )}
          {found && (
            <View style={styles.row}>
              <Pulse name={found.name} size={44} />
              <Text style={[styles.name, styles.rowText]}>{found.name}</Text>
              <FriendButton key={found.user_id} user={found} />
            </View>
          )}

          <Text style={styles.section}>FROM YOUR CONTACTS</Text>
          {onApp === null ? (
            <TouchableOpacity style={styles.scanBtn} onPress={scanContacts} disabled={scanning}>
              <Text style={styles.scanTitle}>{scanning ? 'Looking…' : '📇 Find friends from contacts'}</Text>
              <Text style={styles.faint}>We check which of your contacts already use Vibe Out.</Text>
            </TouchableOpacity>
          ) : onApp.length === 0 ? (
            <Text style={styles.faint}>None of your contacts are on Vibe Out yet. Invite them 👇</Text>
          ) : (
            onApp.map((u) => (
              <View key={u.user_id} style={styles.row}>
                <Pulse name={u.contactName} size={44} />
                <Text style={[styles.name, styles.rowText]} numberOfLines={1}>{u.contactName}</Text>
                <FriendButton user={u} />
              </View>
            ))
          )}

          <TouchableOpacity style={styles.shareRow} onPress={() => Share.share({ message: INVITE })}>
            <Text style={styles.scanTitle}>📨 Invite friends to Vibe Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 16 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 17 },
  addBtn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14, alignSelf: 'center' },
  addText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  title: { fontSize: 34, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  tabTextOn: { color: C.text },
  pad: { paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '31%', alignItems: 'center', backgroundColor: 'rgba(52,211,153,0.07)', borderRadius: 18, paddingVertical: 18, marginBottom: 10 },
  tileName: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 10 },
  tileNow: { color: C.green, fontSize: 11, fontWeight: '600', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 20, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  rowText: { flex: 1, marginLeft: 12 },
  name: { color: C.text, fontSize: 16, fontWeight: '600' },
  faint: { color: C.faint, fontSize: 13, marginTop: 2, textAlign: 'left' },
  green: { color: C.green, fontWeight: '600' },
  accept: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, marginRight: 10 },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  decline: { color: C.faint, fontSize: 16 },
  cancel: { color: C.faint, fontSize: 13, fontWeight: '600' },
  hint: { color: C.faint, fontSize: 11, marginTop: 10 },
  mt: { marginTop: 12 },
  sheet: { flex: 1, backgroundColor: C.bg, padding: 18 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { color: C.text, fontSize: 24, fontWeight: '700' },
  done: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  searchRow: { flexDirection: 'row' },
  search: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, fontSize: 16, color: C.text },
  findBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  notFound: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginTop: 10 },
  inviteBtn: { alignSelf: 'flex-start', marginLeft: 0, marginTop: 10, paddingVertical: 8 },
  scanBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14 },
  scanTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  shareRow: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginTop: 16, alignItems: 'center' },
});
