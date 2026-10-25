import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardDone from './KeyboardDone';
import { createGroup, listGroups } from '../services/groups';
import { C, F } from '../services/theme';

const EMOJIS = ['👥', '🎓', '🏘️', '💼', '⚽', '🏏', '🎮', '👨‍👩‍👧', '💃', '🍻', '✈️', '🔥'];

export default function GroupsScreen({ onBack, onOpenGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await listGroups());
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return Alert.alert('Name the group', 'e.g. School gang 🎓');
    try {
      const g = await createGroup(name, emoji);
      setName('');
      setCreating(false);
      onOpenGroup(g.id);
    } catch (e) {
      Alert.alert("Couldn't create", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Groups 👥</Text>
      <Text style={styles.sub}>Make a group once, then plan anything with them in one tap</Text>

      {creating ? (
        <View style={styles.newBox}>
          <View style={styles.emojis}>
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} style={[styles.emoji, emoji === e && styles.emojiOn]} onPress={() => setEmoji(e)}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} value={name} onChangeText={setName} autoFocus maxLength={60}
            placeholder="School gang, Area friends, Office…" placeholderTextColor={C.faint} keyboardAppearance="dark"
            onSubmitEditing={create} returnKeyType="done" />
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreating(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={create}>
              <Text style={styles.createText}>Create group</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
          <Text style={styles.newText}>+ New group</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        renderItem={({ item }) => {
          const members = item.group_members || [];
          return (
            <TouchableOpacity style={styles.card} onPress={() => onOpenGroup(item.id)}>
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {members.length ? members.map((m) => m.name).join(', ') : 'No members yet'}
                </Text>
              </View>
              <Text style={styles.count}>{members.length}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!loading && !creating ? <Text style={styles.empty}>No groups yet. Make your first gang 🔥</Text> : null}
      />
      <KeyboardDone />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontFamily: F.display, fontSize: 29, color: C.text },
  sub: { color: C.faint, fontSize: 14, marginTop: 4, marginBottom: 14 },
  newBtn: { borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  newText: { color: C.accentSoft, fontSize: 16, fontWeight: '800' },
  newBox: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 14 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  emoji: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 6, backgroundColor: C.cardHi },
  emojiOn: { backgroundColor: C.accent },
  emojiText: { fontSize: 20 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: C.sub, fontSize: 15 },
  createBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  createText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardEmoji: { fontSize: 30, marginRight: 12 },
  flex: { flex: 1 },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  cardSub: { color: C.faint, fontSize: 13, marginTop: 2 },
  count: { color: C.accentSoft, fontSize: 16, fontWeight: '800', marginLeft: 8 },
  empty: { color: C.faint, textAlign: 'center', marginTop: 30, fontSize: 15 },
});
