import { useEffect, useRef, useState } from 'react';
import NumberWheel from './NumberWheel';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KINDS, kindOf } from '../services/kinds';
import { show } from '../services/names';
import { C, F } from '../services/theme';
import BillSteps from './BillSteps';
import { getNoAlcohol } from '../services/profile';

const FACES = ['#E2FF3B', '#FF4FA0', '#55E0F0', '#FF8A3D', '#A98BFF', '#7CFFB2'];
const initials = (n) => show(n).slice(0, 2).toUpperCase();

export default function ItemsScreen({ items, people, initialClaims, initialNonDrinkers, onBack, onNext }) {
  const [nonDrinkers, setNonDrinkers] = useState(
    (initialNonDrinkers || []).filter((p) => people.includes(p))
  );
  const [claims, setClaims] = useState(
    items.map((_, i) => ((initialClaims && initialClaims[i]) || []).filter((p) => people.includes(p)))
  );

  // 🥤 "I don't drink" (Profile setting): you start as not drinking on every new split
  useEffect(() => {
    if (initialNonDrinkers && initialNonDrinkers.length) return;
    if (!people.includes('Me')) return;
    getNoAlcohol().then((no) => { if (no) toggleDrinking('Me'); }).catch(() => {});
  }, []);

  // 🔁 Rounds: each item remembers its round; late joiners skip earlier rounds by default (tap to add them anyway)
  const roundOf = (i) => Math.max(1, Number(items[i] && items[i].round) || 1);
  const rounds = items.reduce((m, _, i) => Math.max(m, roundOf(i)), 1);
  const [joinedAt, setJoinedAt] = useState({}); // person -> round they arrived at
  const late = (i, person) => roundOf(i) < (joinedAt[person] || 1);
  const cycleJoin = (person) =>
    setJoinedAt((prev) => {
      const nextR = ((prev[person] || 1) % rounds) + 1;
      // arriving later → take them off earlier rounds' items
      setClaims((cl) => cl.map((list, i) => (roundOf(i) < nextR ? list.filter((p) => p !== person) : list)));
      return { ...prev, [person]: nextR };
    });

  // "What's this?" pop-up: which item is open (-1 = none)
  const [info, setInfo] = useState(-1);

  const isAlcohol = (i) => kindOf(items[i]) === 'alcohol';
  const canHave = (i, person) => !(isAlcohol(i) && nonDrinkers.includes(person));
  const eligible = (i) => people.filter((p) => canHave(i, p) && !late(i, p));

  const toggleDrinking = (person) => {
    const nowDry = !nonDrinkers.includes(person);
    setNonDrinkers((prev) => (nowDry ? [...prev, person] : prev.filter((p) => p !== person)));
    if (nowDry) {
      // Take them off every alcohol item
      setClaims((prev) => prev.map((list, i) => (isAlcohol(i) ? list.filter((p) => p !== person) : list)));
    }
  };

  const toggle = (i, person) => {
    if (!canHave(i, person)) return;
    setClaims((prev) => prev.map((list, idx) => {
      if (idx !== i) return list;
      return list.includes(person) ? list.filter((p) => p !== person) : [...list, person];
    }));
  };

  // 🍺 How many of this item a person had (each name appears once per drink/peg)
  const unitsOf = (i, person) => claims[i].filter((p) => p === person).length;
  const setUnits = (i, person, n) => {
    if (n < 1 || n > 99) return;
    setClaims((prev) => prev.map((list, idx) => (idx !== i ? list : [...list.filter((p) => p !== person), ...Array(n).fill(person)])));
  };

  // 🤷 Nobody remembers who had what → everyone shares everything equally (non-drinkers still skip alcohol)
  const splitEqually = () =>
    Alert.alert('Split everything equally?', 'Every item is shared by everyone. Non-drinkers still skip alcohol 🥤', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Split equally', onPress: () => setClaims(items.map((_, i) => eligible(i))) },
    ]);

  // "All": if everyone's already on it → clear; otherwise add whoever is missing (keeps counts)
  const toggleAll = (i) => {
    const ok = eligible(i);
    setClaims((prev) => prev.map((list, idx) => {
      if (idx !== i) return list;
      const everyone = ok.every((p) => list.includes(p));
      return everyone ? [] : [...list, ...ok.filter((p) => !list.includes(p))];
    }));
  };

  // 💰 running total per person (items only, before tax & service)
  const cutOf = (person) =>
    items.reduce((sum, it, i) => {
      const list = claims[i];
      const u = list.filter((p) => p === person).length;
      return list.length ? sum + ((Number(it.price) || 0) * u) / list.length : sum;
    }, 0);
  const colorOf = (person) => FACES[Math.max(0, people.indexOf(person)) % FACES.length];

  const claimed = claims.filter((c) => c.length > 0).length;
  const allDone = claimed === items.length;
  const left = items.length - claimed;
  const listRef = useRef(null);
  const cardY = useRef({});
  const next = () => {
    if (allDone) return onNext(claims, nonDrinkers);
    const first = claims.findIndex((c) => c.length === 0);
    if (listRef.current && cardY.current[first] != null) listRef.current.scrollTo({ y: Math.max(0, cardY.current[first] - 8), animated: true });
  };

  // 👤 Gautham's redesign: one person at a time ("What did Alina have?"), tick your items, next person
  const [cur, setCur] = useState(0);
  const person = people[cur] || people[0];
  const isMe = person === 'Me';
  const pickedBy = (p) => claims.filter((list) => list.includes(p)).length;
  const hasNext = cur < people.length - 1;
  // everyone gets their turn: next person until the last one, then the split
  const goNext = () => {
    if (!hasNext && allDone) return onNext(claims, nonDrinkers);
    if (hasNext) {
      setCur(cur + 1);
      if (listRef.current) listRef.current.scrollTo({ y: 0, animated: false });
      return;
    }
    next(); // last person and items still unclaimed → jump to the first one
  };
  const late1 = rounds > 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <BillSteps at={3} />
      <Text style={styles.title}>
        What did <Text style={{ color: colorOf(person) === FACES[0] ? C.pink : colorOf(person) }}>{isMe ? 'you' : show(person)}</Text> have?
      </Text>
      <Text style={styles.sub}>Pick your face, then tick your items.</Text>

      {/* big faces: tap to switch person; ✓ once they've picked something */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.faces} contentContainerStyle={{ paddingRight: 6 }}>
        {people.map((p, i) => {
          const on = i === cur;
          const n = pickedBy(p);
          return (
            <TouchableOpacity key={p} style={styles.face} onPress={() => setCur(i)} activeOpacity={0.8}>
              <View style={[styles.faceRing, on && { borderColor: colorOf(p) }]}>
                <View style={[styles.faceDot, { backgroundColor: colorOf(p) }]}>
                  <Text style={styles.faceInit}>{p === 'Me' ? 'YO' : initials(p)}</Text>
                </View>
              </View>
              {n > 0 && !on ? <View style={styles.faceTick}><Text style={styles.faceTickText}>✓</Text></View> : null}
              <Text style={[styles.faceName, on && { color: C.text }]} numberOfLines={1}>{p === 'Me' ? 'You' : show(p)}</Text>
              <Text style={styles.faceAmt}>₹{Math.round(cutOf(p)).toLocaleString('en-IN')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* small options for this person only (instead of scattered boxes) */}
      <View style={styles.optRow}>
        <TouchableOpacity style={[styles.opt, nonDrinkers.includes(person) && styles.optOn]} onPress={() => toggleDrinking(person)}>
          <Text style={[styles.optText, nonDrinkers.includes(person) && styles.optTextOn]}>
            🥤 {nonDrinkers.includes(person) ? `${isMe ? "You're" : `${show(person)} is`} not drinking` : 'Not drinking?'}
          </Text>
        </TouchableOpacity>
        {late1 ? (
          <TouchableOpacity style={[styles.opt, (joinedAt[person] || 1) > 1 && styles.optLate]} onPress={() => cycleJoin(person)}>
            <Text style={[styles.optText, (joinedAt[person] || 1) > 1 && styles.optTextOn]}>⏰ {(joinedAt[person] || 1) > 1 ? `Joined round ${joinedAt[person]}` : 'Came late?'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView style={styles.list} ref={listRef}>
        {items.map((item, i) => {
          const mine = claims[i].includes(person);
          const blocked = !canHave(i, person);
          const notThere = late(i, person) && !mine;
          const others = [...new Set(claims[i])].filter((p) => p !== person);
          const ways = new Set(claims[i]).size;
          const k = KINDS[kindOf(item)];
          const nobody = claims[i].length === 0;
          return (
            <View key={i} onLayout={(e) => (cardY.current[i] = e.nativeEvent.layout.y)}>
              {rounds > 1 && (i === 0 || roundOf(i) !== roundOf(i - 1)) ? <Text style={styles.roundHead}>ROUND {roundOf(i)}</Text> : null}
              <TouchableOpacity
                style={[styles.tick, mine && styles.tickOn, (blocked || notThere) && styles.tickOff]}
                onPress={() => toggle(i, person)} onLongPress={() => setInfo(i)} disabled={blocked} activeOpacity={0.85}
              >
                <View style={[styles.box, mine && styles.boxOn]}>{mine ? <Text style={styles.boxTick}>✓</Text> : null}</View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.tickName}>{item.qty > 1 ? `${item.qty} × ` : ''}{item.name} <Text style={styles.tickKind}>{k.emoji}</Text></Text>
                  {blocked ? <Text style={styles.tickNote}>🥤 Not drinking, so this one's skipped</Text> : notThere ? <Text style={styles.tickNote}>Not there yet for this round</Text> : null}
                  {others.length ? (
                    <View style={styles.alsoRow}>
                      {others.slice(0, 4).map((o, j) => (
                        <View key={o} style={[styles.alsoDot, { backgroundColor: colorOf(o), marginLeft: j ? -6 : 0 }]}>
                          <Text style={styles.alsoInit}>{o === 'Me' ? 'YO' : initials(o)}</Text>
                        </View>
                      ))}
                      <Text style={styles.alsoText}>{others.length > 4 ? `+${others.length - 4} ` : ''}also had this{mine && ways > 1 ? ` · ₹${Math.round(item.price / ways)} each` : ''}</Text>
                    </View>
                  ) : nobody && !blocked ? <Text style={styles.nobodyNote}>🕵️ Nobody yet</Text> : null}
                  {mine && item.qty > 1 && ways > 1 ? (
                    <View style={styles.howMany}>
                      <Text style={styles.howManyText}>How many?</Text>
                      <NumberWheel value={unitsOf(i, person)} min={1} max={item.qty} onChange={(n) => setUnits(i, person, n)} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.tickPrice}>₹{Math.round(item.price).toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        <TouchableOpacity style={styles.equalLink} onPress={splitEqually}>
          <Text style={styles.equalText}>🤷 Can’t remember? Split everything equally</Text>
        </TouchableOpacity>
        <Text style={styles.hintLong}>Long-press an item to see what it is 🔍</Text>
      </ScrollView>

      <Text style={styles.count}>
        {isMe ? 'You' : show(person)} · {pickedBy(person)} item{pickedBy(person) === 1 ? '' : 's'} picked{!allDone ? `  ·  ${left} nobody had yet` : ''}
      </Text>
      <TouchableOpacity style={styles.button} onPress={goNext} activeOpacity={0.85}>
        <Text style={styles.buttonText}>
          {hasNext ? 'Done · next person →' : allDone ? 'SEE THE SPLIT →' : `Who had the ${left} left? ↑`}
        </Text>
      </TouchableOpacity>
      {hasNext && allDone ? (
        <TouchableOpacity onPress={() => onNext(claims, nonDrinkers)} style={{ alignSelf: 'center', marginTop: 10 }}>
          <Text style={styles.skipLink}>Everyone's picked? See the split →</Text>
        </TouchableOpacity>
      ) : null}

      {/* What's this? — a private pop-up about one item */}
      <Modal visible={info >= 0} transparent animationType="fade" onRequestClose={() => setInfo(-1)}>
        <TouchableOpacity style={styles.infoOverlay} activeOpacity={1} onPress={() => setInfo(-1)}>
          {info >= 0 && (() => {
            const it = items[info];
            const kind = kindOf(it);
            const tag = kind === 'alcohol'
              ? { text: '🍺 Contains alcohol', style: styles.tagAlcohol }
              : kind === 'soft'
                ? { text: '🥤 No alcohol', style: styles.tagSoft }
                : { text: '🍽️ Food', style: styles.tagFood };
            return (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{it.name}</Text>
                <View style={[styles.infoTag, tag.style]}>
                  <Text style={styles.infoTagText}>{tag.text}</Text>
                </View>
                <Text style={styles.infoAbout}>
                  {it.about ? it.about : "We don't have a description for this one yet."}
                </Text>
                <Text style={styles.infoNote}>AI's best guess from the bill. Ask the staff if you're not sure.</Text>
                <TouchableOpacity style={styles.infoBtn} onPress={() => setInfo(-1)}>
                  <Text style={styles.buttonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  faces: { flexGrow: 0, marginTop: 4, marginBottom: 10 },
  face: { alignItems: 'center', width: 74, marginRight: 4 },
  faceRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  faceDot: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  faceInit: { color: C.onLime, fontSize: 18, fontWeight: '900' },
  faceTick: { position: 'absolute', top: 0, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  faceTickText: { color: C.onLime, fontSize: 11, fontWeight: '900' },
  faceName: { color: C.sub, fontSize: 13, fontWeight: '800', marginTop: 4, maxWidth: 72 },
  faceAmt: { color: C.faint, fontSize: 11, fontWeight: '700' },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  opt: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 6 },
  optOn: { backgroundColor: C.cyan, borderColor: C.cyan },
  optLate: { backgroundColor: C.violet, borderColor: C.violet },
  optText: { color: C.sub, fontSize: 13, fontWeight: '700' },
  optTextOn: { color: C.onLime },
  tick: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 2, borderColor: C.border, borderRadius: 22, padding: 16, marginBottom: 10 },
  tickOn: { borderColor: C.lime, backgroundColor: 'rgba(226,255,59,0.12)' },
  tickOff: { opacity: 0.45 },
  box: { width: 34, height: 34, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  boxOn: { backgroundColor: C.lime, borderColor: C.lime },
  boxTick: { color: C.onLime, fontSize: 18, fontWeight: '900' },
  tickName: { color: C.text, fontSize: 17, fontWeight: '800' },
  tickKind: { fontSize: 13 },
  tickNote: { color: C.faint, fontSize: 12, marginTop: 3 },
  tickPrice: { fontFamily: F.bold, color: C.text, fontSize: 18 },
  alsoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  alsoDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.card },
  alsoInit: { color: C.onLime, fontSize: 9, fontWeight: '900' },
  alsoText: { color: C.sub, fontSize: 12, marginLeft: 6 },
  nobodyNote: { color: C.red, fontSize: 12, fontWeight: '800', marginTop: 4 },
  howMany: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  howManyText: { color: C.sub, fontSize: 13, fontWeight: '700', marginRight: 8 },
  equalLink: { alignSelf: 'center', paddingVertical: 10 },
  skipLink: { color: C.sub, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  hintLong: { color: C.faint, fontSize: 12, textAlign: 'center', marginBottom: 8 },
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.lime, fontSize: 16, marginBottom: 10 },
  title: { fontFamily: F.display, fontSize: 26, color: C.text },
  cuts: { flexGrow: 0, marginBottom: 12 },
  cut: { alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, marginRight: 8, minWidth: 72 },
  cutFace: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cutInit: { color: C.onLime, fontSize: 11, fontWeight: '900' },
  cutName: { color: C.sub, fontSize: 11, fontWeight: '700', marginTop: 4, maxWidth: 64 },
  cutAmt: { fontFamily: F.bold, color: C.lime, fontSize: 13, marginTop: 1 },
  av: { alignItems: 'center', width: 58, marginRight: 4, marginBottom: 6 },
  avBlocked: { opacity: 0.4 },
  avFace: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avOff: { backgroundColor: C.cardHi, borderColor: C.border, borderStyle: 'dashed' },
  avInit: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  avBadge: { position: 'absolute', right: -6, top: -6, backgroundColor: C.onLime, borderRadius: 9, paddingHorizontal: 4, borderWidth: 1, borderColor: C.lime },
  avBadgeText: { color: C.lime, fontSize: 11, fontWeight: '900' },
  avName: { color: C.faint, fontSize: 11, fontWeight: '700', marginTop: 4, maxWidth: 56 },
  avAll: { backgroundColor: 'transparent', borderColor: C.lime },
  avAllText: { color: C.lime, fontSize: 11, fontWeight: '900' },
  sub: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 12 },
  dryBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, marginBottom: 12 },
  dryLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: C.cyan, marginBottom: 8 },
  dryChip: { borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 11, marginRight: 8, marginBottom: 6, backgroundColor: C.bg },
  dryChipOn: { backgroundColor: C.cyan, borderColor: C.cyan },
  dryText: { color: C.sub, fontSize: 13 },
  dryTextOn: { color: C.onLime, fontWeight: '800' },
  list: { flex: 1 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, marginBottom: 10 },
  mysteryCard: { borderColor: C.red, borderWidth: 2, backgroundColor: 'rgba(255,80,80,0.08)' },
  nobody: { color: C.red, fontSize: 13, fontWeight: '800', marginTop: 6 },
  roundHead: { fontFamily: F.pixel, color: C.lime, fontSize: 11, marginTop: 8, marginBottom: 8 },
  lateChipOn: { backgroundColor: C.violet, borderColor: C.violet },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  nameTap: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 16, fontWeight: '700', color: C.text },
  infoIcon: { fontSize: 14 },
  itemPrice: { fontFamily: F.bold, fontSize: 15, color: C.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: C.accent, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.accent },
  chipBlocked: { borderColor: C.border, backgroundColor: C.bg },
  chipText: { color: C.accentSoft, fontSize: 14 },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  chipTextBlocked: { color: C.faint },
  chipAll: { borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  chipAllText: { color: C.sub, fontSize: 14 },
  shared: { color: C.faint, fontSize: 13, marginTop: 2 },
  equalBtn: { alignSelf: 'flex-start', backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 12 },
  equalText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  countBox: { backgroundColor: C.bg, borderRadius: 12, padding: 10, marginTop: 2 },
  countTitle: { color: C.sub, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  countSum: { color: C.green, fontWeight: '600' },
  countOff: { color: C.amber },
  countRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  countName: { flex: 1, color: C.text, fontSize: 14 },
  step: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: C.text, fontSize: 17 },
  countNum: { color: C.text, fontSize: 15, fontWeight: '800', width: 30, textAlign: 'center' },
  countAmt: { color: C.faint, fontSize: 13, width: 64, textAlign: 'right' },
  count: { color: C.faint, textAlign: 'center', marginVertical: 10 },
  button: { backgroundColor: C.lime, padding: 16, borderRadius: 18, alignItems: 'center', borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  disabled: { backgroundColor: C.disabled },
  buttonText: { color: C.onLime, fontSize: 15, fontWeight: '900' },

  infoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 28 },
  infoCard: { backgroundColor: C.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border },
  infoTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: C.text },
  infoTag: { alignSelf: 'flex-start', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 14 },
  tagAlcohol: { backgroundColor: C.amberBg },
  tagSoft: { backgroundColor: C.greenBg },
  tagFood: { backgroundColor: C.cardHi },
  infoTagText: { fontSize: 14, fontWeight: '700', color: C.text },
  infoAbout: { fontSize: 16, color: C.sub, lineHeight: 22 },
  infoNote: { fontSize: 13, color: C.faint, marginTop: 14 },
  infoBtn: { backgroundColor: C.lime, padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 18, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
});