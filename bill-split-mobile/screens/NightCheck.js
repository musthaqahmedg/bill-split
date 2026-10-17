import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { show } from '../services/names';
import { CHEERS, EXTRAS, HABITS, getNight, isSafe, saveNight, setDriver } from '../services/safety';
import { C } from '../services/theme';

const EMPTY = { ate_first: false, water: false, own_limit: false, home_safe: true, sober: false, driver: false };

// 🌙 Night check-in: who's home safe, who's driving, and your own safe-night streak
export default function NightCheck({ party, onChanged }) {
  const members = (party.party_members || []).filter((m) => m.rsvp !== 'out');
  const me = members.find((m) => m.name === 'Me');
  const home = members.filter((m) => m.home_at);
  const drivers = members.filter((m) => m.is_driver);

  const [mine, setMine] = useState(null); // my saved check-in for this plan
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    getNight(party.id).then(setMine).catch(() => {});
  }, [party.id]);

  const start = () => {
    setAnswers(mine ? { ...EMPTY, ...pick(mine) } : { ...EMPTY, driver: !!(me && me.is_driver) });
    setResult(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await saveNight(party, me, answers);
      setMine({ ...answers });
      setResult(r);
      onChanged && onChanged();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDriver = async (m) => {
    try {
      await setDriver(m.id, !m.is_driver);
      onChanged && onChanged();
    } catch (e) {
      Alert.alert("Couldn't update", e.message);
    }
  };

  const flip = (k) => setAnswers((a) => ({ ...a, [k]: !a[k] }));
  const sober = answers.sober || answers.driver;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>🌙 Night check-in</Text>

      <Text style={styles.line}>🏠 {home.length} of {members.length} home safe</Text>
      <View style={styles.chips}>
        {members.map((m) => (
          <View key={m.id} style={[styles.chip, m.home_at && styles.chipOn]}>
            <Text style={[styles.chipText, m.home_at && styles.chipTextOn]}>{m.home_at ? '✓ ' : '⏳ '}{show(m.name)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.driverRow} onPress={() => setPicking(true)}>
        <Text style={styles.line}>🛡️ {drivers.length ? `Driver: ${drivers.map((d) => show(d.name)).join(', ')}` : 'No driver yet'}</Text>
        <Text style={styles.change}>{drivers.length ? 'change ›' : 'Pick one ›'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, mine && styles.btnDone]} onPress={start}>
        <Text style={styles.btnText}>{mine ? '✅ Checked in · edit' : "🏠 I'm home safe"}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Tap when you're home. Safe nights build your 🔥 streak. Drinks are never counted.</Text>

      {/* Check-in sheet */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {result ? (
              <View style={styles.result}>
                <Text style={styles.big}>{result.safe ? '🔥' : '💜'}</Text>
                <Text style={styles.resultTitle}>
                  {result.safe ? `${result.current} safe night${result.current === 1 ? '' : 's'} in a row!` : 'Home is what matters'}
                </Text>
                <Text style={styles.resultSub}>
                  {result.safe ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : "No streak tonight, and that's okay. Next time 💜"}
                </Text>
                {result.newBadges.map((b) => (
                  <Text key={b.id} style={styles.badgeNew}>{b.icon} New badge: {b.name}!</Text>
                ))}
                <Text style={styles.best}>Best streak: {result.best}</Text>
                <TouchableOpacity style={styles.btn} onPress={() => setOpen(false)}>
                  <Text style={styles.btnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView>
                <Text style={styles.sheetTitle}>How was tonight? 🌙</Text>
                <Text style={styles.sheetSub}>Just for you. Your friends only see that you're home.</Text>
                {EXTRAS.map((h) => (
                  <Row key={h.key} h={h} on={answers[h.key]} onPress={() => flip(h.key)} />
                ))}
                {!sober && <Text style={styles.group}>Tonight I…</Text>}
                {HABITS.filter((h) => !sober || h.key === 'home_safe').map((h) => (
                  <Row key={h.key} h={h} on={answers[h.key]} onPress={() => flip(h.key)} />
                ))}
                <Text style={[styles.preview, isSafe(answers) ? styles.ok : styles.no]}>
                  {isSafe(answers) ? '🔥 This counts as a safe night' : 'Not a streak night, still glad you told us 💜'}
                </Text>
                <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
                  <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save check-in'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Pick the designated driver */}
      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPicking(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>🛡️ Who's driving tonight?</Text>
            <Text style={styles.sheetSub}>They stay sober and get everyone home. Tap to choose.</Text>
            {members.map((m) => (
              <TouchableOpacity key={m.id} style={styles.person} onPress={() => toggleDriver(m)}>
                <Text style={styles.personName}>{show(m.name)}</Text>
                <Text style={styles.tick}>{m.is_driver ? '🛡️' : '○'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPicking(false)}>
              <Text style={styles.cancel}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const pick = (n) => ({
  ate_first: n.ate_first, water: n.water, own_limit: n.own_limit, home_safe: n.home_safe, sober: n.sober, driver: n.driver,
});

function Row({ h, on, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rowText}>{h.emoji}  {h.label}</Text>
      <Switch value={!!on} onValueChange={onPress} trackColor={{ true: C.green }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  title: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  line: { color: C.text, fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 9, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.sub, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: '#06281C' },
  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  change: { color: C.accentSoft, fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnDone: { backgroundColor: C.cardHi },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hint: { color: C.faint, fontSize: 11, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  sheetSub: { color: C.faint, fontSize: 13, marginTop: 2, marginBottom: 12 },
  group: { color: C.faint, fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  rowText: { color: C.text, fontSize: 15, flex: 1 },
  preview: { fontSize: 14, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  ok: { color: C.green },
  no: { color: C.sub },
  cancel: { color: C.sub, fontSize: 15, textAlign: 'center', marginTop: 14 },
  result: { alignItems: 'center' },
  big: { fontSize: 64 },
  resultTitle: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  resultSub: { color: C.sub, fontSize: 15, textAlign: 'center', marginTop: 6 },
  badgeNew: { color: C.amber, fontSize: 16, fontWeight: '800', marginTop: 10 },
  best: { color: C.faint, fontSize: 13, marginTop: 10 },
  person: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  personName: { color: C.text, fontSize: 16, fontWeight: '600' },
  tick: { fontSize: 18, color: C.faint },
});
