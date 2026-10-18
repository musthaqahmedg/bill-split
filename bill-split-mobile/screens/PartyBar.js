import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sendMessage } from '../services/chat';
import { COCKTAILS, MOCKTAILS, scaled } from '../services/drinks';
import { getProfile } from '../services/profile';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const AGE_KEY = 'vibeout.ageOk';

// 🍹 Drinks menu: pick drinks, see recipes, add ingredients to "Who brings what", share the menu
export default function PartyBar({ visible, onClose, party }) {
  const members = (party.party_members || []).filter((m) => m.rsvp !== 'out');
  const me = members.find((m) => m.name === 'Me');
  const [tab, setTab] = useState('mock');
  const [people, setPeople] = useState(Math.max(1, members.length));
  const [picked, setPicked] = useState([]);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setTab('mock');
      setPicked([]);
      setOpen(null);
    }
  }, [visible]);

  const showCocktails = async () => {
    const ok = await AsyncStorage.getItem(AGE_KEY).catch(() => null);
    if (ok === 'yes') return setTab('cock');
    Alert.alert('Age check 🔞', "Are you of legal drinking age where you live? (In Kerala it's 23+)", [
      { text: 'No', style: 'cancel' },
      { text: "Yes, I'm of age", onPress: () => { AsyncStorage.setItem(AGE_KEY, 'yes').catch(() => {}); setTab('cock'); } },
    ]);
  };

  const list = tab === 'mock' ? MOCKTAILS : COCKTAILS;
  const toggle = (d) => setPicked((p) => (p.find((x) => x.name === d.name) ? p.filter((x) => x.name !== d.name) : [...p, d]));

  // One shopping line per ingredient across all picked drinks (each person ~1 glass of each)
  const shopping = () => {
    const sum = {};
    for (const d of picked) for (const [name, amt, unit] of d.ingredients) {
      const k = `${name}|${unit}`;
      sum[k] = (sum[k] || 0) + amt;
    }
    return Object.entries(sum).map(([k, amt]) => {
      const [name, unit] = k.split('|');
      return scaled([name, amt, unit], people);
    });
  };

  const addToList = async () => {
    if (!me || !party.share_token) return Alert.alert('Not ready', 'Pull down on the plan to refresh, then try again.');
    setBusy(true);
    try {
      for (const name of shopping()) {
        await supabase.rpc('add_party_item', { p_token: party.share_token, p_member: me.id, p_name: `${name} 🍹` });
      }
      Alert.alert('Added to Who brings what 🛒', 'Now pick who brings each one.');
    } catch (e) {
      Alert.alert("Couldn't add", e.message);
    } finally {
      setBusy(false);
    }
  };

  const shareMenu = async () => {
    try {
      const p = await getProfile().catch(() => null);
      await sendMessage({
        partyId: party.id,
        memberId: me && me.id,
        senderName: (p && p.name) || 'Host',
        body: `🍹 Tonight’s drinks menu:\n${picked.map((d) => `${d.emoji} ${d.name}`).join('\n')}\n\nDrink water, eat first, get home safe 💜`,
      });
      Alert.alert('Shared in the party chat 💬');
    } catch (e) {
      Alert.alert("Couldn't share", e.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.title}>🍹 Drinks menu</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.link}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'mock' && styles.tabOn]} onPress={() => setTab('mock')}>
            <Text style={[styles.tabText, tab === 'mock' && styles.tabTextOn]}>🧃 Mocktails</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'cock' && styles.tabOn]} onPress={showCocktails}>
            <Text style={[styles.tabText, tab === 'cock' && styles.tabTextOn]}>🍸 Cocktails</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.peopleRow}>
          <Text style={styles.peopleLabel}>For</Text>
          <TouchableOpacity style={styles.step} onPress={() => setPeople(Math.max(1, people - 1))}><Text style={styles.stepText}>−</Text></TouchableOpacity>
          <Text style={styles.people}>{people} people</Text>
          <TouchableOpacity style={styles.step} onPress={() => setPeople(Math.min(200, people + 1))}><Text style={styles.stepText}>+</Text></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.pad}>
          {tab === 'cock' && <Text style={styles.care}>🛡️ Eat first, water between drinks, and pick a driver. Mocktails are just as cool 😎</Text>}
          {list.map((d) => {
            const on = picked.find((x) => x.name === d.name);
            const isOpen = open === d.name;
            return (
              <View key={d.name} style={[styles.card, on && styles.cardOn]}>
                <TouchableOpacity style={styles.cardTop} onPress={() => setOpen(isOpen ? null : d.name)}>
                  <Text style={styles.emoji}>{d.emoji}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{d.name}</Text>
                    <Text style={styles.vibe}>{d.vibe} · {isOpen ? 'hide recipe' : 'see recipe'}</Text>
                  </View>
                  <TouchableOpacity style={[styles.pick, on && styles.pickOn]} onPress={() => toggle(d)}>
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{on ? '✓ On menu' : '＋ Add'}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                {isOpen ? (
                  <View style={styles.recipe}>
                    <Text style={styles.section}>FOR {people} {people === 1 ? 'PERSON' : 'PEOPLE'}</Text>
                    {d.ingredients.map((ing) => (
                      <Text key={ing[0]} style={styles.ing}>• {scaled(ing, people)}</Text>
                    ))}
                    <Text style={styles.section}>HOW TO MAKE</Text>
                    {d.steps.map((st, i) => (
                      <Text key={st} style={styles.ing}>{i + 1}. {st}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {picked.length > 0 && (
          <View style={styles.bar}>
            <TouchableOpacity style={styles.barBtn} onPress={addToList} disabled={busy}>
              <Text style={styles.barText}>{busy ? 'Adding…' : `🛒 Add ${shopping().length} items to list`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.barBtn, styles.barGhost]} onPress={shareMenu}>
              <Text style={styles.barText}>💬 Share menu</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, padding: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 24, fontWeight: '700' },
  link: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginTop: 14 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  tabTextOn: { color: C.text },
  peopleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  peopleLabel: { color: C.faint, fontSize: 14, marginRight: 10 },
  step: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.text, fontSize: 18 },
  people: { color: C.text, fontSize: 15, fontWeight: '700', marginHorizontal: 12 },
  pad: { paddingBottom: 120 },
  care: { color: C.amber, fontSize: 13, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12, padding: 10, marginBottom: 10 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  cardOn: { borderColor: C.pink },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 30, marginRight: 12 },
  flex: { flex: 1 },
  name: { color: C.text, fontSize: 16, fontWeight: '700' },
  vibe: { color: C.faint, fontSize: 12, marginTop: 2 },
  pick: { borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  pickOn: { backgroundColor: C.pink },
  pickText: { color: C.text, fontSize: 12, fontWeight: '700' },
  pickTextOn: { color: '#fff' },
  recipe: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 6, marginBottom: 4 },
  ing: { color: C.sub, fontSize: 14, marginTop: 2 },
  bar: { position: 'absolute', left: 16, right: 16, bottom: 30, flexDirection: 'row', gap: 8 },
  barBtn: { flex: 1.4, backgroundColor: C.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  barGhost: { flex: 1, backgroundColor: C.pink },
  barText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
