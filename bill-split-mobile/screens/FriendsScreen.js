import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import ActiveTag from './ActiveTag';
import FriendButton from './FriendButton';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import { activeLabel } from '../services/active';
import { findUser, myFriends, removeFriend, respond } from '../services/friends';
import { C } from '../services/theme';

// 👫 Friends: find by phone / email, requests, and who's active
export default function FriendsScreen({ onBack }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(undefined); // undefined = not searched, null = no one
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => myFriends().then(setList).catch(() => setList([])), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const search = async () => {
    const text = q.trim();
    if (!text) return;
    if (!text.includes('@') && text.replace(/\D/g, '').length < 10) {
      return Alert.alert('Check the number', 'Type the full 10-digit phone number or an email.');
    }
    setSearching(true);
    try {
      setFound(await findUser(text));
    } catch (e) {
      Alert.alert("Couldn't search", e.message);
    } finally {
      setSearching(false);
    }
  };

  const act = async (fn) => {
    try {
      await fn();
      load();
    } catch (e) {
      Alert.alert('Something went wrong', e.message);
    }
  };

  const friends = (list || []).filter((f) => f.status === 'accepted');
  const incoming = (list || []).filter((f) => f.status === 'pending' && f.incoming);
  const sent = (list || []).filter((f) => f.status === 'pending' && !f.incoming);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Friends</Text>

      <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={list === null} onRefresh={load} tintColor={C.accentSoft} />}>
        <View style={styles.searchRow}>
          <TextInput
            inputAccessoryViewID={DONE_ID}
            style={styles.search}
            value={q}
            onChangeText={(t) => {
              setQ(t);
              setFound(undefined);
            }}
            placeholder="🔍 Phone number or email"
            placeholderTextColor={C.faint}
            keyboardAppearance="dark"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          <TouchableOpacity style={styles.findBtn} onPress={search}>
            <Text style={styles.findText}>Find</Text>
          </TouchableOpacity>
        </View>

        {searching && <ActivityIndicator color={C.accentSoft} style={styles.mt} />}
        {found === null && (
          <View style={styles.card}>
            <Text style={styles.name}>Not on Vibe Out yet</Text>
            <Text style={styles.faint}>Invite them, and you can add them once they join.</Text>
            <TouchableOpacity
              style={[styles.findBtn, styles.inviteBtn]}
              onPress={() => Share.share({ message: "Join me on Vibe Out 🎉 Plan parties, split bills, no fights. https://bill-split-flax.vercel.app" })}
            >
              <Text style={styles.findText}>📨 Invite</Text>
            </TouchableOpacity>
          </View>
        )}
        {found && (
          <View style={[styles.card, styles.row]}>
            <Avatar name={found.name} />
            <View style={styles.gap} />
            <Text style={[styles.name, styles.flex]}>{found.name}</Text>
            <FriendButton key={found.user_id} user={found} onChange={load} />
          </View>
        )}

        {incoming.length > 0 && (
          <>
            <Text style={styles.section}>REQUESTS ({incoming.length})</Text>
            {incoming.map((f) => (
              <View key={f.user_id} style={[styles.card, styles.row]}>
                <Avatar name={f.name} />
                <View style={styles.gap} />
                <Text style={[styles.name, styles.flex]}>{f.name}</Text>
                <TouchableOpacity style={styles.accept} onPress={() => act(() => respond(f.user_id, true))}>
                  <Text style={styles.findText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => act(() => respond(f.user_id, false))} hitSlop={8}>
                  <Text style={styles.decline}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <Text style={styles.section}>YOUR FRIENDS ({friends.length})</Text>
        {list === null ? null : friends.length === 0 ? (
          <Text style={styles.faint}>No friends yet. Find them by phone number or email above, or add them from a group 👥</Text>
        ) : (
          friends.map((f) => (
            <TouchableOpacity
              key={f.user_id}
              style={[styles.card, styles.row]}
              onLongPress={() =>
                Alert.alert(`Remove ${f.name}?`, undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => act(() => removeFriend(f.user_id)) },
                ])
              }
            >
              <Avatar name={f.name} on={(activeLabel(f.last_seen) || {}).now} />
              <View style={styles.gap} />
              <View style={styles.flex}>
                <Text style={styles.name}>{f.name}</Text>
                <ActiveTag status={activeLabel(f.last_seen)} />
              </View>
            </TouchableOpacity>
          ))
        )}
        {friends.length > 0 && <Text style={styles.hint}>Hold a friend to remove them.</Text>}

        {sent.length > 0 && (
          <>
            <Text style={styles.section}>SENT</Text>
            {sent.map((f) => (
              <View key={f.user_id} style={[styles.card, styles.row]}>
                <Avatar name={f.name} />
                <View style={styles.gap} />
                <Text style={[styles.name, styles.flex]}>{f.name}</Text>
                <TouchableOpacity onPress={() => act(() => removeFriend(f.user_id))}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

export function Avatar({ name, on, size = 40 }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{(name || '?')[0].toUpperCase()}</Text>
      {on ? <View style={styles.onDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 16 },
  back: { color: C.accentSoft, fontSize: 17 },
  title: { fontSize: 34, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 12 },
  searchRow: { flexDirection: 'row' },
  search: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, fontSize: 16, color: C.text },
  findBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  findText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  inviteBtn: { alignSelf: 'flex-start', marginLeft: 0, marginTop: 10, paddingVertical: 8 },
  mt: { marginTop: 12 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gap: { width: 12 },
  name: { color: C.text, fontSize: 16, fontWeight: '600' },
  faint: { color: C.faint, fontSize: 13, marginTop: 4 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 22, marginBottom: 2 },
  accept: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, marginRight: 10 },
  decline: { color: C.faint, fontSize: 16 },
  cancel: { color: C.faint, fontSize: 13, fontWeight: '600' },
  hint: { color: C.faint, fontSize: 11, marginTop: 8 },
  avatar: { backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.text, fontWeight: '700' },
  onDot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg },
});
