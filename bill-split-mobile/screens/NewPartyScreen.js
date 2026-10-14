import { useEffect, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { recentFriends } from '../services/bills';
import { show } from '../services/names';
import ContactPicker from './ContactPicker';
import PlaceInput from './PlaceInput';
import AboutPlace from './AboutPlace';
import PopularHere from './PopularHere';
import { createParty, sharesFor, updateParty } from '../services/parties';
import { KINDS, kindOf } from '../services/partyKinds';
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

// Budget slider: slides from Rs 500 up to Rs 2,00,000 (on a curve, so small amounts are easy to pick).
// Need more? Type any amount — there's no upper limit.
const MIN_B = 500;
const MAX_B = 200000;
const toBudget = (pos) => {
  const raw = MIN_B * Math.pow(MAX_B / MIN_B, pos);
  const step = raw < 5000 ? 100 : raw < 50000 ? 500 : 5000;
  return Math.round(raw / step) * step;
};
const toPos = (amount) => {
  const a = Math.min(Math.max(Number(amount) || MIN_B, MIN_B), MAX_B);
  return Math.log(a / MIN_B) / Math.log(MAX_B / MIN_B);
};
const ROLLING = [1500, 3000, 6000, 12000, 25000, 50000];

// The fun line fades and slides in every time it changes
function FunLine({ text, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [text]);
  if (!text) return null;
  return (
    <Animated.Text
      style={[style, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}
    >
      {text}
    </Animated.Text>
  );
}

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function NewPartyScreen({ onBack, onCreated, group = null, editing = null }) {
  // editing = an existing plan: the form starts filled in and saves changes instead of creating
  const ex = editing;
  const exMembers = (ex && ex.party_members) || [];
  const [title, setTitle] = useState(ex ? ex.title : '');
  const [kind, setKind] = useState(ex ? ex.kind || 'party' : 'party'); // birthday, trip, movie…
  const [dateObj, setDateObj] = useState(null); // picked from the calendar
  const [showCal, setShowCal] = useState(false);
  const [place, setPlace] = useState(ex ? ex.place || '' : '');
  const [budget, setBudget] = useState(ex ? String(Math.round(ex.budget || 0)) : '');
  const [dateText] = useState(ex ? ex.party_date || '' : ''); // keep the old date unless a new one is picked
  // Planning for a group? Everyone in it is added straight away
  const groupMembers = (group && group.group_members) || [];
  const [people, setPeople] = useState(ex ? ['Me', ...exMembers.filter((m) => m.name !== 'Me').map((m) => m.name)] : ['Me', ...groupMembers.map((m) => m.name)]);
  const [phones, setPhones] = useState(Object.fromEntries(groupMembers.filter((m) => m.phone).map((m) => [m.name, m.phone]))); // name -> phone
  const [contactsOpen, setContactsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState(''); // optional number or email for the friend being typed
  const [emails, setEmails] = useState(Object.fromEntries(groupMembers.filter((m) => m.email).map((m) => [m.name, m.email]))); // name -> email
  const [friends, setFriends] = useState([]);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(ex ? ex.split_mode || 'equal' : 'equal'); // 'equal' | 'treat' | 'free'
  const [special, setSpecial] = useState(ex && ex.special_person ? ex.special_person : 'Me');

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
    : dateText;

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
    // Optional number or email typed under the name
    const extra = newContact.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra)) setEmails({ ...emails, [name]: extra.toLowerCase() });
    else if (extra.replace(/\D/g, '').length >= 10) setPhones({ ...phones, [name]: extra });
    setNewContact('');
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
      if (ex) {
        await updateParty(ex, { title, kind, party_date: date, place, budget, people, mode, special, phones, emails });
        onCreated(ex.id);
      } else {
        const party = await createParty({ title, kind, party_date: date, place, budget, people, mode, special, phones, emails, groupId: group ? group.id : null });
        onCreated(party.id);
      }
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
      <Text style={styles.title}>{ex ? 'Edit plan' : 'Plan something'} {kindOf(kind).emoji}</Text>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {group ? <Text style={styles.groupTag}>{group.emoji} Planning with {group.name}</Text> : null}
        <Text style={styles.label}>What's the plan?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kinds} keyboardShouldPersistTaps="handled">
          {KINDS.map((k) => (
            <TouchableOpacity key={k.key} style={[styles.kind, kind === k.key && styles.kindOn]} onPress={() => setKind(k.key)}>
              <Text style={styles.kindEmoji}>{k.emoji}</Text>
              <Text style={[styles.kindText, kind === k.key && styles.kindTextOn]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Name</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID} style={styles.input} value={title} onChangeText={setTitle}
          placeholder={kindOf(kind).ideas[idea % kindOf(kind).ideas.length]} placeholderTextColor={C.faint} keyboardAppearance="dark" />

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
        <PlaceInput value={place} onChange={setPlace} onFocus={() => scrollTo('where')} categories={kindOf(kind).places} />
        {place.trim().length >= 3 ? <AboutPlace place={place} /> : null}
        {place.trim().length >= 3 ? <PopularHere place={place} quietIfEmpty={['trip', 'daytrip', 'wedding', 'house'].includes(kind)} /> : null}

        <View onLayout={keep('budget')}>
          <Text style={styles.label}>Total budget (Rs)</Text>
        </View>
        <TextInput
          inputAccessoryViewID={DONE_ID} style={styles.input} value={budget} onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ''))}
          onFocus={() => scrollTo('budget')}
          placeholder={`e.g. ${ROLLING[idea % ROLLING.length].toLocaleString('en-IN')}`} placeholderTextColor={C.faint} keyboardAppearance="dark" keyboardType="number-pad" />
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={toPos(budget)}
          onValueChange={(v) => setBudget(String(toBudget(v)))}
          minimumTrackTintColor={C.accent}
          maximumTrackTintColor={C.border}
          thumbTintColor={C.accentSoft}
        />
        <View style={styles.scale}>
          <Text style={styles.scaleText}>{inr(MIN_B)}</Text>
          <Text style={styles.scaleText}>{inr(10000)}</Text>
          <Text style={styles.scaleText}>{inr(MAX_B)}+</Text>
        </View>
        <Text style={styles.scaleHint}>Slide, tap a pick, or type any amount — no limit ♾️</Text>
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
        <TextInput
          inputAccessoryViewID={DONE_ID} style={[styles.input, styles.small]} value={newContact} onChangeText={setNewContact}
          placeholder="📱 Their number or ✉️ email (optional)" placeholderTextColor={C.faint} keyboardAppearance="dark"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
          onSubmitEditing={() => addPerson(newName)} returnKeyType="done" />
        <TouchableOpacity style={styles.contactsBtn} onPress={() => { Keyboard.dismiss(); setContactsOpen(true); }}>
          <Text style={styles.contactsText}>📇 Add from contacts</Text>
        </TouchableOpacity>
        <ContactPicker
          visible={contactsOpen}
          already={people}
          onClose={() => setContactsOpen(false)}
          onPick={(list) => {
            const fresh = list.filter((c) => !people.some((p) => p.toLowerCase() === c.name.toLowerCase()));
            setPeople([...people, ...fresh.map((c) => c.name)]);
            setPhones({ ...phones, ...Object.fromEntries(fresh.map((c) => [c.name, c.phone])) });
            setContactsOpen(false);
          }}
        />

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
            <FunLine style={styles.fun} text={funFact(mode === 'treat' ? budget : perHead, idea)} />
            {budgetNudge(mode === 'treat' ? Number(budget) : perHead) ? (
              <Text style={styles.nudge}>{budgetNudge(mode === 'treat' ? Number(budget) : perHead)}</Text>
            ) : null}
          </View>
        )}
        <TouchableOpacity style={styles.button} onPress={() => { Keyboard.dismiss(); create(); }} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{ex ? 'Save changes' : 'Create plan'}</Text>}
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
  groupTag: { alignSelf: 'flex-start', color: C.accentSoft, backgroundColor: C.cardHi, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, fontSize: 13, fontWeight: '700', marginBottom: 10, overflow: 'hidden' },
  kinds: { marginBottom: 14, flexGrow: 0 },
  kind: { alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, minWidth: 78 },
  kindOn: { backgroundColor: C.accent, borderColor: C.accent },
  kindEmoji: { fontSize: 26 },
  kindText: { color: C.sub, fontSize: 12, fontWeight: '700', marginTop: 4 },
  kindTextOn: { color: '#fff' },
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
  small: { fontSize: 14, paddingVertical: 10, marginTop: -6 },
  contactsBtn: { borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginBottom: 14 },
  contactsText: { color: C.accentSoft, fontSize: 15, fontWeight: '800' },
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
  slider: { width: '100%', height: 36 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  scaleText: { color: C.faint, fontSize: 11 },
  scaleHint: { color: C.faint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  fun: { color: C.accentSoft, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  nudge: { color: C.amber, fontSize: 12, marginTop: 6, textAlign: 'center' },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, marginBottom: 30 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
