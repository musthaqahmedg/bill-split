import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listExpenses } from '../services/expenses';
import { getNights, stats as nightStats } from '../services/safety';
import { myFriends } from '../services/friends';
import { activeLabel } from '../services/active';
import { supabase } from '../services/supabaseClient';
import { listBills } from '../services/bills';
import { show } from '../services/names';
import { getProfile } from '../services/profile';
import { billBalance, homeBalance } from '../services/settle';
import { monthKey, monthLabel, moneySummary, todaySummary } from '../services/money';
import { C, F } from '../services/theme';
import NightSky from '../components/NightSky';
import FriendsRow from './FriendsRow';
import GuestGate from './GuestGate';
import TonightCard from './TonightCard';
import { useUnread } from '../services/notifications';

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const hello = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
// 📣 v14: lime strip that scrolls forever at the top of Home
const STRIP = 'VIBE OUT ✦ PULL UP ✦ LINK UP ✦ ';
function Marquee() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(x, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View style={styles.strip}>
      <Animated.Text style={[styles.stripText, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) }] }]}>
        {STRIP.repeat(6)}
      </Animated.Text>
    </View>
  );
}
const clockText = () => {
  const d = new Date();
  return `${d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()} ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase()}`;
};

const HUES = ['#9B5CFF', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];

