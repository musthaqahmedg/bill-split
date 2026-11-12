import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ContactPicker from './ContactPicker';
import KeyboardDone from './KeyboardDone';
import { addMembers, deleteGroup, getGroup, removeMember, renameGroup, setAdmin } from '../services/groups';
import { EMOJIS } from './GroupsScreen';
import { kindOf } from '../services/partyKinds';
import LoadError from '../components/LoadError';
import { C, F } from '../services/theme';
import ActiveTag from './ActiveTag';
import GroupMoney from './GroupMoney';
import FriendButton from './FriendButton';
import { appUsers, lookupKeys } from '../services/friends';
import { useFriendsActive } from '../services/active';

export default function GroupScreen({ groupId, onBack, onDeleted, onPlan, onOpenPlan, mode = 'plan', onAddExpense, onEditExpense }) {
  const split = mode === 'split'; // ✍️ Manual Split: money first, plans hidden
  const [expCount, setExpCount] = useState(0);
  const scrollRef = useRef(null);
  const addY = useRef(null); // where "Add people" sits, so typing a name scrolls it above the keyboard
  const showAdd = () => setTimeout(() => {
    if (addY.current != null && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, addY.current - 8), animated: true });
  }, 250);
  const nameRef = useRef(null);
  const [editing, setEditing] = useState(false); // ✏️ rename the group / change its emoji
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('👥');
  const activeOf = useFriendsActive();
  const [loadErr, setLoadErr] = useState(false);
  const [group, setGroup] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);
  const [onApp, setOnApp] = useState({}); // members who are on Vibe Out
  useEffect(() => {
    if (group) appUsers(group.group_members || []).then(setOnApp).catch(() => {});
  }, [group]);

  const load = async () => {
    try {
      setGroup(await getGroup(groupId));
      setLoadErr(false);
    } catch (e) {
      if (!group) setLoadErr(true);
      else Alert.alert('Error', e.message);
    }
  };

  useEffect(() => { load(); }, [groupId]);

  if (!group && loadErr) return <LoadError what="this group" onRetry={() => { setLoadErr(false); load(); }} onBack={onBack} />;
  if (!group) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={C.accentSoft} />
      </View>
    );
  }

  const members = group.group_members || [];
  const taken = (n) => members.some((m) => m.name.toLowerCase() === n.toLowerCase());

  const addOne = async () => {
    const n = name.trim();
    if (!n) return;
    if (taken(n)) return Alert.alert('Already in the group', n);
    const extra = contact.trim();
    const person = { name: n };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)) person.email = extra.toLowerCase();
    else if (extra.replace(/\D/g, '').length >= 10) person.phone = extra;
    try {
      await addMembers(group.id, [person]);
      setName('');
      setContact('');
      await load();
      setTimeout(() => nameRef.current && nameRef.current.focus(), 50);
    } catch (e) {
      Alert.alert("Couldn't add", e.message);
    }
  };

  const toggleAdmin = async (m) => {
    try {
      await setAdmin(m.id, !m.is_admin);
      load();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };

  const remove = (m) =>
    Alert.alert(`Remove ${m.name}?`, expCount ? 'Their past expenses stay, so balances stay correct.' : 'They will be taken out of this group.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeMember(m.id); load(); } },
    ]);

  const confirmDelete = () =>
    Alert.alert('Delete this group?', expCount ? `Its ${expCount} ${expCount === 1 ? 'expense is' : 'expenses are'} deleted too. Plans made with it are kept.` : 'Plans made with it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGroup(group.id); onDeleted(); } },
    ]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      {editing ? (
        <View style={styles.editBox}>
          <TextInput style={styles.input} value={newName} onChangeText={setNewName} maxLength={60} autoFocus
            placeholder="Group name" placeholderTextColor={C.faint} keyboardAppearance="dark" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} style={[styles.emo, newEmoji === e && styles.emoOn]} onPress={() => setNewEmoji(e)}>
                <Text style={styles.emoText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.editRow}>
            <TouchableOpacity style={styles.editCancel} onPress={() => setEditing(false)}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editSave, !newName.trim() && styles.off]}
              disabled={!newName.trim()}
              onPress={async () => {
                try {
                  await renameGroup(group.id, newName.trim(), newEmoji);
                  setEditing(false);
                  load();
                } catch (e) {
                  Alert.alert("Couldn't save", e.message);
                }
              }}
            >
              <Text style={styles.editSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.titleRow}>
          <Text style={[styles.title, { flex: 1 }]}>{group.emoji} {group.name}</Text>
          <TouchableOpacity hitSlop={10} accessibilityLabel="Edit group name" onPress={() => { setNewName(group.name); setNewEmoji(group.emoji || '👥'); setEditing(true); }}>
            <Text style={styles.editLink}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.sub}>{members.length} {members.length === 1 ? 'member' : 'members'} + you (admin)</Text>

      <ScrollView
        ref={scrollRef}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accentSoft} />}
      >
        {split ? (
          <GroupMoney
            group={group}
            onCount={setExpCount}
            onAdd={(people) => onAddExpense && onAddExpense(group, people, null)}
            onEdit={(x, people) => onEditExpense && onEditExpense(group, people, x)}
          />
        ) : (
          <TouchableOpacity style={[styles.planBtn, !members.length && styles.off]} disabled={!members.length} onPress={() => onPlan(group)}>
            <Text style={styles.planText}>🎉 Plan something with {group.name}</Text>
            <Text style={styles.planSub}>Everyone gets added in one tap</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, split && { marginTop: 18 }]}>Members</Text>
        <View style={styles.memberCard}>
          <View style={styles.memberRow}>
            <Text style={styles.memberName}>You</Text>
            <Text style={styles.adminTag}>⭐ Admin</Text>
          </View>
          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.flex}>
                <Text style={styles.memberName}>{m.name}</Text>
                {m.phone || m.email ? <Text style={styles.memberSub}>{m.phone || m.email}</Text> : null}
                <ActiveTag status={activeOf(m)} />
              </View>
              {(() => {
                const u = lookupKeys(m).map((k) => onApp[k]).find(Boolean);
                return u ? <FriendButton key={u.user_id + (u.status || '')} user={u} /> : null;
              })()}
              <TouchableOpacity onPress={() => toggleAdmin(m)}>
                <Text style={m.is_admin ? styles.adminTag : styles.makeAdmin}>{m.is_admin ? '⭐ Admin' : 'Make admin'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(m)} hitSlop={8}>
                <Text style={styles.removeX}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View onLayout={(e) => { addY.current = e.nativeEvent.layout.y; }}>
          <Text style={styles.label}>Add people</Text>
        </View>
        <TouchableOpacity style={styles.contactsBtn} onPress={() => setContactsOpen(true)}>
          <Text style={styles.contactsText}>📇 Add from contacts</Text>
        </TouchableOpacity>
        <TextInput ref={nameRef} style={styles.input} value={name} onChangeText={setName} maxLength={60} onFocus={showAdd}
          placeholder="Friend's name" placeholderTextColor={C.faint} keyboardAppearance="dark"
          returnKeyType="done" blurOnSubmit={false} onSubmitEditing={addOne} />
        <TextInput style={[styles.input, styles.small]} value={contact} onChangeText={setContact}
          placeholder="📱 Number or ✉️ email (optional)" placeholderTextColor={C.faint} keyboardAppearance="dark"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onSubmitEditing={addOne} returnKeyType="done" onFocus={showAdd} />
        <TouchableOpacity style={[styles.addBtn, !name.trim() && styles.off]} onPress={addOne} disabled={!name.trim()}>
          <Text style={styles.addText}>Add to group</Text>
        </TouchableOpacity>

        {!split && group.plans.length > 0 && (
          <>
            <Text style={styles.label}>Plans with this group</Text>
            {group.plans.map((p) => (
              <TouchableOpacity key={p.id} style={styles.planRow} onPress={() => onOpenPlan(p.id)}>
                <Text style={styles.planRowTitle}>{kindOf(p.kind).emoji} {p.title}</Text>
                <Text style={styles.planRowSub}>{[p.party_date, p.place].filter(Boolean).join(' · ') || 'No date yet'}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 120 }} />
        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete this group</Text>
        </TouchableOpacity>
      </ScrollView>

      <ContactPicker
        visible={contactsOpen}
        already={members.map((m) => m.name)}
        onClose={() => setContactsOpen(false)}
        onPick={async (list) => {
          setContactsOpen(false);
          try {
            await addMembers(group.id, list.filter((c) => !taken(c.name)));
            load();
          } catch (e) {
            Alert.alert("Couldn't add", e.message);
          }
        }}
      />
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontFamily: F.display, fontSize: 22, color: C.text },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  editLink: { color: C.accentSoft, fontSize: 14, fontWeight: '800', marginLeft: 10 },
  editBox: { marginBottom: 4 },
  emo: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: C.card },
  emoOn: { backgroundColor: C.lime },
  emoText: { fontSize: 20 },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  editCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  editCancelText: { color: C.sub, fontSize: 15, fontWeight: '700' },
  editSave: { backgroundColor: C.lime, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18 },
  editSaveText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  sub: { color: C.faint, fontSize: 14, marginTop: 4, marginBottom: 12 },
  list: { flex: 1 },
  planBtn: { backgroundColor: C.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16 },
  planText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  planSub: { color: '#E9FFC2', fontSize: 13, marginTop: 3 },
  off: { opacity: 0.45 },
  label: { color: C.sub, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  memberCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, marginBottom: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  flex: { flex: 1 },
  memberName: { color: C.text, fontSize: 16, fontWeight: '700', flex: 1 },
  memberSub: { color: C.faint, fontSize: 13, marginTop: 2 },
  adminTag: { color: C.amber, fontSize: 13, fontWeight: '800', marginRight: 10 },
  makeAdmin: { color: C.accentSoft, fontSize: 13, fontWeight: '700', marginRight: 10 },
  removeX: { color: C.red, fontSize: 16, paddingLeft: 4 },
  contactsBtn: { borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginBottom: 10 },
  contactsText: { color: C.accentSoft, fontSize: 15, fontWeight: '800' },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text, marginBottom: 8 },
  small: { fontSize: 14 },
  addBtn: { backgroundColor: C.cardHi, borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 18 },
  addText: { color: C.accentSoft, fontSize: 15, fontWeight: '800' },
  planRow: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  planRowTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  planRowSub: { color: C.faint, fontSize: 13, marginTop: 2 },
  deleteBtn: { alignItems: 'center', paddingVertical: 20, marginBottom: 30 },
  deleteText: { color: C.red, fontSize: 16 },
});
