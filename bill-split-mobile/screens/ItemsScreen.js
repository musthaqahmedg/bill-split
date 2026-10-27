import { useRef, useState } from 'react';
import NumberWheel from './NumberWheel';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KINDS, kindOf } from '../services/kinds';
import { show } from '../services/names';
import { C, F } from '../services/theme';
import BillSteps from './BillSteps';

export default function ItemsScreen({ items, people, initialClaims, initialNonDrinkers, onBack, onNext }) {
  const [nonDrinkers, setNonDrinkers] = useState(
    (initialNonDrinkers || []).filter((p) => people.includes(p))
  );
  const [claims, setClaims] = useState(
    items.map((_, i) => ((initialClaims && initialClaims[i]) || []).filter((p) => people.includes(p)))
  );

  // "What's this?" pop-up: which item is open (-1 = none)
  const [info, setInfo] = useState(-1);

  const isAlcohol = (i) => kindOf(items[i]) === 'alcohol';
  const canHave = (i, person) => !(isAlcohol(i) && nonDrinkers.includes(person));
  const eligible = (i) => people.filter((p) => canHave(i, p));

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

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>

      <BillSteps at={3} />
      <Text style={styles.title}>Who had what?</Text>
      <Text style={styles.sub}>Tap everyone who had each item. Shared items split between them.</Text>
      <TouchableOpacity style={styles.equalBtn} onPress={splitEqually}>
        <Text style={styles.equalText}>🤷 Can’t remember? Split everything equally</Text>
      </TouchableOpacity>

      <View style={styles.dryBox}>
        <Text style={styles.dryLabel}>Not drinking?</Text>
        <View style={styles.chips}>
          {people.map((p) => {
            const dry = nonDrinkers.includes(p);
            return (
              <TouchableOpacity key={p} style={[styles.dryChip, dry && styles.dryChipOn]} onPress={() => toggleDrinking(p)}>
                <Text style={[styles.dryText, dry && styles.dryTextOn]}>{dry ? `🥤 ${show(p)}` : show(p)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView style={styles.list} ref={listRef}>
        {items.map((item, i) => {
          const mystery = claims[i].length === 0;
          const who = [...new Set(claims[i])];
          const counted = who.length !== claims[i].length;
          const canCount = item.qty > 1 && who.length > 1; // only matters when 2+ people share it
          const k = KINDS[kindOf(item)];
          return (
            <View key={i} style={[styles.card, mystery && styles.mysteryCard]} onLayout={(e) => (cardY.current[i] = e.nativeEvent.layout.y)}>
              <View style={styles.cardTop}>
                <TouchableOpacity style={styles.nameTap} onPress={() => setInfo(i)}>
                  <Text style={styles.itemName}>
                    {mystery ? '🕵️ ' : ''}{k.emoji} {item.qty > 1 ? `${item.qty} × ` : ''}{item.name}
                    <Text style={styles.infoIcon}>  🔍</Text>
                  </Text>
                </TouchableOpacity>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>

              <View style={styles.chips}>
                {people.map((p) => {
                  const on = claims[i].includes(p);
                  const n = unitsOf(i, p);
                  const blocked = !canHave(i, p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, on && styles.chipOn, blocked && styles.chipBlocked]}
                      onPress={() => toggle(i, p)}
                      disabled={blocked}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn, blocked && styles.chipTextBlocked]}>
                        {blocked ? `🥤 ${show(p)}` : show(p)}{n > 1 ? ` ×${n}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.chipAll} onPress={() => toggleAll(i)}>
                  <Text style={styles.chipAllText}>All</Text>
                </TouchableOpacity>
              </View>

              {canCount ? (
                <View style={styles.countBox}>
                  <Text style={styles.countTitle}>
                    🔢 How many each? <Text style={[styles.countSum, claims[i].length !== item.qty && styles.countOff]}>
                      {claims[i].length} of {item.qty} counted
                    </Text>
                  </Text>
                  {who.map((p) => (
                    <View key={p} style={styles.countRow}>
                      <Text style={styles.countName} numberOfLines={1}>{show(p)}</Text>
                      <NumberWheel value={unitsOf(i, p)} min={1} max={item.qty} onChange={(n) => setUnits(i, p, n)} />
                      <Text style={styles.countAmt}>₹{((item.price * unitsOf(i, p)) / claims[i].length).toFixed(0)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {who.length > 1 && !counted && !canCount && (
                <Text style={styles.shared}>
                  Split {who.length} ways · ₹{(item.price / who.length).toFixed(2)} each
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.count}>
        {claimed} of {items.length} items claimed{!allDone ? '  ·  🕵️ = mystery item' : ''}
      </Text>

      <TouchableOpacity style={[styles.button, !allDone && styles.disabled]} onPress={next}>
        <Text style={styles.buttonText}>
          {allDone ? 'See the split' : `Tag ${left} more item${left === 1 ? '' : 's'} to continue ↑`}
        </Text>
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontFamily: F.display, fontSize: 22, color: C.text },
  sub: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 12 },
  dryBox: { backgroundColor: C.greenBg, borderRadius: 16, padding: 12, marginBottom: 12 },
  dryLabel: { fontSize: 14, fontWeight: '700', color: C.green, marginBottom: 8 },
  dryChip: { borderWidth: 1, borderColor: '#1E5A44', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 11, marginRight: 8, marginBottom: 6, backgroundColor: C.bg },
  dryChipOn: { backgroundColor: C.green, borderColor: C.green },
  dryText: { color: C.green, fontSize: 13 },
  dryTextOn: { color: '#0B2A1F', fontWeight: '700' },
  list: { flex: 1 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  mysteryCard: { borderColor: C.amber, backgroundColor: C.amberBg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  nameTap: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 16, fontWeight: '700', color: C.text },
  infoIcon: { fontSize: 14 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: C.sub },
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
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center' },
  disabled: { backgroundColor: '#34343F' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  infoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 28 },
  infoCard: { backgroundColor: C.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.border },
  infoTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: C.text },
  infoTag: { alignSelf: 'flex-start', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 14 },
  tagAlcohol: { backgroundColor: C.amberBg },
  tagSoft: { backgroundColor: C.greenBg },
  tagFood: { backgroundColor: C.cardHi },
  infoTagText: { fontSize: 14, fontWeight: '700', color: C.text },
  infoAbout: { fontSize: 16, color: C.sub, lineHeight: 22 },
  infoNote: { fontSize: 12, color: C.faint, marginTop: 14 },
  infoBtn: { backgroundColor: C.accent, padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 18 },
});