export default function HomeScreen({ onNewBill, onOpenBill, onFriends, onNotifications, draft, onResumeDraft, onDiscardDraft, guest, onSaveAccount, onMoney, onPlan, onOpenPlan, onProfile }) {
  const [unread] = useUnread();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(0);
  const [streak, setStreak] = useState(0);
  const [outNow, setOutNow] = useState(0);
  const [clock, setClock] = useState(clockText());
  useEffect(() => {
    const t = setInterval(() => setClock(clockText()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBills(await listBills());
    } catch (e) {
      console.log('Could not load bills:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getProfile()
      .then((p) => setName(((p && p.name) || '').split(' ')[0]))
      .catch(() => {});
    // 💰 tonight's budget, 🔥 streak, 🟢 friends out now (all optional, never block Home)
    listExpenses().then(setExpenses).catch(() => {});
    supabase.auth.getUser().then(({ data }) => data && data.user && supabase.from('profiles').select('monthly_budget').eq('id', data.user.id).maybeSingle())
      .then((res) => setBudget((res && res.data && res.data.monthly_budget) || 0)).catch(() => {});
    getNights().then((n) => setStreak(nightStats(n).current)).catch(() => {});
    myFriends().then((l) => setOutNow((l || []).filter((f) => f.status === 'accepted' && activeLabel(f.last_seen) && activeLabel(f.last_seen).now).length)).catch(() => {});
  }, [load]);

  const archived = bills.filter((b) => b.status === 'archived');
  const active = bills.filter((b) => b.status !== 'archived');
  const visible = showArchived ? archived : active;
  const sum = homeBalance(bills);
  // oldest bill that still has money to collect or pay
  const open = active
    .map((b) => ({ b, bal: billBalance(b) }))
    .filter((x) => x.bal.owed || x.bal.owe || x.bal.open)
    .sort((x, y) => new Date(x.b.created_at) - new Date(y.b.created_at));
  const openCount = open.length;
  const openBill = open.length ? open[0].b : null;
  const openAmt = open.length ? open[0].bal.owed || open[0].bal.owe || 0 : 0;

  const renderBill = ({ item }) => {
    const when = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const people = item.bill_participants || [];
    const bal = billBalance(item);
    let status;
    if (bal.open) status = { text: '⏳ Not paid yet', color: C.amber, bg: C.amberBg };
    else if (bal.owed) status = { text: `${inr(bal.owed)} to collect`, color: C.green, bg: C.greenBg };
    else if (bal.owe) status = { text: `You owe ${inr(bal.owe)}`, color: C.pink, bg: C.pinkBg };
    else if (bal.settled && people.length > 1) status = { text: '✅ Settled', color: C.sub, bg: C.cardHi };
    const me = people.find((p) => p.name === 'Me');
    const faces = people.slice(0, 4);

    return (
      <TouchableOpacity style={styles.card} onPress={() => onOpenBill(item.id)} activeOpacity={0.8}>
        <View style={styles.cardTop}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>🍽️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Night out'}</Text>
            <Text style={styles.cardMeta}>
              {when} · {people.length} {people.length === 1 ? 'person' : 'people'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.cardTotal}>{inr(item.total)}</Text>
            {me ? <Text style={styles.myShare}>your share {inr(me.amount_due)}</Text> : null}
          </View>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.faces}>
            {faces.map((p, i) => (
              <View key={p.name} style={[styles.face, { backgroundColor: hue(p.name), marginLeft: i ? -8 : 0 }, p.paid_at && styles.faceDone]}>
                <Text style={styles.faceText}>{show(p.name).charAt(0).toUpperCase()}</Text>
              </View>
            ))}
            {people.length > 4 ? <Text style={styles.more}>+{people.length - 4}</Text> : null}
          </View>
          {status ? (
            <View style={[styles.status, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const t = todaySummary(bills, expenses, budget);
  const budgetCard = (
    <TouchableOpacity style={styles.budget} onPress={onMoney} activeOpacity={0.85} disabled={!onMoney}>
      <View style={styles.budgetTop}>
        <Text style={styles.budgetKicker}>TONIGHT'S BUDGET</Text>
        <View style={styles.dayPill}>
          <Text style={styles.dayText}>DAY {new Date().getDate()}</Text>
        </View>
      </View>
      {budget ? (
        <>
          <View style={styles.budgetRow}>
            <Text style={[styles.budgetBig, t.left < 0 && { color: C.red }]}>{inr(Math.abs(t.left))}{t.left < 0 ? ' over' : ''}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.spentLabel}>SPENT</Text>
              <Text style={styles.spent}>-{inr(t.today)}</Text>
            </View>
          </View>
          <View style={styles.budgetTrack}>
            <View style={[styles.budgetFill, { width: `${t.allowance ? Math.min(100, Math.round((t.today / t.allowance) * 100)) : 0}%` }, t.left < 0 && { backgroundColor: C.red }]} />
          </View>
        </>
      ) : (
        <View style={styles.budgetRow}>
          <Text style={styles.budgetBig}>{inr(t.today)}</Text>
          <Text style={styles.setBudget}>Set a budget ›</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const header = (
    <View>
      {!showArchived ? <Marquee /> : null}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.clock}>{clock}</Text>
          {outNow ? (
            <View style={styles.outPill}>
              <Text style={styles.outText}>{outNow} out now</Text>
            </View>
          ) : null}
        </View>
        {onNotifications ? (
          <TouchableOpacity style={styles.bell} onPress={onNotifications}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unread ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        {onProfile ? (
          <TouchableOpacity style={[styles.bell, { marginLeft: 8 }]} onPress={onProfile}>
            <Text style={styles.bellIcon}>{name ? name[0].toUpperCase() : '👤'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.title}>{showArchived ? 'Archived' : "What's the 🔥 vibe\ntonight?"}</Text>
      {name && !showArchived ? <Text style={styles.hello}>{hello()}, {name} 👋</Text> : null}

      {!showArchived && onPlan ? <TonightCard onPlan={onPlan} onOpenPlan={onOpenPlan} refreshKey={loading} budget={budgetCard} streak={streak} /> : null}

      {/* ⚡ Fast settlement (Final UX): what's open, snap a new bill, or settle the oldest one */}
      {!showArchived ? (
        <View style={styles.settle}>
          <View style={styles.settleTop}>
            <Text style={styles.settleKicker}>{sum.owed || sum.owe ? 'FAST SETTLEMENT' : 'ALL SETTLED ✨'}</Text>
            {openBill ? <Text style={styles.settleCount}>{openCount} open {openCount === 1 ? 'bill' : 'bills'}</Text> : null}
          </View>
          <View style={styles.settleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settleLabel}>You'll get back</Text>
              <Text style={[styles.settleBig, { color: sum.owed ? C.lime : C.text }]}>{inr(sum.owed)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.settleLabel}>You owe</Text>
              <Text style={[styles.settleBig, { color: sum.owe ? C.pink : C.text }]}>{inr(sum.owe)}</Text>
            </View>
          </View>
          <View style={styles.settleBtns}>
            <TouchableOpacity style={styles.snapBtn} onPress={onNewBill} activeOpacity={0.85}>
              <Text style={styles.snapText}>📸 Snap bill</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settleBtn, !openBill && { backgroundColor: C.disabled }]}
              onPress={() => openBill && onOpenBill(openBill.id)}
              disabled={!openBill}
              activeOpacity={0.85}
            >
              <Text style={[styles.settleBtnText, !openBill && { color: C.faint }]}>{openBill ? (openAmt ? `Settle ${inr(openAmt)} ›` : 'Who paid? ›') : 'Nothing to settle'}</Text>
            </TouchableOpacity>
          </View>
          {onMoney ? (
            <TouchableOpacity style={styles.moneyRow} onPress={onMoney} activeOpacity={0.8}>
              <Text style={styles.moneyText}>👛 My money · {inr(moneySummary(bills, monthKey(new Date())).spent)} spent in {monthLabel(monthKey(new Date()))}</Text>
              <Text style={styles.moneyGo}>›</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {guest && !showArchived ? <GuestGate small onSave={onSaveAccount} /> : null}
      {!showArchived && onFriends && !guest ? <FriendsRow onOpen={() => onFriends(false)} onAdd={() => onFriends(true)} /> : null}
      {!showArchived && draft ? (
        <TouchableOpacity style={styles.draft} onPress={onResumeDraft} activeOpacity={0.85}>
          <Text style={styles.draftEmoji}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.draftTitle}>Finish your bill</Text>
            <Text style={styles.draftSub} numberOfLines={1}>
              {(draft.bill && draft.bill.restaurant) || 'Unsaved bill'} · {(draft.items || []).length} items · tap to continue
            </Text>
          </View>
          <TouchableOpacity onPress={onDiscardDraft} hitSlop={10}>
            <Text style={styles.draftX}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>{showArchived ? 'Archived bills' : '🧾 Your bills'}</Text>
        {archived.length > 0 || showArchived ? (
          <TouchableOpacity onPress={() => setShowArchived(!showArchived)} hitSlop={8}>
            <Text style={styles.sectionLink}>{showArchived ? '← Back' : `📦 Archived (${archived.length})`}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <NightSky height={300} />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderBill}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{showArchived ? '📦' : '🧾'}</Text>
              <Text style={styles.emptyText}>{showArchived ? 'No archived bills' : 'No bills yet'}</Text>
              {!showArchived ? (
                <>
                  <Text style={styles.emptySub}>Scan a receipt and we'll work out who pays what</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={onNewBill}>
                    <Text style={styles.emptyBtnText}>＋ Split a bill</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          )
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  hello: { color: C.sub, fontSize: 14, fontWeight: '500', marginTop: 4, marginBottom: 12 },
  title: { fontFamily: F.display, fontSize: 30, lineHeight: 36, color: C.text, marginTop: 2 },
  strip: { marginHorizontal: -20, marginTop: -14, marginBottom: 16, backgroundColor: C.lime, paddingVertical: 7, overflow: 'hidden', transform: [{ rotate: '-2deg' }] },
  stripText: { fontFamily: F.display, color: C.onLime, fontSize: 13, letterSpacing: 0.5, width: 2400, flexWrap: 'nowrap' },
  clock: { fontFamily: F.pixel, color: C.sub, fontSize: 13 },
  outPill: { alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12, marginTop: 6, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  outText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  budget: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 22, padding: 16, marginBottom: 14 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetKicker: { fontFamily: F.pixel, color: C.sub, fontSize: 11 },
  dayPill: { backgroundColor: C.cardHi, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  dayText: { fontFamily: F.pixel, color: C.text, fontSize: 10 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  budgetBig: { fontFamily: F.display, color: C.lime, fontSize: 34 },
  spentLabel: { fontFamily: F.pixel, color: C.faint, fontSize: 10 },
  spent: { fontFamily: F.bold, color: C.pink, fontSize: 17, marginTop: 2 },
  setBudget: { color: C.lime, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  budgetTrack: { height: 8, borderRadius: 4, backgroundColor: C.cardHi, overflow: 'hidden', marginTop: 12 },
  budgetFill: { height: '100%', borderRadius: 4, backgroundColor: C.lime },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 20 },
  bellBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  logo: { fontFamily: F.logo, color: C.lime, fontSize: 13, letterSpacing: 2, marginBottom: 6 },
  settle: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 22, padding: 16, marginBottom: 14 },
  settleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settleKicker: { fontFamily: F.pixel, color: C.pink, fontSize: 11, letterSpacing: 1.2 },
  settleCount: { color: C.faint, fontSize: 12, fontWeight: '700' },
  settleRow: { flexDirection: 'row', marginTop: 10 },
  settleLabel: { color: C.sub, fontSize: 12, fontWeight: '600' },
  settleBig: { fontFamily: F.display, fontSize: 24, marginTop: 4 },
  settleBtns: { flexDirection: 'row', marginTop: 14 },
  snapBtn: { flex: 1, backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginRight: 8 },
  snapText: { color: C.text, fontSize: 14, fontWeight: '800' },
  settleBtn: { flex: 1.2, backgroundColor: C.lime, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  settleBtnText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 14 },
  moneyText: { color: C.text, fontSize: 14, fontWeight: '600' },
  moneyGo: { color: C.faint, fontSize: 20 },

  draft: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, borderRadius: 16, padding: 12, marginBottom: 14 },
  draftEmoji: { fontSize: 22, marginRight: 10 },
  draftTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  draftSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  draftX: { color: C.faint, fontSize: 16, paddingHorizontal: 4 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 },
  section: { color: C.text, fontSize: 18, fontWeight: '700' },
  sectionLink: { color: C.lime, fontSize: 14, fontWeight: '600' },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconText: { fontSize: 22 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginRight: 8 },
  cardMeta: { color: C.faint, fontSize: 13, marginTop: 3 },
  cardTotal: { fontSize: 17, fontWeight: '800', color: C.text },
  myShare: { color: C.faint, fontSize: 12, marginTop: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
  faceDone: { opacity: 0.45 },
  faceText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  more: { color: C.faint, fontSize: 12, fontWeight: '700', marginLeft: 6 },
  status: { borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  statusText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', marginTop: 50 },
  emptyEmoji: { fontSize: 46 },
  emptyText: { fontSize: 19, color: C.text, fontWeight: '700', marginTop: 10 },
  emptySub: { fontSize: 14, color: C.sub, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  emptyBtn: { backgroundColor: C.lime, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 22, marginTop: 18, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  emptyBtnText: { color: C.onLime, fontSize: 15, fontWeight: '700' },
});
