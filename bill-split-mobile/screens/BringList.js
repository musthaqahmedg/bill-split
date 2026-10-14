import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

// Quick ideas by plan type
const IDEAS = {
  house: ['Chips 🍟', 'Soft drinks 🥤', 'Ice 🧊', 'Cake 🎂', 'Plates & cups 🥤', 'Speaker 🔊'],
  birthday: ['Cake 🎂', 'Candles 🕯️', 'Balloons 🎈', 'Gift 🎁', 'Party poppers 🎉'],
  trip: ['Water 💧', 'Snacks 🍪', 'First-aid kit 🩹', 'Power bank 🔋', 'Sunscreen 🧴', 'Speaker 🔊'],
  daytrip: ['Water 💧', 'Snacks 🍪', 'Mat / sheet 🧺', 'Power bank 🔋', 'Umbrella ☂️'],
  wedding: ['Gift 🎁', 'Flowers 💐', 'Card 💌'],
  match: ['Snacks 🍿', 'Jerseys 👕', 'Soft drinks 🥤'],
  movie: ['Tickets 🎟️', 'Popcorn 🍿'],
};
const DEFAULT = ['Snacks 🍿', 'Soft drinks 🥤', 'Ice 🧊', 'Cake 🎂'];

// "Who brings what": add items, tap "I'll bring it", tick it off when bought.
// Uses the same functions as the invite page; the host acts as the 'Me' guest.
export default function BringList({ party }) {
  const me = (party.party_members || []).find((m) => m.name === 'Me');
  const token = party.share_token;
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null); // item id being renamed
  const [editText, setEditText] = useState('');

  const load = async () => {
    const { data, error } = await supabase.rpc('get_party_list', { p_token: token });
    if (!error) setItems(data || []);
    else setItems((old) => old || []);
  };

  // Every change goes through here, so problems show up instead of silently doing nothing
  const call = async (fn, args) => {
    if (!token || !me) {
      Alert.alert('Not ready', 'This plan is missing your spot on the guest list. Pull down to refresh and try again.');
      return false;
    }
    const { error } = await supabase.rpc(fn, { p_token: token, p_member: me.id, ...args });
    if (error) {
      Alert.alert("Couldn't update the list", error.message);
      return false;
    }
    load();
    return true;
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // friends add things from the invite link
    return () => clearInterval(t);
  }, [token]);

  const add = async (name) => {
    const n = (name || '').trim();
    if (!n) return;
    setText('');
    await call('add_party_item', { p_name: n });
  };

  const act = (item, action) => call('update_party_item', { p_item: item.id, p_action: action });

  const saveRename = async (item) => {
    const n = editText.trim();
    setEditing(null);
    if (n && n !== item.name) await call('rename_party_item', { p_item: item.id, p_name: n });
  };

  const ideas = (IDEAS[party.kind] || DEFAULT).filter(
    (i) => !(items || []).some((x) => x.name.toLowerCase() === i.toLowerCase())
  );
  const doneCount = (items || []).filter((i) => i.done).length;

  return (
    <View style={styles.box}>
      <View style={styles.top}>
        <Text style={styles.title}>🛒 Who brings what</Text>
        {items && items.length ? <Text style={styles.count}>{doneCount}/{items.length} ready</Text> : null}
      </View>

      {items === null ? (
        <ActivityIndicator color={C.accentSoft} />
      ) : (
        items.map((it) => {
          const mine = me && it.claimed_by === me.id;
          return (
            <View key={it.id} style={styles.row}>
              <TouchableOpacity onPress={() => act(it, 'done')} hitSlop={8}>
                <Text style={styles.check}>{it.done ? '✅' : '⬜'}</Text>
              </TouchableOpacity>
              <View style={styles.flex}>
                {editing === it.id ? (
                  <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} autoFocus maxLength={80}
                    keyboardAppearance="dark" onSubmitEditing={() => saveRename(it)} onBlur={() => saveRename(it)} returnKeyType="done" />
                ) : (
                  <Text style={[styles.name, it.done && styles.doneText]} onPress={() => { setEditing(it.id); setEditText(it.name); }}>
                    {it.name} <Text style={styles.pencil}>✏️</Text>
                  </Text>
                )}
                <Text style={styles.who}>
                  {it.claimed_name ? `${mine ? 'You' : it.claimed_name} will bring it` : 'Nobody yet'}
                </Text>
              </View>
              <TouchableOpacity style={[styles.claim, mine && styles.claimOn]} onPress={() => act(it, 'claim')}>
                <Text style={[styles.claimText, mine && styles.claimTextOn]}>{mine ? "I'm on it ✓" : "I'll bring"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => act(it, 'remove')} hitSlop={8}>
                <Text style={styles.remove}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <View style={styles.addRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} maxLength={80}
          placeholder="Add something to bring…" placeholderTextColor={C.faint} keyboardAppearance="dark"
          onSubmitEditing={() => add(text)} returnKeyType="done" />
        <TouchableOpacity style={styles.addBtn} onPress={() => add(text)}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>
      {ideas.length > 0 && (
        <View style={styles.ideas}>
          {ideas.map((i) => (
            <TouchableOpacity key={i} style={styles.idea} onPress={() => add(i)}>
              <Text style={styles.ideaText}>+ {i}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: C.text, fontSize: 16, fontWeight: '800' },
  count: { color: C.green, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  check: { fontSize: 18, marginRight: 10 },
  flex: { flex: 1 },
  name: { color: C.text, fontSize: 15, fontWeight: '600' },
  pencil: { fontSize: 11 },
  editInput: { color: C.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.accent, paddingVertical: 2 },
  doneText: { textDecorationLine: 'line-through', color: C.faint },
  who: { color: C.faint, fontSize: 12, marginTop: 1 },
  claim: { borderWidth: 1, borderColor: C.accent, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginLeft: 6 },
  claimOn: { backgroundColor: C.accent },
  claimText: { color: C.accentSoft, fontSize: 12, fontWeight: '800' },
  claimTextOn: { color: '#fff' },
  remove: { color: C.red, fontSize: 14, marginLeft: 10 },
  addRow: { flexDirection: 'row', marginTop: 10 },
  input: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, fontSize: 15, color: C.text },
  addBtn: { backgroundColor: C.cardHi, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  addText: { color: C.accentSoft, fontSize: 15, fontWeight: '800' },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  idea: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  ideaText: { color: C.sub, fontSize: 13 },
});
