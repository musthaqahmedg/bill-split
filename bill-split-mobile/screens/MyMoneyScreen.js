import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { listBills, listBillsDetailed } from '../services/bills';
import { listExpenses, removeExpense } from '../services/expenses';
import { myGroupMoney } from '../services/groupExpenses';
import QuickAdd from './QuickAdd';
import SetBudgetSheet from './SetBudgetSheet';
import { getBudgets } from '../services/budget';
import { EXPENSE_CATS, MOTIVATION, budgetStatus, habitsSummary, monthKey, monthLabel, moneySummary, yearSummary, shiftMonth, swapsFor, todaySummary, weekSummary } from '../services/money';
import { show } from '../services/names';
import { getProfile } from '../services/profile';
import { homeBalance } from '../services/settle';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';
import NightSky from '../components/NightSky';

// 💰 My Money: your going-out spend (your share only), a monthly Night Budget, and simple insights.
// Private: built only from bills in the app. No bank, no SMS.
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const PICKS = [2000, 5000, 10000, 20000];

export default function MyMoneyScreen({ onBack, onProfile, onMemories, onYourData, onFriends, onGroups, onNotifications, onHelp, onTour, onOpenGroup }) {
  const [myName, setMyName] = useState('');
  useEffect(() => {
    getProfile().then((p) => setMyName((p && p.name) || '')).catch(() => {});
  }, []);
  const [bills, setBills] = useState(null);
  const [detailed, setDetailed] = useState([]); // items + claims, for the habits card
  const [expenses, setExpenses] = useState([]); // 💸 quick-add spends
  const [gm, setGm] = useState({ spends: [], groups: [], owed: 0, owe: 0 }); // ✍️ Manual Split: your shares + group balances
  const [adding, setAdding] = useState(false);
  const [addCat, setAddCat] = useState(null); // quick-add chip that opened the sheet
  const [budget, setBudget] = useState(0);
  const [warn, setWarn] = useState(true); // ⚠️ warn at 80% / 100%
  const [month, setMonth] = useState(monthKey(new Date()));
  const [chart, setChart] = useState('6m'); // 📊 '6m' = last 6 months · 'year' = whole year
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState(false);
  const [budgets, setBudgets] = useState({ month: 0, week: 0, tonight: 0, warn: true });
  const [editTab, setEditTab] = useState('month');
  const openBudget = (tab) => { setEditTab(tab); setEditing(true); };
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
      myGroupMoney().then(setGm).catch(() => {});
      const id = u && u.data && u.data.user ? u.data.user.id : null;
      if (id) {
        const bs = await getBudgets();
        setBudgets(bs);
        setBudget(bs.month || 0);
        setWarn(bs.warn);
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
  const allSpends = [...expenses, ...gm.spends]; // quick-adds + your share of group expenses
  const s = moneySummary(bills, month, new Date(), allSpends);
  const bal = homeBalance(bills);
  const st = isNow ? budgetStatus(s.spent, budget) : null;
  const ringColor = !st ? C.lime : st.left < 0 ? C.red : st.mood.emoji === '⚠️' ? C.amber : C.lime;
  const y = yearSummary(bills, year, new Date(), allSpends);
  const bars = chart === 'year' ? y.months : s.months;
  const maxBar = Math.max(1, ...bars.map((m) => m.spent));
  const h = habitsSummary(detailed, month, expenses);
  const monthSpends = expenses.filter((e) => monthKey(new Date(e.spent_at)) === month);

  return (
    <View style={styles.page}>
      <NightSky height={260} />
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
        {/* 👤 Me (new UX): you, your shortcuts, then your money */}
        <View style={styles.meRow}>
          <View style={styles.meFace}>
            <Text style={styles.meFaceText}>{(myName || 'Me').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>ME</Text>
            {myName ? <Text style={styles.meName} numberOfLines={1}>{myName}</Text> : null}
          </View>
          <View style={styles.privatePill}>
            <Text style={styles.privateText}>🔒 Only you</Text>
          </View>
        </View>
        <View style={styles.meLinks}>
          {[
            ['📸', 'Memories', C.pink, onMemories],
            ['🫶', 'Friends', C.cyan, onFriends],
            ['👥', 'Groups', '#FFD84D', onGroups],
            ['🔔', 'Alerts', '#FFB3D9', onNotifications],
            ['⚙️', 'Profile', C.lime, onProfile],
            ['🔒', 'Your data', C.cyan, onYourData],
            ['💡', 'Help', '#7CFFB2', onHelp],
            ['🧭', 'Tour', C.violet, onTour],
          ].filter((x) => x[3]).map(([e, label, bg, go]) => (
            <TouchableOpacity key={label} style={[styles.meLink, { backgroundColor: bg }]} onPress={go} activeOpacity={0.85}>
              <Text style={styles.meLinkEmoji}>{e}</Text>
              <Text style={styles.meLinkText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* ⚡ Tonight: today's allowance + quick add */}
        {isNow ? (
          (() => {
            const t = todaySummary(bills, allSpends, budget, new Date(), budgets.tonight);
            return (
              <View style={styles.today}>
                <View style={styles.heroTop}>
                  <Text style={styles.todayKicker}>TONIGHT</Text>
                  {budget ? <Text style={styles.todayDays}>{t.daysLeft} {t.daysLeft === 1 ? 'day' : 'days'} left this month</Text> : null}
                </View>
                {budget || budgets.tonight ? (
                  <>
                    <Text style={styles.todayLabel}>Left tonight{t.tonightSet ? ' (tonight’s budget)' : ''}</Text>
                    <Text style={[styles.todayBig, t.left < 0 && { color: C.red }]}>{inr(Math.abs(t.left))}{t.left < 0 ? ' over' : ''}</Text>
                    <Text style={styles.todaySub}>{inr(t.today)} spent of {inr(t.allowance)} today</Text>
                  </>
                ) : (
                  <Text style={styles.todaySub}>Spent today: <Text style={styles.b}>{inr(t.today)}</Text>. Set a Night Budget to get a daily allowance.</Text>
                )}
                <TouchableOpacity style={styles.tonightBtn} onPress={() => openBudget('tonight')} activeOpacity={0.85}>
                  <Text style={styles.tonightBtnText}>🎯 {budgets.tonight ? `Tonight: ${inr(budgets.tonight)} · change` : 'Set a budget for tonight'}</Text>
                </TouchableOpacity>
                <Text style={styles.quickLabel}>QUICK ADD</Text>
                <View style={styles.quick}>
                  {[['drinks', C.lime], ['cab', C.pink], ['snacks', '#FFB347'], ['entry', C.violet], ['other', null]].map(([k, col]) => (
                    <TouchableOpacity key={k} style={[styles.quickChip, col ? { backgroundColor: col } : styles.quickOther]} onPress={() => { setAddCat(k); setAdding(true); }} activeOpacity={0.85}>
                      <Text style={[styles.quickText, !col && { color: C.text }]}>{EXPENSE_CATS[k].emoji} {k === 'snacks' ? 'Late-night food' : EXPENSE_CATS[k].label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()
        ) : null}

        <Text style={[styles.kicker, { marginTop: 18 }]}>YOUR MONEY</Text>

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

        {/* 💳 Spent this month (Final UX hero) */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{isNow ? 'Spent this month' : 'Spent'}</Text>
            {budget ? (
              <TouchableOpacity onPress={() => openBudget('month')} hitSlop={8}>
                <Text style={styles.heroLabel}>Budget {inr(budget)} ✏️</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={[styles.heroBig, st && st.left < 0 && { color: C.red }]}>{inr(s.spent)}</Text>
          {st ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(100, Math.round(st.pct * 100))}%`, backgroundColor: ringColor }]} />
              </View>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>{st.left < 0 ? 'Over budget by' : 'Left to spend'}</Text>
                <Text style={[styles.heroLeft, st.left < 0 && { color: C.red }]}>{inr(Math.abs(st.left))}</Text>
              </View>
              <View style={styles.moodPill}>
                <Text style={styles.moodText}>{st.mood.emoji} {st.mood.text}</Text>
              </View>
            </>
          ) : isNow ? (
            <TouchableOpacity style={styles.setBtn} onPress={() => openBudget('month')}>
              <Text style={styles.setText}>🎯 Set a monthly Night Budget</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.statsRow}>
            <Text style={styles.statInline}><Text style={styles.b}>{s.nights}</Text> nights out</Text>
            <Text style={styles.statInline}><Text style={styles.b}>{inr(s.avg)}</Text> / night</Text>
            <Text style={[styles.statInline, s.change > 0 ? { color: C.pink } : s.change < 0 ? { color: C.green } : null]}>
              <Text style={styles.b}>{s.change === null ? '–' : `${s.change > 0 ? '+' : ''}${s.change}%`}</Text> vs last
            </Text>
          </View>
        </View>

        {/* 🧾 Where it went */}
        {s.spent ? (
          (() => {
            const extrasSum = s.extras.reduce((a, x) => a + x.amount, 0);
            const rows = [{ label: '🍽️ Nights out (your bill shares)', amount: s.spent - extrasSum }, ...s.extras.map((x) => ({ label: `${EXPENSE_CATS[x.category].emoji} ${EXPENSE_CATS[x.category].label}`, amount: x.amount }))]
              .filter((x) => x.amount > 0)
              .sort((a, b) => b.amount - a.amount);
            const COLS = [C.violet, C.pink, C.lime, C.cyan, '#FFB347', '#FF8A3D'];
            return (
              <View style={styles.card}>
                <View style={styles.heroTop}>
                  <Text style={styles.cardKicker}>WHERE IT WENT</Text>
                  <Text style={styles.todayDays}>{rows.length} {rows.length === 1 ? 'category' : 'categories'}</Text>
                </View>
                {rows.map((x, i) => (
                  <View key={x.label} style={styles.catRow}>
                    <View style={styles.heroTop}>
                      <Text style={styles.catName}>{x.label}</Text>
                      <Text style={styles.catAmt}>{inr(x.amount)}</Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View style={[styles.catFill, { width: `${Math.max(3, Math.round((x.amount / s.spent) * 100))}%`, backgroundColor: COLS[i % COLS.length] }]} />
                    </View>
                  </View>
                ))}
              </View>
            );
          })()
        ) : null}

        {/* 📅 Weekly check-in */}
        {isNow ? (
          <View style={styles.card}>
            <View style={styles.heroTop}>
              <Text style={styles.cardTitle}>📅 This week</Text>
              <TouchableOpacity onPress={() => openBudget('week')} hitSlop={8}>
                <Text style={styles.spendAdd}>{budgets.week ? `Budget ${inr(budgets.week)} ✏️` : '🎯 Set'}</Text>
              </TouchableOpacity>
            </View>
            {budgets.week ? (() => {
              const w = weekSummary(bills, allSpends, budgets.week);
              return (
                <>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.min(100, Math.round(w.pct * 100))}%`, backgroundColor: w.pct >= 1 ? C.red : w.pct >= 0.8 ? C.pink : C.lime }]} />
                  </View>
                  <Text style={styles.body}>{inr(w.spent)} of {inr(w.budget)} · {w.left >= 0 ? `${inr(w.left)} left` : `${inr(-w.left)} over`} · day {w.day} of 7</Text>
                </>
              );
            })() : null}
            <Text style={styles.body}>
              {s.week.nights
                ? `${inr(s.week.spent)} across ${s.week.nights} night${s.week.nights === 1 ? '' : 's'} out.`
                : 'No nights out yet this week. Saving up for the weekend? 😎'}
            </Text>
          </View>
        ) : null}

        {/* 📊 Last 6 months */}
        <View style={styles.card}>
          <View style={styles.chartHead}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>📊 {chart === 'year' ? `Your ${year}` : 'Last 6 months'}</Text>
            <View style={styles.chartSeg}>
              {[['6m', '6 months'], ['year', 'Year']].map(([k, label]) => (
                <TouchableOpacity key={k} style={[styles.chartSegBtn, chart === k && styles.chartSegOn]} onPress={() => setChart(k)}>
                  <Text style={[styles.chartSegText, chart === k && styles.chartSegTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {chart === 'year' ? (
            <View style={styles.yearRow}>
              <TouchableOpacity onPress={() => setYear(year - 1)} hitSlop={12}><Text style={styles.yearArrow}>‹</Text></TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.yearTotal}>{inr(y.total)}</Text>
                <Text style={styles.yearSub}>
                  {y.total ? `${y.nights} ${y.nights === 1 ? 'night' : 'nights'} · ~${inr(y.avgMonth)}/month${y.biggest ? ` · top: ${y.biggest.label}` : ''}` : 'Nothing spent this year'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => year < new Date().getFullYear() && setYear(year + 1)} hitSlop={12} disabled={year >= new Date().getFullYear()}>
                <Text style={[styles.yearArrow, year >= new Date().getFullYear() && { opacity: 0.25 }]}>›</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.bars}>
            {bars.map((m) => (
              <TouchableOpacity key={m.key} style={styles.barCol} onPress={() => m.key <= monthKey(new Date()) && setMonth(m.key)} activeOpacity={0.7}>
                <Text style={[styles.barAmt, chart === 'year' && { fontSize: 8 }]}>{m.spent ? `${Math.round(m.spent / 1000) || '<1'}k` : ''}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.max(m.spent ? 6 : 0, (m.spent / maxBar) * 100)}%` }, m.key === month && styles.barOn]} />
                </View>
                <Text style={[styles.barLabel, m.key === month && styles.barLabelOn, chart === 'year' && { fontSize: 9 }]}>{chart === 'year' ? m.label.slice(0, 1) : m.label}</Text>
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
            <Text style={[styles.settleBig, { color: bal.owed + gm.owed ? C.green : C.text }]}>{inr(bal.owed + gm.owed)}</Text>
          </View>
          <View style={styles.settleLine} />
          <View style={styles.settleBox}>
            <Text style={styles.statLabel}>You owe</Text>
            <Text style={[styles.settleBig, { color: bal.owe + gm.owe ? C.pink : C.text }]}>{inr(bal.owe + gm.owe)}</Text>
          </View>
        </View>

        {/* ✍️ Manual Split groups where money is still open */}
        {gm.groups.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✍️ Group splits</Text>
            {gm.groups.map((g, i) => (
              <TouchableOpacity key={g.id} style={[styles.gRow, i > 0 && styles.gLine]} onPress={() => onOpenGroup && onOpenGroup(g.id)} disabled={!onOpenGroup} activeOpacity={0.7}>
                <Text style={styles.gEmoji}>{g.emoji}</Text>
                <Text style={styles.gName} numberOfLines={1}>{g.name}</Text>
                <Text style={[styles.gNet, { color: g.net > 0 ? C.green : C.pink }]}>{g.net > 0 ? `gets ${inr(g.net)}` : `owe ${inr(-g.net)}`}</Text>
                {onOpenGroup ? <Text style={styles.gGo}>›</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.foot}>🔒 Built only from bills in the app. We never read your bank or SMS.</Text>
      </ScrollView>

      <QuickAdd visible={adding} onClose={() => { setAdding(false); setAddCat(null); }} onSaved={load} initialCat={addCat} />

      {/* 🎯 Set a budget: tonight · this week · this month */}
      <SetBudgetSheet visible={editing} onClose={() => setEditing(false)} onSaved={load} budgets={budgets} initialTab={editTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  tonightBtn: { borderWidth: 1, borderColor: C.lime, borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  tonightBtnText: { color: C.lime, fontSize: 14, fontWeight: '800' },
  meRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  meFace: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  meFaceText: { fontFamily: F.display, color: C.onLime, fontSize: 22 },
  meName: { color: C.sub, fontSize: 14, fontWeight: '700' },
  meLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  meLink: { width: '23.5%', marginBottom: 8, borderRadius: 18, paddingVertical: 12, alignItems: 'center', borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  meLinkEmoji: { fontSize: 22 },
  meLinkText: { fontFamily: F.pixel, color: C.onLime, fontSize: 10, marginTop: 4 },
  page: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  back: { color: C.lime, fontSize: 17, marginBottom: 10 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, letterSpacing: 1.5 },
  privatePill: { backgroundColor: C.violet, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  privateText: { color: C.onLime, fontSize: 11, fontWeight: '900' },
  title: { fontFamily: F.display, color: C.text, fontSize: 38, marginTop: 4 },
  hero: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 18, marginTop: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  heroBig: { fontFamily: F.display, color: C.lime, fontSize: 36, marginTop: 6 },
  heroLeft: { fontFamily: F.bold, color: C.lime, fontSize: 18 },
  track: { height: 10, borderRadius: 5, backgroundColor: C.cardHi, overflow: 'hidden', marginTop: 14, marginBottom: 12 },
  fill: { height: '100%', borderRadius: 5 },
  moodPill: { backgroundColor: C.pink, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, marginTop: 14, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  moodText: { color: C.onLime, fontSize: 13, fontWeight: '800' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 14 },
  statInline: { color: C.faint, fontSize: 12 },
  today: { backgroundColor: C.card, borderWidth: 1, borderColor: C.lime + '66', borderRadius: 24, padding: 18, marginTop: 12 },
  todayKicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, letterSpacing: 1.5 },
  todayDays: { color: C.faint, fontSize: 12, fontWeight: '600' },
  todayLabel: { color: C.sub, fontSize: 13, fontWeight: '600', marginTop: 10 },
  todayBig: { fontFamily: F.display, color: C.text, fontSize: 30, marginTop: 2 },
  todaySub: { color: C.sub, fontSize: 13, marginTop: 6, lineHeight: 19 },
  quickLabel: { color: C.faint, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },
  quick: { flexDirection: 'row', flexWrap: 'wrap' },
  quickChip: { borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13, marginRight: 8, marginBottom: 8, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  quickOther: { borderWidth: 1, borderColor: C.border },
  quickText: { color: C.onLime, fontSize: 14, fontWeight: '800' },
  cardKicker: { fontFamily: F.pixel, color: C.text, fontSize: 11, letterSpacing: 1.5 },
  catRow: { marginTop: 14 },
  catName: { color: C.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  catAmt: { fontFamily: F.bold, color: C.text, fontSize: 15 },
  catTrack: { height: 6, borderRadius: 3, backgroundColor: C.cardHi, overflow: 'hidden', marginTop: 8 },
  catFill: { height: '100%', borderRadius: 3 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  arrow: { color: C.text, fontSize: 30, paddingHorizontal: 18 },
  arrowOff: { color: C.border },
  month: { fontFamily: F.bold, color: C.text, fontSize: 15, minWidth: 150, textAlign: 'center' },
  ringCard: { alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, paddingVertical: 20, marginTop: 12 },
  ringLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  ringBig: { fontFamily: F.bold, color: C.text, fontSize: 27, marginTop: 2 },
  ringSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  mood: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 12 },
  setBtn: { alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 18, marginTop: 14, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  setText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
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
  barOn: { backgroundColor: C.lime },
  barLabel: { color: C.faint, fontSize: 11 },
  barLabelOn: { color: C.text, fontWeight: '700' },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  chartSeg: { flexDirection: 'row', backgroundColor: C.cardHi, borderRadius: 12, padding: 3 },
  chartSegBtn: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9 },
  chartSegOn: { backgroundColor: C.lime },
  chartSegText: { color: C.sub, fontSize: 12, fontWeight: '800' },
  chartSegTextOn: { color: C.onLime },
  yearRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  yearArrow: { color: C.lime, fontSize: 28, fontWeight: '800', paddingHorizontal: 8 },
  yearTotal: { fontFamily: F.display, color: C.text, fontSize: 26 },
  yearSub: { color: C.sub, fontSize: 12, marginTop: 2, textAlign: 'center' },
  gRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  gLine: { borderTopWidth: 1, borderTopColor: C.border },
  gEmoji: { fontSize: 20, marginRight: 10 },
  gName: { flex: 1, color: C.text, fontSize: 15, fontWeight: '800' },
  gNet: { fontSize: 14, fontWeight: '900' },
  gGo: { color: C.faint, fontSize: 20, marginLeft: 8 },
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
  saveBtn: { backgroundColor: C.lime, borderRadius: 18, padding: 15, alignItems: 'center', marginTop: 10, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  saveText: { color: C.onLime, fontSize: 16, fontWeight: '800' },
  warnRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, padding: 12, marginTop: 6 },
  warnTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  warnSub: { color: C.faint, fontSize: 12, marginTop: 2 },
  remove: { color: C.red, fontSize: 14, textAlign: 'center', marginTop: 14 },
});
