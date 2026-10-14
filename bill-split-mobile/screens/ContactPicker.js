// The new expo-contacts moved these functions to 'expo-contacts/legacy' (the old import now throws)
import * as Contacts from 'expo-contacts/legacy';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { C } from '../services/theme';

// Pick friends from the phone's contacts. Returns [{ name, phone }].
export default function ContactPicker({ visible, onClose, onPick, already = [] }) {
  const [status, setStatus] = useState('loading'); // loading | ok | denied
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState({}); // id -> { name, phone }

  const [limited, setLimited] = useState(false); // iPhone "Limited access": only some contacts shared

  const load = async () => {
    setStatus('loading');
    try {
      const perm = await Contacts.requestPermissionsAsync();
      if (perm.status !== 'granted') return setStatus('denied');
      setLimited(perm.accessPrivileges === 'limited');
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(
        (data || [])
          .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers.length)
          .map((c) => ({ id: c.id, name: c.name.trim(), phone: c.phoneNumbers[0].number }))
      );
      setStatus('ok');
    } catch (e) {
      setStatus('denied');
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPicked({});
    setQuery('');
    load();
  }, [visible]);

  // No permission needed: the phone's own contact picker, one person at a time
  const pickOne = async () => {
    try {
      const c = await Contacts.presentContactPickerAsync();
      if (c && c.name) {
        const phone = c.phoneNumbers && c.phoneNumbers.length ? c.phoneNumbers[0].number : '';
        onPick([{ name: c.name.trim(), phone }]);
      }
    } catch (e) {}
  };

  // iPhone limited access: choose more people to share with the app
  const shareMore = async () => {
    try {
      await Contacts.presentAccessPickerAsync();
    } catch (e) {}
    load();
  };

  const taken = useMemo(() => new Set(already.map((n) => n.toLowerCase())), [already]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => !taken.has(c.name.toLowerCase()) && (!q || c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')));
  }, [contacts, query, taken]);

  const toggle = (c) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = { name: c.name, phone: c.phone };
      return next;
    });

  const count = Object.keys(picked).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.top}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📇 Contacts</Text>
          <TouchableOpacity onPress={() => onPick(Object.values(picked))} disabled={!count}>
            <Text style={[styles.add, !count && styles.addOff]}>Add{count ? ` (${count})` : ''}</Text>
          </TouchableOpacity>
        </View>

        {status === 'loading' && <ActivityIndicator color={C.accentSoft} style={styles.center} />}

        {status === 'denied' && (
          <View style={styles.center}>
            <Text style={styles.deniedTitle}>Pick friends from your phone</Text>
            <Text style={styles.deniedSub}>Choose one person at a time. No contacts access needed.</Text>
            <TouchableOpacity style={styles.settingsBtn} onPress={pickOne}>
              <Text style={styles.settingsText}>📇 Pick a contact</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsLink}>Or allow full access in Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'ok' && (
          <>
            {limited && (
              <TouchableOpacity style={styles.limited} onPress={shareMore}>
                <Text style={styles.limitedText}>Only some contacts are shared. Tap to add more ➕</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="🔍 Search name or number"
              placeholderTextColor={C.faint}
              keyboardAppearance="dark"
              autoCorrect={false}
            />
            <FlatList
              data={shown}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={20}
              renderItem={({ item }) => {
                const on = !!picked[item.id];
                return (
                  <TouchableOpacity style={styles.row} onPress={() => toggle(item)}>
                    <View style={[styles.avatar, on && styles.avatarOn]}>
                      <Text style={styles.avatarText}>{on ? '✓' : item.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.phone}>{item.phone}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No contacts match</Text>}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: C.bg, paddingTop: 16, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cancel: { color: C.sub, fontSize: 16 },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  add: { color: C.accentSoft, fontSize: 16, fontWeight: '800' },
  addOff: { color: C.faint },
  center: { marginTop: 60, alignItems: 'center' },
  deniedTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  deniedSub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  settingsBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, marginTop: 16 },
  settingsText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  settingsLink: { color: C.accentSoft, fontSize: 14, marginTop: 14 },
  limited: { backgroundColor: C.amberBg, borderRadius: 10, padding: 10, marginBottom: 8 },
  limitedText: { color: C.amber, fontSize: 13, fontWeight: '700' },
  search: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarOn: { backgroundColor: C.green },
  avatarText: { color: C.text, fontWeight: '800', fontSize: 16 },
  flex: { flex: 1 },
  name: { color: C.text, fontSize: 16, fontWeight: '600' },
  phone: { color: C.faint, fontSize: 13, marginTop: 2 },
  empty: { color: C.faint, textAlign: 'center', marginTop: 30 },
});
