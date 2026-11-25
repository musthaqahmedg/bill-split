import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, KeyboardAvoidingView, PanResponder, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardDone from './KeyboardDone';
import LoadError from '../components/LoadError';
import {
  POCKET_KINDS, cycleFor, cycleSpends, dayStr, getPockets, leftToAssign, pocketBalances, removeSpend, rollOverIfNeeded, saveSetup, spendFromPocket,
  suggestAmounts, suggestBillPocket, tagBill, tonightPocket, alertAfterSpend, forecast, weeklyCheck, cycleSummary, previousCycle, setPocketLock,
  movePocket, setGoal, goalSpends, goalProgress, moodFor, cleanStreak, badgesFor, setPocketFlag,
} from '../services/pockets';
import { listBills } from '../services/bills';
import { homeBalance } from '../services/settle';
import { myGroupMoney } from '../services/groupExpenses';
import { getBudgets, saveBudget } from '../services/budget';
import PocketPicker from '../components/PocketPicker';
import { C, F } from '../services/theme';

// 💰 Pockets (Gautham's brief, Build 1): every rupee of income gets a pocket, spends come out live,
// and the header always says what's still yours this cycle. Setup → Pockets screen → tap a pocket.

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const EMOJIS = ['💰', '🏠', '🛒', '🚕', '📱', '🧴', '🍽️', '🪩', '🧯', '🐷', '🎁', '✈️', '🎓', '💊', '🐶', '🎮', '👟', '💡', '🏋️', '🎯'];
const TILE_COLS = [C.lime, C.pink, C.violet, C.cyan, C.orange, C.mint, C.yellow];
const STICKER = { borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' };

// ---------- setup: income → cycle → assign every rupee ----------
function Setup({ initial, onSaved, onCancel }) {
  const [step, setStep] = useState(initial ? 2 : 1);
  const [income, setIncome] = useState(initial ? String(Math.round(initial.setup.income)) : '');
  const [cycle, setCycle] = useState(initial ? initial.setup.cycle : 'monthly');
  const [payDay, setPayDay] = useState(initial ? Number(String(initial.setup.payday).slice(8, 10)) : 1);
  const [rollover, setRollover] = useState(initial ? initial.setup.rollover : true);
  const [pockets, setPockets] = useState(initial ? initial.pockets.map((p) => ({ ...p, amount: Math.round(p.amount) })) : []);
  const [editing, setEditing] = useState(null); // index of the pocket being renamed
  const [saving, setSaving] = useState(false);
  const inc = Math.round(Number(income) || 0);
  const left = leftToAssign(inc, pockets);

  const toStep2 = () => {
    if (!(inc > 0)) return Alert.alert('Income?', 'Type how much comes in each cycle.');
    if (!pockets.length) setPockets(suggestAmounts(inc));
    setStep(2);
  };

  const setAmt = (i, t) => setPockets((ps) => ps.map((p, j) => (j === i ? { ...p, amount: Number(t.replace(/[^0-9]/g, '').slice(0, 8)) || 0 } : p)));
  const patch = (i, v) => setPockets((ps) => ps.map((p, j) => (j === i ? { ...p, ...v } : p)));
  const remove = (i) => setPockets((ps) => ps.filter((_, j) => j !== i));
  const add = () => {
    // new pockets go just above Savings, which stays last
    const at = pockets.findIndex((p) => p.is_savings);
    const idx = at < 0 ? pockets.length : at;
    setPockets((ps) => [...ps.slice(0, idx), { name: 'New pocket', emoji: '💰', kind: 'variable', amount: 0 }, ...ps.slice(idx)]);
    setEditing(idx);
  };
  const restToSavings = () => {
    const i = pockets.findIndex((p) => p.is_savings);
    if (i < 0) return;
    setPockets((ps) => ps.map((p, j) => (j === i ? { ...p, amount: Math.max(0, p.amount + left) } : p)));
  };

  const save = async () => {
    if (left !== 0) return;
    setSaving(true);
    try {
      const now = new Date();
      let pay = now; // every 2 weeks: the cycle starts today
      if (cycle === 'monthly') {
        const clamp = (y, m) => new Date(y, m, Math.min(payDay, new Date(y, m + 1, 0).getDate()));
        pay = clamp(now.getFullYear(), now.getMonth());
        if (pay > now) pay = clamp(now.getFullYear(), now.getMonth() - 1);
      }
      const keepBiweekly = initial && cycle === 'biweekly' && initial.setup.cycle === 'biweekly';
      await saveSetup({ income: inc, cycle, payday: keepBiweekly ? initial.setup.payday : dayStr(pay), rollover }, pockets);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      onSaved();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
    setSaving(false);
  };

  if (step === 1) {
    return (
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onCancel} hitSlop={10}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Pockets 💰</Text>
        <Text style={styles.sub}>Give every rupee a job. Spends come out of a pocket, so you always know what's still yours.</Text>

        <Text style={styles.label}>HOW MUCH COMES IN?</Text>
        <View style={styles.incomeBox}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput style={styles.incomeInput} value={income} onChangeText={(t) => setIncome(t.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="40000"
            placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
        </View>
        <Text style={styles.hint}>Salary, pocket money, freelance… whatever you live on. Only you see this.</Text>

        <Text style={styles.label}>HOW OFTEN?</Text>
        <View style={styles.row}>
          {[['monthly', '📅 Monthly'], ['biweekly', '🗓️ Every 2 weeks']].map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.chip, cycle === k && styles.chipOn]} onPress={() => setCycle(k)}>
              <Text style={[styles.chipText, cycle === k && styles.chipTextOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {cycle === 'monthly' ? (
          <>
            <Text style={styles.label}>PAYDAY (DAY OF THE MONTH)</Text>
            <View style={styles.row}>
              {[1, 5, 7, 10, 15, 25, 28, 30].map((d) => (
                <TouchableOpacity key={d} style={[styles.dayChip, payDay === d && styles.chipOn]} onPress={() => setPayDay(d)}>
                  <Text style={[styles.chipText, payDay === d && styles.chipTextOn]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>Your 2-week cycle starts today.</Text>
        )}

        <TouchableOpacity style={[styles.cta, !(inc > 0) && styles.off]} onPress={toStep2} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Next: fill my pockets →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (initial ? onCancel() : setStep(1))} hitSlop={10}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Fill your pockets</Text>
        <Text style={styles.sub}>{inr(inc)} {cycle === 'monthly' ? 'a month' : 'every 2 weeks'}. We split it for you, change anything.</Text>
        {initial ? (
          <TouchableOpacity onPress={() => setStep(1)}><Text style={styles.link}>Change income or payday</Text></TouchableOpacity>
        ) : null}

        {pockets.map((p, i) => (
          <View key={p.id || `n${i}`} style={styles.editRow}>
            <TouchableOpacity onPress={() => setEditing(editing === i ? null : i)} style={styles.editLeft} activeOpacity={0.7}>
              <Text style={styles.editEmoji}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.editName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.editKind}>{POCKET_KINDS[p.kind].emoji} {POCKET_KINDS[p.kind].label}{p.is_savings ? ' · leftovers land here' : ''} ✏️</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.amtBox}>
              <Text style={styles.amtRupee}>₹</Text>
              <TextInput style={styles.amtInput} value={p.amount ? String(p.amount) : ''} onChangeText={(t) => setAmt(i, t)} placeholder="0"
                placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
            </View>
            {editing === i ? (
              <View style={styles.editPanel}>
                <TextInput style={styles.nameInput} value={p.name} onChangeText={(t) => patch(i, { name: t.slice(0, 40) })} keyboardAppearance="dark" placeholder="Pocket name" placeholderTextColor={C.faint} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {EMOJIS.map((e) => (
                    <TouchableOpacity key={e} onPress={() => patch(i, { emoji: e })} style={[styles.emojiPick, p.emoji === e && styles.chipOn]}>
                      <Text style={{ fontSize: 20 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={[styles.row, { marginTop: 8 }]}>
                  {Object.entries(POCKET_KINDS).map(([k, v]) => (
                    <TouchableOpacity key={k} style={[styles.kindChip, p.kind === k && styles.chipOn]} onPress={() => !p.is_savings && patch(i, { kind: k })}>
                      <Text style={[styles.chipText, p.kind === k && styles.chipTextOn]}>{v.emoji} {v.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!p.is_savings ? (
                  <TouchableOpacity onPress={() => { remove(i); setEditing(null); }}><Text style={styles.remove}>Remove this pocket</Text></TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={add}><Text style={styles.addText}>➕ Add a pocket</Text></TouchableOpacity>

        <TouchableOpacity style={styles.toggleRow} onPress={() => setRollover(!rollover)} activeOpacity={0.8}>
          <Text style={styles.toggleText}>💸 Move leftovers into Savings on payday</Text>
          <View style={[styles.switch, rollover && styles.switchOn]}><View style={[styles.knob, rollover && styles.knobOn]} /></View>
        </TouchableOpacity>
      </ScrollView>

      {/* "Left to assign" must hit zero */}
      <View style={styles.footer}>
        <View style={styles.footRow}>
          <Text style={styles.footLabel}>LEFT TO ASSIGN</Text>
          <Text style={[styles.footAmt, { color: left === 0 ? C.lime : left < 0 ? C.red : C.pink }]}>{left < 0 ? `−${inr(-left)}` : inr(left)}</Text>
        </View>
        {left !== 0 ? (
          <Text style={styles.footHint}>
            {left > 0 ? 'Give every rupee a pocket. ' : `You've assigned more than you earn. `}
            <Text style={styles.link} onPress={restToSavings}>{left > 0 ? 'Put the rest in Savings' : 'Take it from Savings'}</Text>
          </Text>
        ) : null}
        <TouchableOpacity style={[styles.cta, { marginTop: 10 }, (left !== 0 || saving) && styles.off]} onPress={save} disabled={left !== 0 || saving}>
          {saving ? <ActivityIndicator color={C.onLime} /> : <Text style={styles.ctaText}>{left === 0 ? '✅ Save my pockets' : 'Assign every rupee to save'}</Text>}
        </TouchableOpacity>
      </View>
      <KeyboardDone />
    </View>
  );
}

// ---------- one pocket: what's left, spends this cycle, add a spend ----------
function PocketSheet({ pocket, spends, onClose, onChanged, onMove, onGoal }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!pocket) return null;

  const add = async () => {
    if (!(Number(amount) > 0)) return;
    setBusy(true);
    try {
      await spendFromPocket({ pocketId: pocket.id, amount, note });
      alertAfterSpend(pocket.id, amount);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      setAmount('');
      setNote('');
      onChanged();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
    setBusy(false);
  };
  const del = (s) => s.bill
    ? Alert.alert('Take this bill out of the pocket?', `Your share ${inr(s.amount)} of ${s.note}. The bill itself stays.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Take it out', style: 'destructive', onPress: () => tagBill(s.bill_id, null).then(onChanged).catch((e) => Alert.alert("Couldn't change", e.message)) },
    ])
    : Alert.alert('Remove this spend?', `${inr(s.amount)}${s.note ? ` · ${s.note}` : ''}`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSpend(s.id).then(onChanged).catch((e) => Alert.alert("Couldn't remove", e.message)) },
    ]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{pocket.emoji} {pocket.name}</Text>
            <Text style={[styles.sheetLeft, { color: pocket.empty ? C.red : pocket.low ? C.pink : C.lime }]}>
              {pocket.left >= 0 ? `${inr(pocket.left)} left` : `${inr(-pocket.left)} over`}
            </Text>
            <Text style={styles.sub}>{inr(pocket.spent)} spent of {inr(pocket.budget)} this cycle{pocket.is_savings && pocket.budget > pocket.amount ? ` (incl. ${inr(pocket.budget - pocket.amount)} rolled over)` : ''}</Text>
            {pocket.empty ? <Text style={styles.warn}>Pocket empty, no party tonight 😅</Text> : pocket.low ? <Text style={styles.warn}>Running low: under 20% left ⚠️</Text> : null}
            <View style={[styles.row, { marginTop: 10 }]}>
              <TouchableOpacity style={styles.chip} onPress={onMove}><Text style={styles.chipText}>↔️ Move money</Text></TouchableOpacity>
              {pocket.kind === 'goal' ? (
                <TouchableOpacity style={styles.chip} onPress={onGoal}><Text style={styles.chipText}>🎯 {pocket.target ? 'Change goal' : 'Set a goal'}</Text></TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.spendRow}>
              <Text style={styles.amtRupee}>₹</Text>
              <TextInput style={[styles.amtInput, { flex: 1, textAlign: 'left' }]} value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, '').slice(0, 7))}
                placeholder="Spent how much?" placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
            </View>
            <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={C.faint} keyboardAppearance="dark" maxLength={80} />
            <TouchableOpacity style={[styles.cta, { marginTop: 10 }, (!(Number(amount) > 0) || busy) && styles.off]} onPress={add} disabled={!(Number(amount) > 0) || busy}>
              <Text style={styles.ctaText}>{busy ? 'Saving…' : `Take ${amount ? inr(amount) : ''} out of ${pocket.name}`}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>THIS CYCLE</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {spends.length ? spends.map((s) => (
                <TouchableOpacity key={s.id} style={styles.spendItem} onLongPress={() => del(s)} activeOpacity={0.7}>
                  <Text style={styles.spendNote} numberOfLines={1}>{s.bill ? '🧾 ' : ''}{s.note || 'Spend'}{s.bill ? ' · your share' : ''}</Text>
                  <Text style={styles.spendAmt}>−{inr(s.amount)}</Text>
                </TouchableOpacity>
              )) : <Text style={styles.hint}>Nothing spent from this pocket yet.</Text>}
              {spends.length ? <Text style={styles.hint}>Long-press a spend to remove it. Bill shares follow what you actually had.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- ↔️ move money between pockets ----------
function MoveSheet({ from, pockets, rows, onClose, onDone }) {
  const [a, setA] = useState(from);
  const [b, setB] = useState((pockets.find((p) => p.is_savings && p.id !== from) || pockets.find((p) => p.id !== from) || {}).id);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const leftOf = (id) => (rows.find((r) => r.id === id) || {}).left || 0;
  const go = async () => {
    setBusy(true);
    try {
      await movePocket(a, b, amount);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      onDone();
    } catch (e) {
      Alert.alert("Couldn't move", e.message);
    }
    setBusy(false);
  };
  const Row = ({ label, val, set }) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {pockets.map((p) => (
          <TouchableOpacity key={p.id} style={[styles.chip, val === p.id && styles.chipOn]} onPress={() => set(p.id)}>
            <Text style={[styles.chipText, val === p.id && styles.chipTextOn]}>{p.emoji} {p.name} · {inr(leftOf(p.id))}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
  const ok = Number(amount) > 0 && a && b && a !== b;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>↔️ Move money</Text>
            <Text style={styles.sub}>Shift money between pockets. Your total stays the same.</Text>
            <Row label="FROM" val={a} set={setA} />
            <Row label="TO" val={b} set={setB} />
            <View style={styles.spendRow}>
              <Text style={styles.amtRupee}>₹</Text>
              <TextInput style={[styles.amtInput, { flex: 1, textAlign: 'left' }]} value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, '').slice(0, 7))}
                placeholder="How much?" placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
            </View>
            {ok && Number(amount) > leftOf(a) ? <Text style={styles.warn}>That's more than {(pockets.find((p) => p.id === a) || {}).name} has left.</Text> : null}
            <TouchableOpacity style={[styles.cta, { marginTop: 12 }, (!ok || busy) && styles.off]} onPress={go} disabled={!ok || busy}>
              <Text style={styles.ctaText}>{busy ? 'Moving…' : `Move ${amount ? inr(amount) : ''}`}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- 🎯 goal: target amount + by when ----------
function GoalSheet({ pocket, onClose, onDone }) {
  const [target, setTarget] = useState(pocket.target ? String(Math.round(pocket.target)) : '');
  const [months, setMonths] = useState(null);
  const [busy, setBusy] = useState(false);
  const dateFor = (m) => {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + m + 1, 0);
    return dayStr(end);
  };
  const save = async () => {
    setBusy(true);
    try {
      await setGoal(pocket.id, target, months ? dateFor(months) : pocket.target_date || null);
      onDone();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
    setBusy(false);
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>🎯 {pocket.name} goal</Text>
            <Text style={styles.sub}>Saving up for something? Set a target and a date.</Text>
            <View style={styles.spendRow}>
              <Text style={styles.amtRupee}>₹</Text>
              <TextInput style={[styles.amtInput, { flex: 1, textAlign: 'left' }]} value={target} onChangeText={(t) => setTarget(t.replace(/[^0-9]/g, '').slice(0, 9))}
                placeholder="Target, e.g. 60000" placeholderTextColor={C.faint} keyboardType="number-pad" keyboardAppearance="dark" />
            </View>
            <Text style={styles.label}>BY WHEN?</Text>
            <View style={styles.row}>
              {[3, 6, 12, 18, 24].map((m) => (
                <TouchableOpacity key={m} style={[styles.chip, months === m && styles.chipOn]} onPress={() => setMonths(m)}>
                  <Text style={[styles.chipText, months === m && styles.chipTextOn]}>{m < 12 ? `${m} months` : m === 12 ? '1 year' : `${m / 12} years`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {pocket.target_date && !months ? <Text style={styles.hint}>Now: by {new Date(pocket.target_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</Text> : null}
            <TouchableOpacity style={[styles.cta, { marginTop: 12 }, busy && styles.off]} onPress={save} disabled={busy}>
              <Text style={styles.ctaText}>{Number(target) > 0 ? '🎯 Save goal' : 'Remove goal'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- 🎉 payday confetti ----------
function Confetti({ onEnd }) {
  const { width, height } = Dimensions.get('window');
  const bits = useRef(Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * width, delay: Math.random() * 500, emoji: ['🎉', '💸', '✨', '🪙', '💰', '🎊'][i % 6], v: new Animated.Value(0),
  }))).current;
  useEffect(() => {
    Animated.parallel(bits.map((b) => Animated.sequence([Animated.delay(b.delay), Animated.timing(b.v, { toValue: 1, duration: 2200, easing: Easing.in(Easing.quad), useNativeDriver: true })]))).start(onEnd);
  }, []);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bits.map((b, i) => (
        <Animated.Text key={i} style={{ position: 'absolute', left: b.x, top: -40, fontSize: 24, transform: [{ translateY: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 80] }) }, { rotate: b.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 360}deg`] }) }] }}>
          {b.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

// ---------- one bento tile: swipe sideways to move money, tap to open ----------
function Tile({ r, wide, col, extra, onOpen, onSwipe }) {
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dy) < 12,
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 50) onSwipe(); },
  })).current;
  const mood = moodFor(r);
  return (
    <View {...pan.panHandlers} style={[wide ? styles.tileWide : styles.tileHalf]}>
      <TouchableOpacity style={[styles.tile, STICKER]} onPress={onOpen} activeOpacity={0.85}>
        <View style={[styles.tileFill, { height: `${Math.round(r.fill * 100)}%`, backgroundColor: r.empty ? C.red : r.low ? C.pink : col }]} />
        <Text style={styles.tileEmoji}>{r.emoji}</Text>
        <View style={styles.mascot}><Text style={styles.mascotFace}>{mood.face}</Text></View>
        <Text style={styles.tileName} numberOfLines={1}>{r.name}</Text>
        <Text style={styles.tileLeft}>{r.left >= 0 ? inr(r.left) : `−${inr(-r.left)}`}</Text>
        <Text style={styles.tileOf}>{r.empty ? 'empty 😅' : `left of ${inr(r.budget)}`}</Text>
        {extra}
      </TouchableOpacity>
    </View>
  );
}

// ---------- main ----------
export default function PocketsScreen({ onBack }) {
  const [state, setState] = useState(null);
  const [spends, setSpends] = useState([]);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState('view'); // view | setup | edit
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [untagged, setUntagged] = useState([]); // 🧾 bill shares this cycle not in a pocket yet
  const [tagging, setTagging] = useState(null);
  const [tonight, setTonight] = useState(0); // 🌙 Tonight Pocket (a slice of Going Out, resets tomorrow)
  const [tonightEdit, setTonightEdit] = useState(null);
  const [last, setLast] = useState(null); // 🧾 last cycle's summary (first week of a new cycle)
  const [lock, setLock] = useState(false);
  const [moveFrom, setMoveFrom] = useState(null); // ↔️ pocket id
  const [goalFor, setGoalFor] = useState(null); // 🎯 pocket
  const [goalOut, setGoalOut] = useState([]); // all-time spends from goal pockets
  const [incoming, setIncoming] = useState(null); // 💸 money friends owe you
  const [confetti, setConfetti] = useState(false);

  const load = async () => {
    setFailed(false);
    try {
      let s = await getPockets();
      if (s.setup) {
        const rolled = await rollOverIfNeeded(s).catch(() => null);
        if (rolled !== null) s = await getPockets();
        const cyc = cycleFor(s.setup);
        const cs = await cycleSpends(cyc.startStr);
        setSpends(cs.spends);
        setUntagged(cs.untagged);
        getBudgets().then((b) => setTonight(b.tonight || 0)).catch(() => {});
        setLock(!!s.setup.lock);
        const goals = s.pockets.filter((p) => p.kind === 'goal').map((p) => p.id);
        goalSpends(goals).then(setGoalOut).catch(() => {});
        // 💸 coming back to you: scanned bills + Manual Split groups
        Promise.all([listBills().catch(() => []), myGroupMoney().catch(() => ({ groups: [] }))]).then(([bills, gm]) => {
          const g = ((gm && gm.groups) || []).filter((x) => x.net > 0).reduce((a, x) => a + x.net, 0);
          setIncoming(Math.round(homeBalance(bills).owed + g));
        });
        // 🎉 payday: first open of a new cycle
        AsyncStorage.getItem('pockets_seen_cycle').then((seen) => {
          if (seen && seen !== cyc.startStr) setConfetti(true);
          AsyncStorage.setItem('pockets_seen_cycle', cyc.startStr).catch(() => {});
        }).catch(() => {});
        // first week of a new cycle: look back at the last one
        const prev = previousCycle(s.setup, cyc);
        if (cyc.daysLeft > 0 && new Date() - cyc.start < 7 * 86400000 && s.setup.created_at && new Date(s.setup.created_at) < cyc.start) {
          cycleSpends(prev.startStr)
            .then(({ spends: ps }) => setLast({ label: prev.label, ...cycleSummary(pocketBalances(s.pockets, ps, prev, 0, s.moves).rows) }))
            .catch(() => {});
        } else setLast(null);
      }
      setState(s);
      if (!s.setup) setMode('setup');
    } catch (e) {
      setFailed(true);
    }
  };
  useEffect(() => { load(); }, []);

  const view = useMemo(() => {
    if (!state || !state.setup) return null;
    const cyc = cycleFor(state.setup);
    const roll = (state.rollovers || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    return { cyc, roll, ...pocketBalances(state.pockets, spends, cyc, roll, state.moves) };
  }, [state, spends]);

  if (failed) return <View style={styles.container}><LoadError onRetry={load} onBack={onBack} /></View>;
  if (!state) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={C.lime} /></View>;

  if (mode === 'setup' || mode === 'edit') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Setup initial={mode === 'edit' ? state : null} onCancel={() => (state.setup ? setMode('view') : onBack())} onSaved={() => { setMode('view'); load(); }} />
      </KeyboardAvoidingView>
    );
  }

  const rows = view.rows.filter((r) => filter === 'all' || r.kind === filter);
  const openRow = open && view.rows.find((r) => r.id === open);
  const goingOut = view.rows.find((r) => r.name.toLowerCase() === 'going out');
  const tn = goingOut && tonight ? tonightPocket(tonight, spends.filter((x) => x.pocket_id === goingOut.id)) : null;
  const check = weeklyCheck(view.rows, view.cyc);
  const forecasts = view.rows.map((x) => forecast(x, view.cyc)).filter(Boolean);
  const flip = async (field) => {
    const on = !state.setup[field];
    setState({ ...state, setup: { ...state.setup, [field]: on } });
    try { await setPocketFlag(field, on); } catch (e) { Alert.alert("Couldn't save", e.message); load(); }
  };
  const toggleLock = async () => {
    const on = !lock;
    setLock(on);
    try { await setPocketLock(on); } catch (e) { setLock(!on); Alert.alert("Couldn't save", e.message); }
  };
  const saveTonight = async (amt) => {
    try {
      await saveBudget('tonight', amt);
      setTonight(Math.round(Number(amt) || 0));
      setTonightEdit(null);
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('edit')} hitSlop={10}><Text style={styles.back}>✏️ Edit</Text></TouchableOpacity>
        </View>
        <Text style={styles.title}>Pockets 💰</Text>

        <View style={[styles.hero, STICKER]}>
          <Text style={styles.heroKicker}>{view.cyc.label.toUpperCase()} · {view.cyc.daysLeft} DAY{view.cyc.daysLeft === 1 ? '' : 'S'} LEFT</Text>
          <Text style={styles.heroBig}>{inr(view.left)}</Text>
          <Text style={styles.heroSub}>of {inr(view.total)} is still yours this cycle</Text>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${view.total ? Math.round((view.left / view.total) * 100) : 0}%` }]} />
          </View>
        </View>

        {/* 🧾 bills from this cycle that aren't in a pocket yet */}
        {untagged.length ? (
          <View style={styles.untagged}>
            <Text style={styles.untagTitle}>🧾 {untagged.length} bill share{untagged.length === 1 ? '' : 's'} not in a pocket yet</Text>
            {untagged.slice(0, 4).map((u) => (
              <TouchableOpacity key={u.id} style={styles.untagRow} onPress={() => setTagging(u)} activeOpacity={0.8}>
                <Text style={styles.untagName} numberOfLines={1}>{u.note}</Text>
                <Text style={styles.untagAmt}>{inr(u.amount)} · Pick ›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* 🌙 Tonight Pocket */}
        {goingOut ? (
          <View style={[styles.tonight, STICKER]}>
            <View style={styles.topRow}>
              <Text style={styles.tonightKicker}>🌙 TONIGHT POCKET</Text>
              <TouchableOpacity onPress={() => setTonightEdit(tonight ? String(tonight) : '')} hitSlop={8}>
                <Text style={styles.tonightEdit}>{tonight ? 'Change' : 'Set'}</Text>
              </TouchableOpacity>
            </View>
            {tn ? (
              <>
                <Text style={styles.tonightBig}>{tn.left >= 0 ? `${inr(tn.left)} left tonight` : `${inr(-tn.left)} over tonight`}</Text>
                <View style={styles.tonightTrack}><View style={[styles.tonightFill, { width: `${Math.round((1 - tn.pct) * 100)}%`, backgroundColor: tn.left <= 0 ? C.red : C.onLime }]} /></View>
                <Text style={styles.tonightSub}>{inr(tn.spent)} spent of {inr(tn.amount)} from {goingOut.emoji} Going Out · resets tomorrow</Text>
              </>
            ) : (
              <Text style={styles.tonightSub}>Going out tonight? Set aside a slice of Going Out ({inr(Math.max(0, goingOut.left))} left) and watch it count down.</Text>
            )}
            {tonightEdit !== null ? (
              <View style={styles.tonightForm}>
                <View style={[styles.spendRow, { marginTop: 0, flex: 1 }]}>
                  <Text style={styles.amtRupee}>₹</Text>
                  <TextInput style={[styles.amtInput, { textAlign: 'left' }]} value={tonightEdit} autoFocus keyboardType="number-pad" keyboardAppearance="dark"
                    onChangeText={(t) => setTonightEdit(t.replace(/[^0-9]/g, '').slice(0, 7))} placeholder="1500" placeholderTextColor={C.faint} />
                </View>
                <TouchableOpacity style={styles.tonightSave} onPress={() => saveTonight(tonightEdit)}>
                  <Text style={[styles.ctaText, { color: C.lime }]}>{Number(tonightEdit) > 0 ? 'Save' : tonight ? 'Remove' : 'Close'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {tonightEdit !== null && Number(tonightEdit) > Math.max(0, goingOut.left) ? (
              <Text style={[styles.tonightSub, { fontWeight: '800' }]}>⚠️ That's more than Going Out has left ({inr(Math.max(0, goingOut.left))}).</Text>
            ) : null}
          </View>
        ) : null}

        {/* 🧾 last cycle in review */}
        {last ? (
          <View style={[styles.coach, { borderColor: C.violet }]}>
            <Text style={styles.coachKicker}>🧾 LAST CYCLE · {last.label.toUpperCase()}</Text>
            <Text style={styles.coachLine}>Spent {inr(last.spent)} · {inr(last.saved)} left over{last.over.length ? ` · ${last.over.length} pocket${last.over.length === 1 ? '' : 's'} went over` : ''}</Text>
            {last.tip ? <Text style={styles.coachTip}>💡 {last.tip}</Text> : null}
          </View>
        ) : null}

        {/* 📅 weekly check-in + forecast */}
        {check.over.length || check.room.length || forecasts.length ? (
          <View style={styles.coach}>
            <Text style={styles.coachKicker}>📅 CHECK-IN · {Math.round(check.passed * 100)}% OF THE CYCLE GONE</Text>
            {forecasts.slice(0, 2).map((f) => (
              <Text key={f.text} style={[styles.coachLine, { color: C.pink }]}>📉 {f.text}</Text>
            ))}
            {check.over.filter((o) => !forecasts.some((f) => f.text.includes(o.name))).slice(0, 2).map((o) => (
              <Text key={o.id} style={styles.coachLine}>⚠️ {o.emoji} {o.name} is spending fast: {Math.round((o.spent / o.budget) * 100)}% used</Text>
            ))}
            {check.room.slice(0, 2).map((o) => (
              <Text key={o.id} style={styles.coachLine}>✅ {o.emoji} {o.name} has room: {inr(o.left)} left</Text>
            ))}
          </View>
        ) : null}

        <View style={[styles.row, { marginTop: 16 }]}>
          {[['all', 'All'], ...Object.entries(POCKET_KINDS).map(([k, v]) => [k, `${v.emoji} ${v.label}`])].map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.chip, filter === k && styles.chipOn]} onPress={() => setFilter(k)}>
              <Text style={[styles.chipText, filter === k && styles.chipTextOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* bento tiles: emoji, what's left, fill level */}
        <View style={styles.grid}>
          {rows.map((r, i) => {
            const col = TILE_COLS[view.rows.indexOf(r) % TILE_COLS.length];
            const wide = i % 3 === 0;
            const f = forecast(r, view.cyc);
            const g = r.kind === 'goal' && r.target ? goalProgress(r, state.setup, { spends: goalOut, moves: state.moves, rolloverTotal: view.roll }) : null;
            const extra = (
              <>
                {f ? <Text style={styles.tileWarn}>📉 runs out {f.date}</Text> : null}
                {g ? (
                  <>
                    <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${Math.round(g.pct * 100)}%` }]} /></View>
                    <Text style={styles.goalText}>{g.done ? `🎉 Goal reached: ${inr(g.saved)}` : `🎯 ${inr(g.saved)} of ${inr(g.target)}${g.onTrack === true ? ' · on track ✅' : g.onTrack === false ? ` · needs ${inr(g.perCycleNeeded)}/cycle` : ''}`}</Text>
                  </>
                ) : null}
              </>
            );
            return <Tile key={r.id} r={r} wide={wide} col={col} extra={extra} onOpen={() => setOpen(r.id)} onSwipe={() => setMoveFrom(r.id)} />;
          })}
        </View>
        {!rows.length ? <Text style={styles.hint}>No pockets of this type yet.</Text> : null}
        <Text style={styles.hint}>Tap a pocket to take money out. Swipe a pocket sideways to move money. Quick Add spends also come out of a pocket.</Text>

        {/* 💸 pay-me-back */}
        {incoming ? (
          <View style={[styles.coach, { borderColor: C.lime }]}>
            <Text style={styles.coachKicker}>💸 COMING BACK TO YOU</Text>
            <Text style={[styles.coachLine, { fontFamily: F.display, fontSize: 22 }]}>{inr(incoming)}</Text>
            <Text style={styles.hint}>What friends still owe you from bills and group splits. Your pockets only ever lost your own share, so this is extra when it lands.</Text>
          </View>
        ) : null}

        {/* 🏅 opt-in badges (no amounts) */}
        {state.setup.badges ? (() => {
          const streak = cleanStreak(state.rollovers);
          const b = badgesFor(streak);
          return (
            <View style={styles.coach}>
              <Text style={styles.coachKicker}>🏅 YOUR BADGES</Text>
              {b.length ? (
                <View style={[styles.row, { marginTop: 4 }]}>
                  {b.map((x) => <View key={x.name} style={styles.badge}><Text style={styles.badgeText}>{x.emoji} {x.name}</Text></View>)}
                </View>
              ) : <Text style={styles.coachLine}>Finish a cycle without any pocket going over to start your 🔥 streak.</Text>}
            </View>
          );
        })() : null}

        <TouchableOpacity style={styles.toggleRow} onPress={() => flip('roundup')} activeOpacity={0.8}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.toggleText}>🪙 Round-up savings</Text>
            <Text style={styles.hint}>₹347 spent → ₹3 goes to Savings. Small change, adds up.</Text>
          </View>
          <View style={[styles.switch, state.setup.roundup && styles.switchOn]}><View style={[styles.knob, state.setup.roundup && styles.knobOn]} /></View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleRow} onPress={() => flip('badges')} activeOpacity={0.8}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.toggleText}>🏅 Badges</Text>
            <Text style={styles.hint}>Streaks for staying under budget. Badges only, never amounts.</Text>
          </View>
          <View style={[styles.switch, state.setup.badges && styles.switchOn]}><View style={[styles.knob, state.setup.badges && styles.knobOn]} /></View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toggleRow} onPress={toggleLock} activeOpacity={0.8}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.toggleText}>🔒 Pocket lock</Text>
            <Text style={styles.hint}>When Going Out is empty, check with me before a ticket, a table booking or a new bill.</Text>
          </View>
          <View style={[styles.switch, lock && styles.switchOn]}><View style={[styles.knob, lock && styles.knobOn]} /></View>
        </TouchableOpacity>
      </ScrollView>

      {tagging ? (
        <PocketPicker
          visible amount={tagging.amount} pockets={state.pockets} title={tagging.note}
          suggested={suggestBillPocket({ title: tagging.note }, state.pockets)}
          onPick={async (id) => { try { await tagBill(tagging.bill_id, id); alertAfterSpend(id, tagging.amount); } catch (e) { Alert.alert("Couldn't save", e.message); } setTagging(null); load(); }}
          onSkip={() => setTagging(null)}
        />
      ) : null}
      {openRow ? (
        <PocketSheet pocket={openRow} spends={spends.filter((s) => s.pocket_id === openRow.id)} onClose={() => setOpen(null)} onChanged={load}
          onMove={() => { setOpen(null); setMoveFrom(openRow.id); }} onGoal={() => { setOpen(null); setGoalFor(openRow); }} />
      ) : null}
      {moveFrom ? <MoveSheet from={moveFrom} pockets={state.pockets} rows={view.rows} onClose={() => setMoveFrom(null)} onDone={() => { setMoveFrom(null); load(); }} /> : null}
      {goalFor ? <GoalSheet pocket={goalFor} onClose={() => setGoalFor(null)} onDone={() => { setGoalFor(null); load(); }} /> : null}
      {confetti ? (
        <>
          <View pointerEvents="none" style={styles.paydayBanner}><Text style={styles.paydayText}>💸 Payday! Your pockets are full again</Text></View>
          <Confetti onEnd={() => setConfetti(false)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mascot: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }], borderRightWidth: 2, borderBottomWidth: 3, borderRightColor: C.bg, borderBottomColor: C.bg },
  mascotFace: { fontSize: 18 },
  goalTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 6, overflow: 'hidden' },
  goalFill: { height: 6, backgroundColor: C.lime },
  goalText: { color: C.text, fontSize: 11, fontWeight: '800', marginTop: 3 },
  badge: { backgroundColor: C.violet, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  badgeText: { color: C.onLime, fontSize: 12, fontWeight: '900' },
  paydayBanner: { position: 'absolute', top: 54, left: 20, right: 20, backgroundColor: C.lime, borderRadius: 16, padding: 12, alignItems: 'center' },
  paydayText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  coach: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, marginTop: 14 },
  coachKicker: { fontFamily: F.pixel, color: C.sub, fontSize: 10, marginBottom: 6 },
  coachLine: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 4, lineHeight: 20 },
  coachTip: { color: C.lime, fontSize: 14, fontWeight: '800', marginTop: 8 },
  tileWarn: { color: C.pink, fontSize: 11, fontWeight: '800', marginTop: 3 },
  untagged: { backgroundColor: C.card, borderWidth: 1, borderColor: C.pink, borderRadius: 18, padding: 14, marginTop: 14 },
  untagTitle: { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  untagRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  untagName: { color: C.sub, fontSize: 14, flex: 1, marginRight: 8 },
  untagAmt: { color: C.lime, fontSize: 14, fontWeight: '800' },
  tonight: { backgroundColor: C.lime, borderRadius: 22, padding: 16, marginTop: 14 },
  tonightKicker: { fontFamily: F.pixel, color: C.onLime, fontSize: 10 },
  tonightEdit: { color: C.onLime, fontSize: 14, fontWeight: '900', textDecorationLine: 'underline' },
  tonightBig: { fontFamily: F.display, color: C.onLime, fontSize: 24, marginTop: 4 },
  tonightTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(14,14,18,0.2)', marginTop: 8, overflow: 'hidden' },
  tonightFill: { height: 8 },
  tonightSub: { color: C.onLime, fontSize: 13, fontWeight: '600', marginTop: 6 },
  tonightForm: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  tonightSave: { backgroundColor: C.onLime, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginLeft: 8 },
  container: { flex: 1, backgroundColor: C.bg },
  body: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 60 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  back: { color: C.lime, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  title: { fontFamily: F.display, color: C.text, fontSize: 30 },
  sub: { color: C.sub, fontSize: 15, marginTop: 4 },
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 22, marginBottom: 8 },
  hint: { color: C.faint, fontSize: 13, marginTop: 10 },
  link: { color: C.lime, fontWeight: '800', marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 13, marginRight: 8, marginBottom: 8 },
  dayChip: { width: 46, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 9, marginRight: 8, marginBottom: 8 },
  kindChip: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, marginRight: 6 },
  chipOn: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { color: C.text, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: C.onLime },
  incomeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 16 },
  rupee: { color: C.sub, fontSize: 30, fontWeight: '800', marginRight: 6 },
  incomeInput: { flex: 1, color: C.text, fontSize: 36, fontWeight: '900', paddingVertical: 12 },
  cta: { backgroundColor: C.lime, borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 24, ...STICKER },
  ctaText: { color: C.onLime, fontSize: 16, fontWeight: '900' },
  off: { opacity: 0.45 },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, marginTop: 10 },
  editLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  editEmoji: { fontSize: 26, marginRight: 10 },
  editName: { color: C.text, fontSize: 15, fontWeight: '800' },
  editKind: { color: C.faint, fontSize: 12, marginTop: 2 },
  amtBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 10, width: 120 },
  amtRupee: { color: C.sub, fontSize: 18, fontWeight: '800' },
  amtInput: { flex: 1, color: C.text, fontSize: 18, fontWeight: '900', paddingVertical: 8, textAlign: 'right' },
  editPanel: { width: '100%', marginTop: 10 },
  nameInput: { backgroundColor: C.bg, borderRadius: 12, padding: 10, color: C.text, fontSize: 15, fontWeight: '700' },
  emojiPick: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  remove: { color: C.red, fontSize: 13, fontWeight: '700', marginTop: 10 },
  addBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 10 },
  addText: { color: C.text, fontSize: 15, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 14 },
  toggleText: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 10 },
  switch: { width: 46, height: 26, borderRadius: 13, backgroundColor: C.border, padding: 3 },
  switchOn: { backgroundColor: C.lime },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.text },
  knobOn: { marginLeft: 20, backgroundColor: C.onLime },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 30 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footLabel: { fontFamily: F.pixel, color: C.sub, fontSize: 11 },
  footAmt: { fontFamily: F.display, fontSize: 24 },
  footHint: { color: C.sub, fontSize: 13, marginTop: 4 },
  hero: { backgroundColor: C.pink, borderRadius: 24, padding: 18, marginTop: 16 },
  heroKicker: { fontFamily: F.pixel, color: '#FFFFFF', fontSize: 10, opacity: 0.85 },
  heroBig: { fontFamily: F.display, color: '#FFFFFF', fontSize: 40, marginTop: 6 },
  heroSub: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  heroTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)', marginTop: 12, overflow: 'hidden' },
  heroFill: { height: 10, backgroundColor: C.lime },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 },
  tile: { backgroundColor: C.card, borderRadius: 22, padding: 14, marginBottom: 10, overflow: 'hidden', minHeight: 140, justifyContent: 'flex-end' },
  tileWide: { width: '100%' },
  tileHalf: { width: '48.5%' },
  tileFill: { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.28 },
  tileEmoji: { fontSize: 28, position: 'absolute', top: 12, left: 14 },
  tileName: { color: C.text, fontSize: 14, fontWeight: '800' },
  tileLeft: { fontFamily: F.display, color: C.text, fontSize: 22, marginTop: 2 },
  tileOf: { color: C.sub, fontSize: 12, marginTop: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 12 },
  sheetTitle: { fontFamily: F.display, color: C.text, fontSize: 20 },
  sheetLeft: { fontFamily: F.display, fontSize: 30, marginTop: 6 },
  warn: { color: C.pink, fontSize: 14, fontWeight: '800', marginTop: 8 },
  spendRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 12, marginTop: 14 },
  noteInput: { backgroundColor: C.bg, borderRadius: 14, padding: 12, color: C.text, fontSize: 14, marginTop: 8 },
  spendItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  spendNote: { color: C.text, fontSize: 14, flex: 1, marginRight: 10 },
  spendAmt: { color: C.text, fontSize: 14, fontWeight: '800' },
});
