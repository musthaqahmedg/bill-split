import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { listBills, listBillsDetailed } from '../services/bills';
import { listExpenses, removeExpense } from '../services/expenses';
import QuickAdd from './QuickAdd';
import { EXPENSE_CATS, MOTIVATION, budgetStatus, habitsSummary, monthKey, monthLabel, moneySummary, shiftMonth, swapsFor } from '../services/money';
import { show } from '../services/names';
import { homeBalance } from '../services/settle';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';

// 💰 My Money: your going-out spend (your share only), a monthly Night Budget, and simple insights.
// Private: built only from bills in the app. No bank, no SMS.
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const PICKS = [2000, 5000, 10000, 20000];

// Night Budget ring, drawn with dots (no chart library needed)
function Ring({ pct, color, size = 190, children }) {
  const N = 48;
  const r = size / 2 - 8;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * 2 * Math.PI - Math.PI / 2;
        const on = i < Math.round(pct * N);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: 9,
              height: 9,
              borderRadius: 5,
              left: size / 2 + r * Math.cos(a) - 4.5,
              top: size / 2 + r * Math.sin(a) - 4.5,
              backgroundColor: on ? color : C.border,
            }}
          />
        );
      })}
      {children}
    </View>
  );
}

export default function MyMoneyScreen({ onBack }) {
  const [bills, setBills] = useState(null);
  const [detailed, setDetailed] = useState([]); // items + claims, for the habits card
  const [expenses, setExpenses] = useState([]); // 💸 quick-add spends
  const [adding, setAdding] = useState(false);
  const [budget, setBudget] = useState(0);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // 💡 the "what else could this be" ideas change every few seconds, so it never feels the same
  const [tick, setTick] = useState(() => Math.floor(Math.random() * 1000));
  const swapFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(swapFade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setTick((x) => x + 1);
        Animated.timing(swapFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [b, u] = await Promise.all([listBills(), supabase.auth.getUser()]);
      setBills(b || []);
      listBillsDetailed().then(setDetailed).catch(() => setDetailed([]));
      listExpenses().then(setExpenses).catch(() => setExpenses([]));
      const id = u && u.data && u.data.user ? u.data.user.id : null;
      if (id) {
        const { data } = await supabase.from('profiles').select('monthly_budget').eq('id', id).maybeSingle();
        setBudget((data && data.monthly_budget) || 0);
      }
    } catch (e) {
      setBills([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const saveBudget = async (v) => {
    const n = Math.max(0, Math.min(10000000, Math.round(Number(v) || 0)));
    setBudget(n);
    setEditing(false);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update({ monthly_budget: n || null }).eq('id', u.user.id);
      if (error) throw error;
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };

  if (bills === null) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator color={C.accentSoft} />
      </View>
    );
  }

  const thisMonth = monthKey(new Date());
  const isNow = month === thisMonth;
  const s = moneySummary(bills, month, new Date(), expenses);
  const bal = homeBalance(bills);
  const st = isNow ? budgetStatus(s.spent, budget) : null;
  const ringColor = !st ? C.accent : st.left < 0 ? C.red : st.mood.emoji === '⚠️' ? C.amber : C.green;
  const maxBar = Math.max(1, ...s.months.map((m) => m.spent));
  const h = habitsSummary(detailed, month, expenses);
  const monthSpends = expenses.filter((e) => monthKey(new Date(e.spent_at)) === month);

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.accentSoft} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {onBack ? (
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.kicker}>Only you can see this 🔒</Text>
        <Text style={styles.title}>💰 My Money</Text>

        {/* ‹ October 2026 › */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
            <Text style={styles.arrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.month}>{monthLabel(month, true)}</Text>
          <TouchableOpacity onPress={() => !isNow && setMonth(shiftMonth(month, 1))} hitSlop={12} disabled={isNow}>
            <Text style={[styles.arrow, isNow && styles.arrowOff]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 🎯 Night Budget ring */}
        <View style={styles.ringCard}>
          <Ring pct={st ? st.pct : 0} color={ringColor}>
            <Text style={styles.ringLabel}>{isNow ? 'Spent this month' : 'Spent'}</Text>
            <Text style={styles.ringBig}>{inr(s.spent)}</Text>
            {st ? (
              <Text style={[styles.ringSub, { color: st.left < 0 ? C.red : C.sub }]}>{st.left < 0 ? 'over budget' : `${inr(st.left)} left`}</Text>
            ) : (
              <Text style={styles.ringSub}>{s.nights} night{s.nights === 1 ? '' : 's'} out</Text>
            )}
          </Ring>
          {isNow ? (
            st ? (
              <TouchableOpacity onPress={() => { setDraft(String(budget)); setEditing(true); }}>
                <Text style={styles.mood}>{st.mood.emoji} {st.mood.text} · Budget {inr(budget)} ✏️</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.setBtn} onPress={() => { setDraft(''); setEditing(true); }}>
                <Text style={styles.setText}>🎯 Set a Night Budget</Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>

        {/* Quick stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statBig}>{s.nights}</Text>
            <Text style={styles.statLabel}>nights out</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statBig}>{inr(s.avg)}</Text>
            <Text style={styles.statLabel}>per night</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statBig, s.change > 0 ? { color: C.pink } : s.change < 0 ? { color: C.green } : null]}>
              {s.change === null ? '–' : `${s.change > 0 ? '+' : ''}${s.change}%`}
            </Text>
            <Text style={styles.statLabel}>vs last month</Text>
          </View>
        </View>

        {/* 📅 Weekly check-in */}
        {isNow ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 This week</Text>
            <Text style={styles.body}>
              {s.week.nights
                ? `${inr(s.week.spent)} across ${s.week.nights} night${s.week.nights === 1 ? '' : 's'} out.`
                : 'No nights out yet this week. Saving up for the weekend? 😎'}
            </Text>
          </View>
        ) : null}

        {/* 📊 Last 6 months */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Last 6 months</Text>
          <View style={styles.bars}>
            {s.months.map((m) => (
              <TouchableOpacity key={m.key} style={styles.barCol} onPress={() => setMonth(m.key)} activeOpacity={0.7}>
                <Text style={styles.barAmt}>{m.spent ? `${Math.round(m.spent / 1000) || '<1'}k` : ''}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(m.spent ? 6 : 0, (m.spent / maxBar) * 100)}%` }, m.key === month && styles.barOn]} />
                </View>
                <Text style={[styles.barLabel, m.key === month && styles.barLabelOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ✨ Insights */}
        {s.nights ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✨ Insights</Text>
            {s.biggest ? <Text style={styles.insight}>🏆 Biggest night: <Text style={styles.b}>{s.biggest.title}</Text> · {inr(s.biggest.amount)}</Text> : null}
            {s.topSpot && s.topSpot.count > 1 ? <Text style={styles.insight}>📍 Favourite spot: <Text style={styles.b}>{s.topSpot.name}</Text> · {s.topSpot.count} times</Text> : null}
            {s.topFriends.length ? (
              <Text style={styles.insight}>👯 Out most with: <Text style={styles.b}>{s.topFriends.map((f) => show(f.name)).join(', ')}</Text></Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>No bills this month yet. Split a bill and it shows up here automatically.</Text>
          </View>
        )}

        {/* 🍺🚬 Habits: private, gentle, motivating */}
        {/* 💸 Quick-add spends */}
        <View style={styles.card}>
          <View style={styles.spendHead}>
            <Text style={styles.cardTitle}>💸 Other spends</Text>
            <TouchableOpacity onPress={() => setAdding(true)} hitSlop={8}>
              <Text style={styles.spendAdd}>＋ Add</Text>
            </TouchableOpacity>
          </View>
          {monthSpends.length ? (
            <>
              <View style={styles.spendCats}>
                {s.extras.map((x) => (
                  <View key={x.category} style={styles.spendCat}>
                    <Text style={styles.spendCatText}>{EXPENSE_CATS[x.category].emoji} {inr(x.amount)}</Text>
                  </View>
                ))}
              </View>
              {monthSpends.slice(0, 6).map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.spendRow}
                  onLongPress={() =>
                    Alert.alert('Remove this spend?', `${EXPENSE_CATS[e.category].label} · ${inr(e.amount)}`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: async () => { try { await removeExpense(e.id); load(); } catch (er) {} } },
                    ])
                  }
                >
                  <Text style={styles.spendEmoji}>{EXPENSE_CATS[e.category].emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spendName} numberOfLines={1}>{e.note || EXPENSE_CATS[e.category].label}</Text>
                    <Text style={styles.spendWhen}>{new Date(e.spent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · hold to remove</Text>
                  </View>
                  <Text style={styles.spendAmt}>{inr(e.amount)}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <Text style={styles.body}>Cabs, snacks, entry fees… log them in 2 taps so your Night Budget is real.</Text>
          )}
        </View>

        {h.nights || h.total ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🍺 Drinks & 🚬 smoke</Text>
            {h.habit ? (
              <>
                <View style={styles.habitRow}>
                  <View style={styles.habitBox}>
                    <Text style={styles.habitBig}>{inr(h.drinks)}</Text>
                    <Text style={styles.statLabel}>🍺 drinks</Text>
                  </View>
                  <View style={styles.habitBox}>
                    <Text style={styles.habitBig}>{inr(h.smoke)}</Text>
                    <Text style={styles.statLabel}>🚬 smoke</Text>
                  </View>
                  <View style={styles.habitBox}>
                    <Text style={styles.habitBig}>{h.pct}%</Text>
                    <Text style={styles.statLabel}>of your spend</Text>
                  </View>
                </View>
                <View style={styles.habitBar}>
                  <View style={{ flex: h.drinks || 0.0001, backgroundColor: C.amber }} />
                  <View style={{ flex: h.smoke || 0.0001, backgroundColor: C.pink }} />
                  <View style={{ flex: Math.max(h.total - h.habit, 0.0001), backgroundColor: C.cardHi }} />
                </View>
                <Text style={styles.swapTitle}>💡 At this pace that's {inr(h.yearly)} a year. That could be:</Text>
                <Animated.View style={{ opacity: swapFade }}>
                  {swapsFor(h.yearly, tick).map((sw) => (
                    <Text key={sw.what} style={styles.swap}>
                      {sw.emoji} <Text style={styles.b}>{sw.count}</Text> {sw.what}
                    </Text>
                  ))}
                  <Text style={styles.motivate}>{MOTIVATION[tick % MOTIVATION.length]}</Text>
                </Animated.View>
                {h.dry ? <Text style={styles.dry}>🌿 {h.dry} of {h.nights} nights with no drinks or smoke. Nice 💪</Text> : null}
              </>
            ) : (
              <Text style={styles.body}>🌿 No drinks or smoke on your bills this month. Your wallet (and body) say thanks 💪</Text>
            )}
            <Text style={styles.private}>🔒 Only you see this. We never share it or rank anyone.</Text>
          </View>
        ) : null}

        {/* 💸 Still to settle (all months) */}
        <View style={styles.settle}>
          <View style={styles.settleBox}>
            <Text style={styles.statLabel}>You'll get back</Text>
            <Text style={[styles.settleBig, { color: bal.owed ? C.green : C.text }]}>{inr(bal.owed)}</Text>
          </View>
          <View style={styles.settleLine} />
          <View style={styles.settleBox}>
            <Text style={styles.statLabel}>You owe</Text>
            <Text style={[styles.settleBig, { color: bal.owe ? C.pink : C.text }]}>{inr(bal.owe)}</Text>
          </View>
        </View>

        <Text style={styles.foot}>🔒 Built only from bills in the app. We never read your bank or SMS.</Text>
      </ScrollView>

      <QuickAdd visible={adding} onClose={() => setAdding(false)} onSaved={load} />

      {/* 🎯 Set budget */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditing(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>🎯 Monthly Night Budget</Text>
            <Text style={styles.body}>How much do you want to spend going out each month?</Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 5000"
              placeholderTextColor={C.faint}
              keyboardType="number-pad"
              keyboardAppearance="dark"
              autoFocus
            />
            <View style={styles.picks}>
              {PICKS.map((p) => (
                <TouchableOpacity key={p} style={styles.pick} onPress={() => setDraft(String(p))}>
                  <Text style={styles.pickText}>{inr(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={() => saveBudget(draft)}>
              <Text style={styles.saveText}>Save budget</Text>
            </TouchableOpacity>
            {budget ? (
              <TouchableOpacity onPress={() => saveBudget(0)}>
                <Text style={styles.remove}>Remove budget</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  back: { color: C.accentSoft, fontSize: 17, marginBottom: 10 },
  kicker: { color: C.sub, fontSize: 14, fontWeight: '500' },
  title: { fontFamily: F.display, color: C.text, fontSize: 24, marginTop: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  arrow: { color: C.text, fontSize: 30, paddingHorizontal: 18 },
  arrowOff: { color: C.border },
  month: { fontFamily: F.bold, color: C.text, fontSize: 15, minWidth: 150, textAlign: 'center' },
  ringCard: { alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, paddingVertical: 20, marginTop: 12 },
  ringLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  ringBig: { fontFamily: F.bold, color: C.text, fontSize: 27, marginTop: 2 },
  ringSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  mood: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 12 },
  setBtn: { backgroundColor: C.accent, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 18, marginTop: 12 },
  setText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  stats: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginHorizontal: 3 },
  statBig: { fontFamily: F.bold, color: C.text, fontSize: 16 },
  statLabel: { color: C.faint, fontSize: 12, marginTop: 3 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginTop: 12 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  body: { color: C.sub, fontSize: 14, lineHeight: 21 },
  bars: { flexDirection: 'row', height: 150, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barAmt: { color: C.faint, fontSize: 10, height: 14 },
  barTrack: { flex: 1, width: 22, justifyContent: 'flex-end', marginVertical: 4 },
  barFill: { width: '100%', borderRadius: 6, backgroundColor: C.cardHi },
  barOn: { backgroundColor: C.accent },
  barLabel: { color: C.faint, fontSize: 11 },
  barLabelOn: { color: C.text, fontWeight: '700' },
  insight: { color: C.sub, fontSize: 14, lineHeight: 22, marginTop: 2 },
  b: { color: C.text, fontWeight: '700' },
  settle: { flexDirection: 'row', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingVertical: 14, marginTop: 12 },
  settleBox: { flex: 1, alignItems: 'center' },
  settleLine: { width: 1, backgroundColor: C.border },
  settleBig: { fontFamily: F.bold, fontSize: 18, marginTop: 3 },
  habitRow: { flexDirection: 'row' },
  habitBox: { flex: 1, alignItems: 'center' },
  habitBig: { fontFamily: F.bold, color: C.text, fontSize: 16 },
  habitBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 14, backgroundColor: C.cardHi },
  swapTitle: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  swap: { color: C.sub, fontSize: 14, lineHeight: 22 },
  motivate: { color: C.accentSoft, fontSize: 13, fontWeight: '700', marginTop: 8 },
  dry: { color: C.green, fontSize: 13, fontWeight: '600', marginTop: 10 },
  private: { color: C.faint, fontSize: 11, marginTop: 10 },
  spendHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spendAdd: { color: C.accentSoft, fontSize: 14, fontWeight: '800' },
  spendCats: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  spendCat: { backgroundColor: C.cardHi, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 9, marginRight: 6, marginBottom: 6 },
  spendCatText: { color: C.text, fontSize: 13, fontWeight: '600' },
  spendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  spendEmoji: { fontSize: 20, width: 32 },
  spendName: { color: C.text, fontSize: 14, fontWeight: '600' },
  spendWhen: { color: C.faint, fontSize: 11, marginTop: 1 },
  spendAmt: { color: C.text, fontSize: 14, fontWeight: '800', marginLeft: 8 },
  foot: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontFamily: F.bold, color: C.text, fontSize: 18, marginBottom: 6 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, color: C.text, fontSize: 20, fontWeight: '700', marginTop: 14 },
  picks: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  pick: { backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  pickText: { color: C.text, fontSize: 14, fontWeight: '600' },
  saveBtn: { backgroundColor: C.accent, borderRadius: 18, padding: 15, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  remove: { color: C.red, fontSize: 14, textAlign: 'center', marginTop: 14 },
});
