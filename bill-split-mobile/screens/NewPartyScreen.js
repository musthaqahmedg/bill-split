import { useEffect, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { recentFriends } from '../services/bills';
import { show } from '../services/names';
import PlaceInput from './PlaceInput';
import { createParty, sharesFor } from '../services/parties';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import { C } from '../services/theme';

// Party name ideas that change every few seconds in the empty box
const IDEAS = [
  "Arun's birthday 🎂",
  'Friday night out 🍻',
  'Goa trip 🏖️',
  'House party 🏠',
  'Farewell for Rahul 👋',
  'New Year bash 🎆',
  'Promotion treat 🥂',
  'Match night ⚽',
];

// Quick budget picks, and a fun line about what the money means
const BUDGET_PICKS = [1000, 2500, 5000, 10000, 25000];
const FUN = [
  ['plates of biryani 🍗', 200],
  ['cups of chai ☕', 15],
  ['movie tickets 🎬', 200],
  ['auto rides 🛺', 60],
  ['months of Netflix 📺', 199],
  ['litres of petrol ⛽', 105],
];
function funFact(amount, tick) {
  const a = Math.round(Number(amount) || 0);
  if (a <= 0) return '';
  const [what, price] = FUN[tick % FUN.length];
  const n = Math.floor(a / price);
  if (n < 1) return 'Cheaper than a cup of chai ☕ Easy one!';
  return `Each share ≈ ${n.toLocaleString('en-IN')} ${what}`;
}
function budgetNudge(perHead) {
  if (perHead >= 5000) return '💸 Big night! Keep some aside for the ride home 🚕';
  if (perHead >= 2000) return '🧾 Worth a quick look at this month\'s spends before you go';
  return '';
}

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function NewPartyScreen({ onBack, onCreated }) {
  const [title, setTitle] = useState('');
  const [dateObj, setDateObj] = useState(null); // picked from the calendar
  const [showCal, setShowCal] = useState(false);
  const [place, setPlace] = useState('');
  const [budget, setBudget] = useState('');
  const [people, setPeople] = useState(['Me']);
  const [newName, setNewName] = useState('');
  const [friends, setFriends] = useState([]);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('equal'); // 'equal' | 'treat' | 'free'
  const [special, setSpecial] = useState('Me');

  const [idea, setIdea] = useState(0);

  // Scroll a box to the top when it's tapped, so the keypad never hides it (or its suggestions)
  const scrollRef = useRef(null);
  const fieldY = useRef({});
  const keep = (name) => (e) => { fieldY.current[name] = e.nativeEvent.layout.y; };
  const scrollTo = (name) => setTimeout(() => {
    const y = fieldY.current[name];
    if (y != null && scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, 250);
  useEffect(() => {
    const t = setInterval(() => setIdea((i) => (i + 1) % IDEAS.length), 2500);
    return () => clearInterval(t);
  }, []);

  // e.g. "Sat, 18 Oct"
  const date = dateObj
    ? dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  const onPickDate = (event, picked) => {
    if (Platform.OS === 'android') setShowCal(false); // Android closes its pop-up itself
    if (event.type !== 'dismissed' && picked) setDateObj(picked);
  };

  useEffect(() => {
    recentFriends().then(setFriends).catch(() => {});
  }, []);

  const addPerson = (raw) => {
    const name = raw.trim();
    if (!name) return;
    if (people.some((p) => p.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Already added', `${name} is already in the list`);
      return;
    }
    setPeople([...people, name]);
    setNewName('');
  };

  const removePerson = (name) => {
    setPeople(people.filter((p) => p !== name));
    if (special === name) setSpecial('Me');
  };

  const shares = sharesFor(budget, people, mode, special);
  const paying = shares.filter((x) => x > 0);
  const perHead = paying.length ? Math.min(...paying) : 0;
  const uneven = paying.some((x) => x !== perHead);
  const who = special === 'Me' ? 'You' : special;

  const create = async () => {
    if (!title.trim()) return Alert.alert('Name needed', "Give the party a name, e.g. Arun's birthday 🎂");
    if (!(Number(budget) > 0)) return Alert.alert('Budget needed', 'Enter the total budget in rupees');
    if (people.length < 2) return Alert.alert('Add people', 'Add at least one friend');
    setSaving(true);
    try {
      const party = await createParty({ title, party_date: date, place, budget, people, mode, special });
      onCreated(party.id);
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
      setSaving(false);
    }
  };

  const suggestions = friends.filter((f) => !people.some((p) => p.toLowerCase() === f.toLowerCase()));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Plan a party 🎉</Text>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.label}>Party name</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID} style={styles.input} value={title} onChangeText={setTitle}
          placeholder={IDEAS[idea]} placeholderTextColor={C.faint} keyboardAppearance="dark" />

        <Text style={styles.label}>When</Text>
        <TouchableOpacity style={styles.input} onPress={() => { Keyboard.dismiss(); setShowCal(!showCal); }}>
          <Text style={date ? styles.dateText : styles.datePlaceholder}>{date || '📅 Pick a date'}</Text>
        </TouchableOpacity>

        {showCal && (
          <View style={Platform.OS === 'ios' ? styles.calBox : null}>
            <DateTimePicker
              value={dateObj || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              themeVariant="dark"
              accentColor={C.accent}
              onChange={onPickDate}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={styles.calDone} onPress={() => setShowCal(false)}>
                <Text style={styles.calDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View onLayout={keep('where')}>
          <Text style={styles.label}>Where</Text>
        </View>
        <PlaceInput value={place} onChange={setPlace} onFocus={() => scrollTo('where')} />

        <View onLayout={keep('budget')}>
          <Text style={styles.label}>Total budget (Rs)</Text>
        </View>
        <TextInput
          inputAccessoryViewID={DONE_ID} style={styles.input} value={budget} onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))}
          onFocus={() => scrollTo('budget')}
          placeholder="6000" placeholderTextColor={C.faint} keyboardAppearance="dark" keyboardType="number-pad" />
        <View style={styles.chips}>
          {BUDGET_PICKS.map((b) => (
            <TouchableOpacity key={b} style={[styles.mode, Number(budget) === b && styles.modeOn]} onPress={() => setBudget(String(b))}>
              <Text style={[styles.modeText, Number(budget) === b && styles.modeTextOn]}>{inr(b)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Who's coming ({people.length})</Text>
        <View style={styles.chips}>
          {people.map((p) => (
            <TouchableOpacity key={p} style={styles.chip} onPress={() => p !== 'Me' && removePerson(p)}>
              <Text style={styles.chipText}>{show(p)}{p !== 'Me' ? '  ✕' : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
          inputAccessoryViewID={DONE_ID} style={[styles.input, styles.flex]} value={newName} onChangeText={setNewName}
            placeholder="Add a friend" placeholderTextColor={C.faint} keyboardAppearance="dark"
            onSubmitEditing={() => addPerson(newName)} returnKeyType="done" />
          <TouchableOpacity style={styles.addBtn} onPress={() => addPerson(newName)}>
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        </View>

        {suggestions.length > 0 && (
          <>
            <Text style={styles.hint}>Recent friends, tap to add</Text>
            <View style={styles.chips}>
              {suggestions.map((f) => (
                <TouchableOpacity key={f} style={styles.suggest} onPress={() => addPerson(f)}>
                  <Text style={styles.suggestText}>+ {f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Who pays?</Text>
        <View style={styles.chips}>
          {[
            ['equal', '👥 Split equally'],
            ['treat', "🎁 It's a treat"],
            ['free', '🎂 Birthday free'],
          ].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.mode, mode === key && styles.modeOn]} onPress={() => setMode(key)}>
              <Text style={[styles.modeText, mode === key && styles.modeTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode !== 'equal' && (
          <>
            <Text style={styles.hint}>
              {mode === 'treat' ? 'Who is paying for everyone?' : 'Whose birthday? They pay nothing'}
            </Text>
            <View style={styles.chips}>
              {people.map((p) => (
                <TouchableOpacity key={p} style={[styles.mode, special === p && styles.modeOn]} onPress={() => setSpecial(p)}>
                  <Text style={[styles.modeText, special === p && styles.modeTextOn]}>{show(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {Number(budget) > 0 && people.length > 0 && (
          <View style={styles.preview}>
            {mode === 'treat' ? (
              <>
                <Text style={styles.previewText}>{who} {who === 'You' ? 'pay' : 'pays'} for everyone 🎁</Text>
                <Text style={styles.previewAmount}>{inr(budget)}</Text>
                <Text style={styles.previewNote}>Everyone else pays nothing</Text>
              </>
            ) : (
              <>
                <Text style={styles.previewText}>
                  {mode === 'free' ? `${who} ${who === 'You' ? 'go' : 'goes'} free 🎂, everyone else pays` : 'Each person pays'}
                </Text>
                <Text style={styles.previewAmount}>{inr(perHead)}</Text>
                {uneven ? <Text style={styles.previewNote}>A few pay Rs 1 extra so it adds up exactly</Text> : null}
              </>
            )}
            <Text style={styles.fun}>{funFact(mode === 'treat' ? budget : perHead, idea)}</Text>
            {budgetNudge(mode === 'treat' ? Number(budget) : perHead) ? (
              <Text style={styles.nudge}>{budgetNudge(mode === 'treat' ? Number(budget) : perHead)}</Text>
            ) : null}
          </View>
        )}
        <TouchableOpacity style={styles.button} onPress={() => { Keyboard.dismiss(); create(); }} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create party</Text>}
        </TouchableOpacity>
      </ScrollView>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: C.text, marginBottom: 12 },
  list: { flex: 1 },
  scrollPad: { paddingBottom: 260 }, // room so any box can scroll above the keypad
  label: { color: C.sub, fontSize: 14, marginBottom: 6 },
  hint: { color: C.faint, fontSize: 13, marginBottom: 8 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, fontSize: 16, color: C.text, marginBottom: 14 },
  row: { flexDirection: 'row' },
  dateText: { color: C.text, fontSize: 16 },
  datePlaceholder: { color: C.faint, fontSize: 16 },
  calBox: { backgroundColor: C.card, borderRadius: 16, padding: 8, marginBottom: 14 },
  calDone: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 14 },
  calDoneText: { color: C.accentSoft, fontSize: 16, fontWeight: '800' },
  half: { flex: 1 },
  gap: { marginLeft: 10 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginRight: 6, marginBottom: 6 },
  chipText: { color: C.text, fontSize: 14, fontWeight: '600' },
  addBtn: { backgroundColor: C.cardHi, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', marginLeft: 8, marginBottom: 14 },
  addText: { color: C.accentSoft, fontSize: 15, fontWeight: '800' },
  suggest: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  suggestText: { color: C.sub, fontSize: 13 },
  mode: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, marginRight: 6, marginBottom: 6 },
  modeOn: { backgroundColor: C.accent, borderColor: C.accent },
  modeText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  modeTextOn: { color: '#fff' },
  preview: { backgroundColor: C.greenBg, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 6, marginBottom: 20 },
  previewText: { color: C.sub, fontSize: 14 },
  previewAmount: { color: C.green, fontSize: 30, fontWeight: '800', marginTop: 4 },
  previewNote: { color: C.faint, fontSize: 12, marginTop: 4 },
  fun: { color: C.accentSoft, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  nudge: { color: C.amber, fontSize: 12, marginTop: 6, textAlign: 'center' },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, marginBottom: 30 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
