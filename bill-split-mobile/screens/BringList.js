import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { waNumber } from '../services/parties';
import { baseName, canPlan, planFor } from '../services/planner';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';

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

// "Who brings what"
// Each item clearly shows one of: 🙋 someone is bringing it · 🔔 someone was asked · ❓ needs someone.
// Buttons: I'll bring it · Ask someone · Got it ✓
export default function BringList({ party }) {
  const me = (party.party_members || []).find((m) => m.name === 'Me');
  const friends = (party.party_members || []).filter((m) => m.name !== 'Me');
  const token = party.share_token;
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [asking, setAsking] = useState(null); // item we're asking someone to bring
  const coming = (party.party_members || []).filter((m) => m.rsvp !== 'out').length;
  const [guests, setGuests] = useState(Math.max(1, coming));
  const [filling, setFilling] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc('get_party_list', { p_token: token });
    if (!error) setItems(data || []);
    else setItems((old) => old || []);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // friends update it from the invite link
    return () => clearInterval(t);
  }, [token]);

  const call = async (fn, args) => {
    if (!token || !me) {
      Alert.alert('Not ready', 'Pull down to refresh this plan and try again.');
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

  const add = async (name) => {
    const n = (name || '').trim();
    if (!n) return;
    setText('');
    await call('add_party_item', { p_name: n });
  };

  const saveRename = async (item) => {
    const n = editText.trim();
    setEditing(null);
    if (n && n !== item.name) await call('rename_party_item', { p_item: item.id, p_name: n });
  };

  const askPerson = async (person) => {
    const item = asking;
    setAsking(null);
    const ok = await call('ask_party_item', { p_item: item.id, p_target: person.id });
    if (ok && person.phone) {
      Alert.alert(`Asked ${person.name} 🙏`, 'It is in the party chat. Send them a WhatsApp nudge too?', [
        { text: 'No thanks', style: 'cancel' },
        {
          text: 'WhatsApp',
          onPress: () => {
            const msg = `Hey ${person.name}! Can you bring ${item.name} for ${party.title}? 🙏\nhttps://bill-split-flax.vercel.app/p/${token}`;
            Linking.openURL(`whatsapp://send?phone=${waNumber(person.phone)}&text=${encodeURIComponent(msg)}`).catch(() => {});
          },
        },
      ]);
    }
  };

  // ✨ Auto-plan: add the amounts, or update them if the item is already on the list
  const fillPlan = async () => {
    if (!token || !me) return Alert.alert('Not ready', 'Pull down to refresh this plan and try again.');
    setFilling(true);
    let added = 0;
    let updated = 0;
    for (const p of planFor(party.kind, guests)) {
      const old = (items || []).find((x) => baseName(x.name) === baseName(p.label));
      if (old && old.name === p.name) continue;
      const { error } = old
        ? await supabase.rpc('rename_party_item', { p_token: token, p_member: me.id, p_item: old.id, p_name: p.name })
        : await supabase.rpc('add_party_item', { p_token: token, p_member: me.id, p_name: p.name });
      if (error) {
        setFilling(false);
        return Alert.alert("Couldn't fill the list", error.message);
      }
      if (old) updated++;
      else added++;
    }
    await load();
    setFilling(false);
    Alert.alert('List ready ✨', added || updated
      ? `${added ? `Added ${added}` : ''}${added && updated ? ', ' : ''}${updated ? `updated ${updated}` : ''} for ${guests} people. Now pick who brings what 👇`
      : `Already planned for ${guests} people 👍`);
  };

  const remove = (item) =>
    Alert.alert(`Remove "${item.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => call('update_party_item', { p_item: item.id, p_action: 'remove' }) },
    ]);

  const ideas = (IDEAS[party.kind] || DEFAULT).filter(
    (i) => !(items || []).some((x) => x.name.toLowerCase() === i.toLowerCase())
  );
  const ready = (items || []).filter((i) => i.done).length;
  const covered = (items || []).filter((i) => i.claimed_by).length;

  // What to show for each item
  const status = (it) => {
    const mine = me && it.claimed_by === me.id;
    if (it.done) return { icon: '✅', text: `Got it${it.claimed_name ? ` · ${mine ? 'you' : it.claimed_name}` : ''}`, style: styles.sDone };
    if (it.claimed_by) return { icon: '🙋', text: mine ? "You're bringing it" : `${it.claimed_name} is bringing it`, style: styles.sYes };
    if (it.asked_to) return { icon: '🔔', text: `Asked ${me && it.asked_to === me.id ? 'you' : it.asked_name}, waiting…`, style: styles.sAsked };
    return { icon: '❓', text: 'Needs someone', style: styles.sNeed };
  };

  return (
    <View style={styles.box}>
      <View style={styles.top}>
        <Text style={styles.title}>🛒 Who brings what</Text>
        {items && items.length ? <Text style={styles.count}>{covered}/{items.length} covered · {ready} ready</Text> : null}
      </View>

      {canPlan(party.kind) && (
        <View style={styles.plan}>
          <Text style={styles.planTitle}>✨ Auto-plan: how much to buy</Text>
          <View style={styles.planRow}>
            <TouchableOpacity style={styles.step} onPress={() => setGuests(Math.max(1, guests - 1))}>
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.guests}>{guests} {guests === 1 ? 'person' : 'people'}</Text>
            <TouchableOpacity style={styles.step} onPress={() => setGuests(Math.min(500, guests + 1))}>
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.planPreview}>{planFor(party.kind, guests).map((p) => p.name).join('\n')}</Text>
          <TouchableOpacity style={styles.planBtn} onPress={fillPlan} disabled={filling}>
            <Text style={styles.planBtnText}>{filling ? 'Filling…' : '✨ Fill the list'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {items === null ? (
        <ActivityIndicator color={C.accentSoft} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Nothing yet. Add what the party needs 👇</Text>
      ) : (
        items.map((it) => {
          const st = status(it);
          const mine = me && it.claimed_by === me.id;
          return (
            <View key={it.id} style={[styles.item, it.done && styles.itemDone]}>
              <View style={styles.itemTop}>
                {editing === it.id ? (
                  <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} autoFocus maxLength={80}
                    keyboardAppearance="dark" onSubmitEditing={() => saveRename(it)} onBlur={() => saveRename(it)} returnKeyType="done" />
                ) : (
                  <TouchableOpacity style={styles.flex} onPress={() => { setEditing(it.id); setEditText(it.name); }}>
                    <Text style={[styles.name, it.done && styles.strike]}>{it.name}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => remove(it)} hitSlop={10}>
                  <Text style={styles.x}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.status, st.style]}>{st.icon} {st.text}</Text>

              {!it.done && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.btn, mine && styles.btnOn]} onPress={() => call('update_party_item', { p_item: it.id, p_action: 'claim' })}>
                    <Text style={[styles.btnText, mine && styles.btnTextOn]}>{mine ? '✋ Drop it' : "🙋 I'll bring it"}</Text>
                  </TouchableOpacity>
                  {!it.claimed_by && friends.length > 0 && (
                    <TouchableOpacity style={styles.btn} onPress={() => setAsking(it)}>
                      <Text style={styles.btnText}>👉 Ask someone</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.btn} onPress={() => call('update_party_item', { p_item: it.id, p_action: 'done' })}>
                    <Text style={styles.btnText}>✓ Got it</Text>
                  </TouchableOpacity>
                </View>
              )}
              {it.done && (
                <TouchableOpacity onPress={() => call('update_party_item', { p_item: it.id, p_action: 'done' })}>
                  <Text style={styles.undo}>Undo</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      <View style={styles.addRow}>
        <TextInput style={styles.input} value={text} onChangeText={setText} maxLength={80}
          placeholder="Add something the party needs…" placeholderTextColor={C.faint} keyboardAppearance="dark"
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
      <Text style={styles.hint}>Friends see this list on your invite link and can pick items or ask others too.</Text>

      {/* Ask someone */}
      <Modal visible={!!asking} transparent animationType="slide" onRequestClose={() => setAsking(null)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setAsking(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Who should bring {asking ? asking.name : ''}?</Text>
            <Text style={styles.sheetSub}>We'll ask them in the party chat 🙏</Text>
            {friends.map((f) => (
              <TouchableOpacity key={f.id} style={styles.person} onPress={() => askPerson(f)}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{f.name[0].toUpperCase()}</Text></View>
                <Text style={styles.personName}>{f.name}</Text>
                {f.phone ? <Text style={styles.wa}>💬</Text> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setAsking(null)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: C.text, fontSize: 16, fontWeight: '800' },
  count: { color: C.green, fontSize: 12, fontWeight: '700' },
  plan: { backgroundColor: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 12 },
  planTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  planRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.text, fontSize: 20, fontWeight: '800' },
  guests: { color: C.text, fontSize: 16, fontWeight: '800', marginHorizontal: 14, minWidth: 80, textAlign: 'center' },
  planPreview: { color: C.sub, fontSize: 13, lineHeight: 20, marginTop: 10 },
  planBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  planBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  empty: { color: C.faint, fontSize: 14, marginBottom: 6 },
  item: { backgroundColor: C.bg, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  itemDone: { opacity: 0.7 },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  name: { color: C.text, fontSize: 16, fontWeight: '800' },
  strike: { textDecorationLine: 'line-through' },
  x: { color: C.faint, fontSize: 14, paddingLeft: 10 },
  editInput: { flex: 1, color: C.text, fontSize: 16, borderBottomWidth: 1, borderBottomColor: C.accent, paddingVertical: 2 },
  status: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  sYes: { color: C.green },
  sAsked: { color: C.amber },
  sNeed: { color: C.pink },
  sDone: { color: C.faint },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  btn: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, marginRight: 6, marginBottom: 4 },
  btnOn: { backgroundColor: C.accent, borderColor: C.accent },
  btnText: { color: C.text, fontSize: 13, fontWeight: '700' },
  btnTextOn: { color: '#fff' },
  undo: { color: C.accentSoft, fontSize: 13, fontWeight: '700', marginTop: 6 },
  addRow: { flexDirection: 'row', marginTop: 6 },
  input: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, fontSize: 15, color: C.text },
  addBtn: { backgroundColor: C.cardHi, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  addText: { color: C.accentSoft, fontSize: 15, fontWeight: '800' },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  idea: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  ideaText: { color: C.sub, fontSize: 13 },
  hint: { color: C.faint, fontSize: 11, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
  sheetTitle: { fontFamily: F.bold, color: C.text, fontSize: 17 },
  sheetSub: { color: C.faint, fontSize: 13, marginTop: 2, marginBottom: 10 },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: C.text, fontWeight: '800' },
  personName: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
  wa: { fontSize: 16 },
  cancel: { color: C.sub, fontSize: 15, textAlign: 'center', marginTop: 14 },
});
