import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { recentFriends } from '../services/bills';
import { show } from '../services/names';
import ContactPicker from './ContactPicker';
import PlaceInput from './PlaceInput';
import AboutPlace from './AboutPlace';
import PopularHere from './PopularHere';
import MenuSheet, { MenuButton } from './MenuSheet';
import { createParty, sharesFor, updateParty } from '../services/parties';
import { KINDS, kindOf } from '../services/partyKinds';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import { C, F } from '../services/theme';

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
// 🎟️ Pick the vibe as a ticket: price is PER PERSON, total = price × people (Gautham's ticket idea)
const TICKETS = [
  { key: 'early', name: 'EARLY BIRD', per: 500, note: 'Chill & cheap', color: '#E2FF3B' },
  { key: 'regular', name: 'REGULAR', per: 1000, note: 'The usual', color: '#55E0F0' },
  { key: 'owl', name: 'NIGHT OWL', per: 2000, note: 'Going big', color: '#FFB3D9' },
  { key: 'vip', name: 'VIP TABLE', per: 5000, note: 'All out, seats for the squad', color: '#FFD84D' },
];
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

const STEPS = [
  { key: 'what', emoji: '✨', label: 'What', kicker: 'SET THE MOOD', title: "What's the\nenergy? ⚡", next: "When & where" },
  { key: 'when', emoji: '📅', label: 'When', kicker: 'PICK THE SPOT', title: 'Where we\ngoing? 📍', next: "Who's coming" },
  { key: 'who', emoji: '👥', label: 'Who', kicker: 'BRING THE SQUAD', title: "Who's pulling\nup? 👥", next: 'Set the budget' },
  { key: 'money', emoji: '💰', label: 'Money', kicker: 'LAST STEP', title: 'Grab your\nticket 🎟️', next: '' },
];

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function NewPartyScreen({ onBack, onCreated, group = null, editing = null, initialKind = null }) {
  const [menuFor, setMenuFor] = useState(null); // 📋 menu of the chosen place
  // editing = an existing plan: the form starts filled in and saves changes instead of creating
  const ex = editing;
  const exMembers = (ex && ex.party_members) || [];
  const [title, setTitle] = useState(ex ? ex.title : '');
  const [kind, setKind] = useState(ex ? ex.kind || 'party' : initialKind || 'party'); // birthday, trip, movie…
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

  // 💾 New plans save themselves as a draft, so leaving the page never loses anything
  const DRAFT = 'vibeout.planDraft';
  const draftable = !ex && !group;
  const [resume, setResume] = useState(null); // an unfinished plan from before
  const hasContent = !!(title.trim() || place.trim() || Number(budget) > 0 || people.length > 1);
  useEffect(() => {
    if (!draftable) return;
    AsyncStorage.getItem(DRAFT)
      .then((d) => {
        const v = d ? JSON.parse(d) : null;
        if (v && (v.title || v.place || v.budget || (v.people || []).length > 1)) setResume(v);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!draftable || resume || !hasContent) return;
    const t = setTimeout(() => {
      const d = { title, kind, place, budget, people, phones, emails, mode, special, date: dateObj ? dateObj.toISOString() : null };
      AsyncStorage.setItem(DRAFT, JSON.stringify(d)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [title, kind, place, budget, people, phones, emails, mode, special, dateObj, resume]);
  const restoreDraft = () => {
    const d = resume;
    setTitle(d.title || '');
    setKind(d.kind || 'party');
    setPlace(d.place || '');
    setBudget(d.budget || '');
    setPeople(d.people && d.people.length ? d.people : ['Me']);
    setPhones(d.phones || {});
    setEmails(d.emails || {});
    setMode(d.mode || 'equal');
    setSpecial(d.special || 'Me');
    if (d.date) setDateObj(new Date(d.date));
    setResume(null);
  };
  const startFresh = () => {
    AsyncStorage.removeItem(DRAFT).catch(() => {});
    setResume(null);
  };
  const leave = () => {
    if (!draftable || !hasContent) return onBack();
    Alert.alert('Leave this plan?', 'We saved it as a draft. Finish it any time from “Plan something”.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { AsyncStorage.removeItem(DRAFT).catch(() => {}); onBack(); } },
      { text: '💾 Keep draft', onPress: onBack },
    ]);
  };

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

  // 👣 4 simple steps instead of one long form
  const [step, setStep] = useState(0);
  const go = (i) => {
    Keyboard.dismiss();
    setStep(i);
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
  };
  const next = () => {
    if (step === 0 && !title.trim()) return Alert.alert('Name needed', `Give it a name, e.g. ${kindOf(kind).ideas[0]}`);
    if (step === 2 && people.length < 2) return Alert.alert('Add people', 'Add at least one friend');
    go(step + 1);
  };

  const create = async () => {
    if (!title.trim()) return go(0), Alert.alert('Name needed', "Give the plan a name, e.g. Arun's birthday 🎂");
    if (people.length < 2) return go(2), Alert.alert('Add people', 'Add at least one friend');
    if (!(Number(budget) > 0)) return Alert.alert('Budget needed', 'Enter the total budget in rupees');
    setSaving(true);
    try {
      if (ex) {
        await updateParty(ex, { title, kind, party_date: date, place, budget, people, mode, special, phones, emails });
        onCreated(ex.id);
      } else {
        const party = await createParty({ title, kind, party_date: date, place, budget, people, mode, special, phones, emails, groupId: group ? group.id : null });
        AsyncStorage.removeItem(DRAFT).catch(() => {});
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
      <TouchableOpacity onPress={() => (step > 0 ? go(step - 1) : leave())}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <View style={styles.steps}>
        {STEPS.map((st, i) => (
          <TouchableOpacity key={st.key} style={styles.stepItem} onPress={() => (i <= step || ex ? go(i) : next())} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10 }}>
            <View style={[styles.stepBar, i <= step && styles.stepBarOn]} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.kickerPill}>
        <Text style={styles.kickerText}>{ex ? 'EDIT PLAN · ' : ''}STEP {step + 1} OF 4 · {STEPS[step].kicker}</Text>
      </View>
      <Text style={styles.title}>{STEPS[step].title}</Text>
      {resume ? (
        <View style={styles.draftBox}>
          <Text style={styles.draftTitle}>📝 Finish your unsaved plan?</Text>
          <Text style={styles.draftSub} numberOfLines={1}>
            {resume.title || 'Untitled plan'}{resume.place ? ` · ${resume.place}` : ''}{(resume.people || []).length > 1 ? ` · ${resume.people.length} people` : ''}
          </Text>
          <View style={styles.draftBtns}>
            <TouchableOpacity style={styles.draftGo} onPress={restoreDraft}>
              <Text style={styles.draftGoText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.draftNo} onPress={startFresh}>
              <Text style={styles.draftNoText}>Start fresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {step === 0 && (
          <>
        {group ? <Text style={styles.groupTag}>{group.emoji} Planning with {group.name}</Text> : null}
        <Text style={styles.lead}>Pick the vibe. We'll tune the places and the plan to it.</Text>
        <View style={styles.kinds}>
          {KINDS.map((k) => (
            <TouchableOpacity key={k.key} style={[styles.kind, { borderColor: k.color }, kind === k.key && styles.kindOn]} onPress={() => setKind(k.key)}>
              <Text style={[styles.kindText, kind === k.key && styles.kindTextOn]}>{k.emoji} {k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Name</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID} style={styles.input} value={title} onChangeText={setTitle}
          placeholder={kindOf(kind).ideas[idea % kindOf(kind).ideas.length]} placeholderTextColor={C.faint} keyboardAppearance="dark" />

          </>
        )}

        {step === 1 && (
          <>
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
              accentColor={C.lime}
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
        {place.trim().length >= 3 && !['trip', 'daytrip', 'wedding', 'house'].includes(kind) && !/^my place|current location/i.test(place.trim()) ? (
          <MenuButton onPress={() => setMenuFor(place)} />
        ) : null}
        <MenuSheet place={menuFor} onClose={() => setMenuFor(null)} />

          </>
        )}

        {step === 2 && (
          <>
        <Text style={styles.label}>In the squad ({people.length})</Text>
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

          </>
        )}

        {step === 3 && (
          <>
        <Text style={styles.lead}>Price is per person. We split the bill after.</Text>
        {TICKETS.map((t) => {
          const total = t.per * Math.max(people.length, 1);
          const on = Number(budget) === total;
          return (
            <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => { Keyboard.dismiss(); setBudget(String(total)); }}
              style={[styles.ticket, { backgroundColor: t.color }, on && styles.ticketOn]}>
              <View style={[styles.notch, styles.notchL]} />
              <View style={[styles.notch, styles.notchR]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ticketName}>{t.name}</Text>
                <Text style={styles.ticketNote}>{t.note} · {inr(total)} total</Text>
              </View>
              <View style={styles.ticketCut} />
              <Text style={styles.ticketPer}>{inr(t.per)}</Text>
              {on ? <Text style={styles.ticketTick}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}

        <View onLayout={keep('budget')}>
          <Text style={styles.label}>Or set the total budget (₹)</Text>
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
          minimumTrackTintColor={C.lime}
          maximumTrackTintColor={C.border}
          thumbTintColor={C.lime}
        />
        <View style={styles.scale}>
          <Text style={styles.scaleText}>{inr(MIN_B)}</Text>
          <Text style={styles.scaleText}>{inr(10000)}</Text>
          <Text style={styles.scaleText}>{inr(MAX_B)}+</Text>
        </View>
        <Text style={styles.scaleHint}>Tap a ticket, slide, or type any amount — no limit ♾️</Text>

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
                {uneven ? <Text style={styles.previewNote}>A few pay ₹1 extra so it adds up exactly</Text> : null}
              </>
            )}
            <FunLine style={styles.fun} text={funFact(mode === 'treat' ? budget : perHead, idea)} />
            {budgetNudge(mode === 'treat' ? Number(budget) : perHead) ? (
              <Text style={styles.nudge}>{budgetNudge(mode === 'treat' ? Number(budget) : perHead)}</Text>
            ) : null}
          </View>
        )}
        {!ex && (
          <Text style={styles.after}>
            After you create it: 🛒 Who brings what · 💬 Chat · 📊 Polls · 📨 Invite link
          </Text>
        )}
          </>
        )}
      </ScrollView>

      {/* ⬅️ ➡️ Step buttons */}
      <View style={styles.nav}>
        {step > 0 ? (
          <TouchableOpacity style={styles.navBack} onPress={() => go(step - 1)}>
            <Text style={styles.navBackText}>‹ Back</Text>
          </TouchableOpacity>
        ) : null}
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={[styles.button, styles.navNext]} onPress={next}>
            <Text style={styles.buttonText}>NEXT: {STEPS[step].next.toUpperCase()} →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.navNext]} onPress={() => { Keyboard.dismiss(); create(); }} disabled={saving}>
            {saving ? <ActivityIndicator color={C.onLime} /> : <Text style={styles.buttonText}>{ex ? 'SAVE CHANGES →' : 'LOCK IT IN →'}</Text>}
          </TouchableOpacity>
        )}
      </View>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  labelSoft: { color: C.faint, fontSize: 13 },
  ticket: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingVertical: 16, paddingLeft: 18, paddingRight: 16, marginBottom: 10, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent' },
  ticketOn: { borderColor: '#fff' },
  notch: { position: 'absolute', top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: C.bg },
  notchL: { left: -9 },
  notchR: { right: -9 },
  ticketName: { fontFamily: F.display, color: C.onLime, fontSize: 18 },
  ticketNote: { color: C.onLime, opacity: 0.75, fontSize: 12, fontWeight: '700', marginTop: 3 },
  ticketCut: { alignSelf: 'stretch', borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.35)', marginHorizontal: 12 },
  ticketPer: { fontFamily: F.display, color: C.onLime, fontSize: 20 },
  ticketTick: { position: 'absolute', top: 6, right: 12, color: C.onLime, fontSize: 14, fontWeight: '900' },
  lead: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  kickerPill: { alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10 },
  kickerText: { color: C.onLime, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  draftBox: { backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, borderRadius: 16, padding: 12, marginTop: 10 },
  draftTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  draftSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  draftBtns: { flexDirection: 'row', marginTop: 10 },
  draftGo: { backgroundColor: C.amber, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  draftGoText: { color: '#2A1B00', fontSize: 14, fontWeight: '800' },
  draftNo: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14 },
  draftNoText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  back: { color: C.lime, fontSize: 16, marginBottom: 12 },
  title: { fontFamily: F.display, fontSize: 30, lineHeight: 36, color: C.text, marginBottom: 8 },
  list: { flex: 1 },
  scrollPad: { paddingBottom: 260 }, // room so any box can scroll above the keypad
  groupTag: { alignSelf: 'flex-start', color: C.accentSoft, backgroundColor: C.cardHi, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, fontSize: 13, fontWeight: '700', marginBottom: 10, overflow: 'hidden' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  kind: { borderWidth: 1.5, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  kindOn: { backgroundColor: C.lime, borderColor: C.lime },
  kindText: { color: C.text, fontSize: 14, fontWeight: '700' },
  kindTextOn: { color: C.onLime },
  label: { color: C.sub, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
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
  modeOn: { backgroundColor: C.lime, borderColor: C.lime },
  modeText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  modeTextOn: { color: C.onLime, fontWeight: '800' },
  preview: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 6, marginBottom: 20 },
  previewText: { color: C.sub, fontSize: 14 },
  previewAmount: { fontFamily: F.display, color: C.lime, fontSize: 30, marginTop: 4 },
  previewNote: { color: C.faint, fontSize: 12, marginTop: 4 },
  slider: { width: '100%', height: 36 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  scaleText: { color: C.faint, fontSize: 11 },
  scaleHint: { color: C.faint, fontSize: 12, marginTop: 4, marginBottom: 10 },
  fun: { color: C.accentSoft, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  nudge: { color: C.amber, fontSize: 12, marginTop: 6, textAlign: 'center' },
  after: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 6 },
  button: { backgroundColor: C.lime, padding: 17, borderRadius: 18, alignItems: 'center', overflow: 'hidden' },
  steps: { flexDirection: 'row', marginBottom: 14 },
  stepItem: { flex: 1, marginRight: 6 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: C.border },
  stepBarOn: { backgroundColor: C.lime },
  stepText: { color: C.faint, fontSize: 12, fontWeight: '600', marginTop: 6 },
  stepTextOn: { color: C.text },
  nav: { flexDirection: 'row', paddingTop: 10, paddingBottom: 30, backgroundColor: C.bg },
  navBack: { justifyContent: 'center', paddingHorizontal: 18, marginRight: 10, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  navBackText: { color: C.text, fontSize: 16, fontWeight: '700' },
  navNext: { flex: 1 },
  buttonText: { color: C.onLime, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});
