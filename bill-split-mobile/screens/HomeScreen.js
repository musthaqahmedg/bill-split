import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listExpenses } from '../services/expenses';
import { getNights, stats as nightStats } from '../services/safety';
import { myFriends } from '../services/friends';
import { activeLabel } from '../services/active';
import { supabase } from '../services/supabaseClient';
import { eventKm, eventsNear, eventsToPop, eventWhen, getEvent, markSeen, remindLater } from '../services/events';
import { tourDone } from '../components/Tour';
import EventPopup from './EventPopup';
import { getBudgets } from '../services/budget';
import { VIBES } from './PullUpScreen';
import { listBills } from '../services/bills';
import { listParties } from '../services/parties';
import { kindOf } from '../services/partyKinds';
import { countdown, planBucket, sortPlans, startTime } from '../services/when';
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

export default function HomeScreen({ onNewBill, onOpenBill, onFriends, onNotifications, draft, onResumeDraft, onDiscardDraft, guest, onSaveAccount, onMoney, onPlan, onOpenPlan, onProfile, onMenu, onPlanEvent, openEventId, onEventOpened, onPullUp, billsMode = false, onBills, onBookTable, onRooms, onBack, onManualSplit }) {
  const [unread] = useUnread();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(0);
  const [streak, setStreak] = useState(0);
  const [outNow, setOutNow] = useState(0);
  const [tonightBudget, setTonightBudget] = useState(0); // 🎯 budget set just for tonight
  const [events, setEvents] = useState([]); // 🎉 big events near you
  const [plans, setPlans] = useState([]); // 🗂️ Your Spaces
  // 🔔 opened from an event alert → show that event's pop-up
  useEffect(() => {
    if (!openEventId) return;
    let off = false;
    (async () => {
      if (openEventId === 'all') {
        const list = events.length ? events : await eventsNear().catch(() => []);
        if (!off && list.length) setPop({ list, start: 0 });
      } else {
        const ev = events.find((e) => e.id === openEventId) || (await getEvent(openEventId).catch(() => null));
        if (!off && ev && ev.status !== 'cancelled') setPop({ list: [ev], start: 0 });
      }
      onEventOpened && onEventOpened();
    })();
    return () => { off = true; };
  }, [openEventId]);
  const [pop, setPop] = useState(null); // { list, start } when the pop-up is open
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
    listParties().then((l) => setPlans(l || [])).catch(() => {});
    getBudgets().then((b) => { setBudget(b.month || 0); setTonightBudget(b.tonight || 0); }).catch(() => {});
    getNights().then((n) => setStreak(nightStats(n).current)).catch(() => {});
    // 🎉 big events near you: pop up the ones not seen yet (after the first-time tour); offline → skip quietly
    // 📍 after the first-time tour, ask for location once (friendly screen first), so events + alerts know your city
    (async () => {
      const done = await tourDone();
      const primed = await AsyncStorage.getItem('vo_loc_primed').catch(() => 'yes');
      if (done && !primed) AsyncStorage.setItem('vo_loc_primed', 'yes').catch(() => {});
      return eventsNear({ ask: done && !primed });
    })()
      .then(async (list) => {
        setEvents(list);
        if (!(await tourDone())) return;
        const fresh = await eventsToPop(list);
        if (fresh.length) setPop({ list: fresh, start: 0, auto: true });
      })
      .catch(() => {});
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

  const t = todaySummary(bills, expenses, budget, new Date(), tonightBudget);
  const hasBudget = !!(budget || tonightBudget);

  // 🗂️ Your Spaces: live and upcoming rooms (soonest first)
  const live = sortPlans(plans.filter((p) => planBucket(p) === 'live'), 'upcoming');
  const upcoming = sortPlans(plans.filter((p) => planBucket(p) === 'upcoming'), 'upcoming');
  const pendingSpaces = plans.filter((p) => planBucket(p) === 'past' && active.some((b) => b.party_id === p.id && (() => { const x = billBalance(b); return x.owed || x.owe || x.open; })()));
  const spaces = [...live, ...upcoming, ...pendingSpaces].slice(0, 3);
  const goingOf = (p) => (p.party_members || []).filter((m) => m.rsvp === 'in' || m.name === 'Me').length;
  const outOf = (p) => (p.party_members || []).filter((m) => m.live_status === 'omw' || m.live_status === 'here').length;
  const nextLine = (p) => {
    // a bill in this Space still open → that's the next thing to do
    const due = active.find((b) => b.party_id === p.id && (() => { const x = billBalance(b); return x.owed || x.owe || x.open; })());
    if (due) return `🧾 Bill pending · ${(p.party_members || []).length} people`;
    const st = startTime(p);
    const hrs = st ? Math.round((st - new Date()) / 36e5) : null;
    const when = planBucket(p) === 'live' ? (outOf(p) ? `Live · ${outOf(p)} out` : 'Tonight') : st && hrs >= 0 && hrs < 24 ? (hrs < 1 ? 'Starts soon' : `Starts in ${hrs}h`) : countdown(p);
    return `${when} · ${goingOf(p)} going`;
  };
  const nextHouse = [...live, ...upcoming].find((p) => p.kind === 'house');
  const nextNight = [...live, ...upcoming].find((p) => p.kind !== 'house');
  // "TUE · NIGHT STARTS IN 2H" when something starts within the day, else the clock
  const soon = [...live, ...upcoming].map((p) => startTime(p)).filter((d) => d && d > new Date() && d - new Date() < 864e5).sort((x, y) => x - y)[0];
  const topLine = soon
    ? `${new Date().toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()} · NIGHT STARTS IN ${Math.max(1, Math.round((soon - new Date()) / 36e5))}H`
    : clock;

  const TILES = [
    { key: 'house', emoji: '🏠', title: 'House\nParty', sub: 'Host parties, movie nights & private hangouts', bg: C.lime, badge: nextHouse ? `${goingOf(nextHouse)} going` : null, go: () => onPlan && onPlan('house') },
    { key: 'night', emoji: '🌙', title: 'Plan a\nNight', sub: 'Discover places, DJ nights & upcoming events', bg: C.violet, badge: nextNight ? `${goingOf(nextNight)} in` : null, go: () => onPullUp && onPullUp(null) },
    { key: 'split', emoji: '🧾', title: 'Split\nBills', sub: 'Scan bills and pay only your share', bg: C.pink, badge: openCount ? `${openCount} due` : null, go: onBills || onNewBill },
    { key: 'table', emoji: '🍽️', title: 'Book\nTable', sub: 'Discover spots and reserve your table', bg: C.cyan, badge: null, go: onBookTable },
  ];

  const header = billsMode ? (
    <View>
      <TouchableOpacity onPress={onBack} hitSlop={10}>
        <Text style={styles.backLink}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.pageTitle}>{showArchived ? 'Archived' : 'Split Bills'}</Text>
      <Text style={styles.hello}>Split expenses. Keep friendships simple.</Text>
      {!showArchived ? (
        <View>
          {/* Two ways to split: a receipt (by item) or typed expenses (no bill needed) */}
          <TouchableOpacity style={styles.scanBig} onPress={onNewBill} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.scanEmoji}>📸</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>Scan a Bill</Text>
              <Text style={styles.scanSub}>Scan your restaurant or pub bill and split each item</Text>
            </View>
            <Text style={styles.scanGo}>›</Text>
          </TouchableOpacity>
          {onManualSplit ? (
            <TouchableOpacity style={[styles.scanBig, { backgroundColor: C.cyan, marginTop: 0 }]} onPress={onManualSplit} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.scanEmoji}>✍️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanTitle}>Manual Split</Text>
                <Text style={styles.scanSub}>No bill? Make a group, add expenses, choose how to split</Text>
              </View>
              <Text style={styles.scanGo}>›</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {!showArchived && (sum.owed || sum.owe) ? (
        <View style={styles.settle}>
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
        </View>
      ) : null}
      {draft && !showArchived ? (
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
        <Text style={styles.section}>{showArchived ? 'Archived bills' : 'Your bills'}</Text>
        {archived.length > 0 || showArchived ? (
          <TouchableOpacity onPress={() => setShowArchived(!showArchived)} hitSlop={8}>
            <Text style={styles.sectionLink}>{showArchived ? '← Back' : `📦 Archived (${archived.length})`}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  ) : (
    <View>
      <Marquee />
      <View style={styles.header}>
        <Text style={[styles.clock, { flex: 1, fontSize: 11, lineHeight: 15, marginRight: 8 }]} numberOfLines={2}>{topLine}</Text>
        <View style={styles.streak}>
          <Text style={styles.streakText}>🔥 {streak}</Text>
        </View>
        {onNotifications ? (
          <TouchableOpacity style={styles.bell} onPress={onNotifications} accessibilityLabel="Notifications">
            <Text style={styles.bellIcon}>🔔</Text>
            {unread ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        {onProfile ? (
          <TouchableOpacity style={[styles.bell, styles.avatar]} onPress={onProfile} accessibilityLabel="Profile">
            <Text style={styles.avatarText}>{name ? name[0].toUpperCase() : '👤'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {name ? <Text style={styles.hello}>{hello()}, {name} 👋</Text> : null}
      <Text style={styles.title}>What's the vibe 🔥{'\n'}tonight?</Text>

      {/* 🗂️ Your Spaces */}
      {spaces.length ? (
        <View style={{ marginTop: 18 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.kicker}>YOUR SPACES</Text>
            {onRooms ? (
              <TouchableOpacity onPress={onRooms} hitSlop={8}>
                <Text style={styles.seeAll}>SEE ALL</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {spaces.map((p) => (
            <TouchableOpacity key={p.id} style={styles.space} onPress={() => onOpenPlan && onOpenPlan(p.id)} activeOpacity={0.85}>
              <View style={[styles.spaceIcon, { backgroundColor: (kindOf(p.kind).color || C.violet) + '33' }]}>
                <Text style={styles.spaceEmoji}>{kindOf(p.kind).emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.spaceName} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.spaceLine} numberOfLines={1}>{nextLine(p)}</Text>
              </View>
              {planBucket(p) === 'live' ? <View style={styles.liveDot} /> : <Text style={styles.spaceGo}>›</Text>}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* 🟨 The four things you do here */}
      <View style={styles.tiles}>
        {TILES.map((x) => (
          <TouchableOpacity key={x.key} style={[styles.tile, { backgroundColor: x.bg }]} onPress={x.go} activeOpacity={0.85}>
            <View style={styles.tileTop}>
              <Text style={styles.tileEmoji}>{x.emoji}</Text>
              {x.badge ? (
                <View style={styles.tileBadge}>
                  <Text style={styles.tileBadgeText}>{x.badge}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={styles.tileTitle}>{x.title}</Text>
              <Text style={styles.tileSub}>{x.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* 👛 Tonight's budget → money tracker */}
      <TouchableOpacity style={styles.budget} onPress={onMoney} activeOpacity={0.85} disabled={!onMoney}>
        <View style={styles.budgetTop}>
          <Text style={styles.budgetKicker}>💳 TONIGHT'S BUDGET</Text>
          <Text style={styles.budgetDay}>DAY {new Date().getDate()}</Text>
        </View>
        {hasBudget ? (
          <>
            <View style={styles.budgetRow}>
              <Text style={[styles.budgetBig, t.left < 0 && { color: C.red }]}>{inr(Math.abs(t.left))}</Text>
              <Text style={styles.budgetLeft}>{t.left < 0 ? 'over' : 'left'} · {inr(t.today)} spent</Text>
            </View>
            <View style={styles.budgetTrack}>
              <View style={[styles.budgetFill, { width: `${t.allowance ? Math.max(3, Math.min(100, Math.round((t.today / t.allowance) * 100))) : 3}%` }, t.left < 0 && { backgroundColor: C.red }]} />
            </View>
          </>
        ) : (
          <View style={styles.budgetRow}>
            <Text style={styles.budgetBig}>{inr(t.today)}</Text>
            <Text style={styles.setLimit}>Set limit ›</Text>
          </View>
        )}
      </TouchableOpacity>

      {guest ? <GuestGate small onSave={onSaveAccount} /> : null}
      {draft ? (
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
    </View>
  );

  return (
    <View style={styles.container}>
      <NightSky height={300} />
      {pop ? (
        <EventPopup
          visible
          events={pop.list}
          start={pop.start}
          onClose={() => { if (pop.auto) markSeen(pop.list.map((e) => e.id)); setPop(null); }}
          onRemind={() => { remindLater(pop.list.map((e) => e.id)); setPop(null); }}
          onPlanEvent={(e) => { markSeen([e.id]); setPop(null); onPlanEvent && onPlanEvent(e); }}
        />
      ) : null}
      <FlatList
        data={billsMode ? visible : []}
        keyExtractor={(item) => item.id}
        renderItem={renderBill}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        ListEmptyComponent={
          billsMode && !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{showArchived ? '📦' : '🧾'}</Text>
              <Text style={styles.emptyText}>{showArchived ? 'No archived bills' : 'No bills yet'}</Text>
              {!showArchived ? <Text style={styles.emptySub}>Your split bills show up here.</Text> : null}
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
  // 🌙 Home (Spaces pipeline)
  streak: { backgroundColor: C.violet, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, borderRightWidth: 2, borderBottomWidth: 3, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  streakText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  avatar: { backgroundColor: C.lime, marginLeft: 8 },
  avatarText: { fontFamily: F.display, color: C.onLime, fontSize: 16 },
  kicker: { fontFamily: F.pixel, color: C.sub, fontSize: 11 },
  seeAll: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  space: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 20, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  spaceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  spaceEmoji: { fontSize: 22 },
  spaceName: { color: C.text, fontSize: 16, fontWeight: '800' },
  spaceLine: { color: C.sub, fontSize: 13, marginTop: 2 },
  spaceGo: { color: C.faint, fontSize: 24, marginLeft: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.lime, marginLeft: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 },
  tile: { width: '48.5%', minHeight: 150, borderRadius: 28, padding: 16, marginBottom: 10, justifyContent: 'space-between', borderRightWidth: 3, borderBottomWidth: 5, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tileEmoji: { fontSize: 36 },
  tileBadge: { backgroundColor: C.onLime, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  tileBadgeText: { fontFamily: F.pixel, color: '#fff', fontSize: 10 },
  tileTitle: { fontFamily: F.display, color: C.onLime, fontSize: 21, lineHeight: 24, marginTop: 10 },
  tileSub: { color: C.onLime, fontSize: 12, fontWeight: '700', opacity: 0.7, marginTop: 4 },
  budgetDay: { fontFamily: F.pixel, color: C.sub, fontSize: 11 },
  budgetLeft: { color: C.sub, fontSize: 14, fontWeight: '700' },
  setLimit: { color: C.lime, fontSize: 15, fontWeight: '800' },
  backLink: { color: C.lime, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  pageTitle: { fontFamily: F.display, color: C.text, fontSize: 36 },
  scanBig: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.pink, borderRadius: 24, padding: 18, marginTop: 14, marginBottom: 12, borderRightWidth: 3, borderBottomWidth: 5, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  scanEmoji: { fontSize: 34, marginRight: 12 },
  scanTitle: { fontFamily: F.display, color: C.onLime, fontSize: 19 },
  scanSub: { color: C.onLime, fontSize: 13, fontWeight: '700', opacity: 0.75, marginTop: 2 },
  scanGo: { fontFamily: F.display, color: C.onLime, fontSize: 28, marginLeft: 8 },
  container: { flex: 1, backgroundColor: C.bg },
  list: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  hello: { color: C.sub, fontSize: 15, fontWeight: '600', marginTop: 2, marginBottom: 4 },
  vibe: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  vibeText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
  qBtn: { width: '48.5%', minHeight: 118, borderRadius: 24, padding: 16, marginBottom: 10, justifyContent: 'space-between', borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  qEmoji: { fontSize: 34 },
  qLabel: { fontFamily: F.display, color: C.onLime, fontSize: 19, lineHeight: 22, marginTop: 8 },
  title: { fontFamily: F.display, fontSize: 30, lineHeight: 36, color: C.text, marginTop: 2 },
  strip: { marginHorizontal: -20, marginTop: -14, marginBottom: 16, backgroundColor: C.lime, paddingVertical: 7, overflow: 'hidden', transform: [{ rotate: '-2deg' }] },
  stripText: { fontFamily: F.display, color: C.onLime, fontSize: 13, letterSpacing: 0.5, width: 2400, flexWrap: 'nowrap' },
  clock: { fontFamily: F.pixel, color: C.sub, fontSize: 13 },
  outPill: { alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12, marginTop: 6, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  outText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  evKicker: { fontFamily: F.pixel, color: C.pink, fontSize: 11, marginBottom: 8 },
  evCard: { width: 150, marginRight: 10 },
  evPoster: { height: 190, borderRadius: 18, backgroundColor: '#3B1FE0', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.lime },
  evSold: { position: 'absolute', bottom: 8, left: 8, backgroundColor: C.onLime, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 7 },
  evSoldText: { fontFamily: F.pixel, color: C.pink, fontSize: 10 },
  evTitle: { color: C.text, fontSize: 14, fontWeight: '800', marginTop: 6 },
  evMeta: { color: C.faint, fontSize: 11, marginTop: 1 },
  budget: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 18, marginTop: 4, marginBottom: 14 },
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
  menuBtn: { marginRight: 8, backgroundColor: C.lime, borderColor: C.lime },
  bar: { width: 20, height: 3, borderRadius: 2, backgroundColor: C.onLime },
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
