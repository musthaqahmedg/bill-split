import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listBills } from '../services/bills';
import { show } from '../services/names';
import { getProfile } from '../services/profile';
import { billBalance, homeBalance } from '../services/settle';
import { monthKey, monthLabel, moneySummary } from '../services/money';
import { C } from '../services/theme';
import FriendsRow from './FriendsRow';
import GuestGate from './GuestGate';
import TonightCard from './TonightCard';
import { useUnread } from '../services/notifications';

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const hello = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const HUES = ['#4C5BD4', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];

export default function HomeScreen({ onNewBill, onOpenBill, onFriends, onNotifications, draft, onResumeDraft, onDiscardDraft, guest, onSaveAccount, onMoney, onPlan, onOpenPlan }) {
  const [unread] = useUnread();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');

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
  }, [load]);

  const archived = bills.filter((b) => b.status === 'archived');
  const active = bills.filter((b) => b.status !== 'archived');
  const visible = showArchived ? archived : active;
  const sum = homeBalance(bills);

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

  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{hello()}{name ? `, ${name}` : ''} 👋</Text>
          <Text style={styles.title}>{showArchived ? 'Archived' : "What's the vibe\ntonight? ✨"}</Text>
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
      </View>

      {!showArchived && onPlan ? <TonightCard onPlan={onPlan} onOpenPlan={onOpenPlan} refreshKey={loading} /> : null}

      {!showArchived && (active.length || onMoney) ? (
        <TouchableOpacity style={styles.summaryWrap} onPress={onMoney} activeOpacity={0.85} disabled={!onMoney}>
        <View style={styles.summary}>
          <View style={styles.sumBox}>
            <Text style={styles.sumLabel}>You'll get back</Text>
            <Text style={[styles.sumValue, { color: sum.owed ? C.green : C.text }]}>{inr(sum.owed)}</Text>
          </View>
          <View style={styles.sumLine} />
          <View style={styles.sumBox}>
            <Text style={styles.sumLabel}>You owe</Text>
            <Text style={[styles.sumValue, { color: sum.owe ? C.pink : C.text }]}>{inr(sum.owe)}</Text>
          </View>
        </View>
          {onMoney ? (
            <View style={styles.moneyRow}>
              <Text style={styles.moneyText}>💰 My Money · {inr(moneySummary(bills, monthKey(new Date())).spent)} spent in {monthLabel(monthKey(new Date()))}</Text>
              <Text style={styles.moneyGo}>›</Text>
            </View>
          ) : null}
        </TouchableOpacity>
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
  hello: { color: C.sub, fontSize: 15, fontWeight: '500' },
  title: { fontSize: 30, fontWeight: '800', color: C.text, marginTop: 2 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 20 },
  bellBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  summaryWrap: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, marginBottom: 14, overflow: 'hidden' },
  summary: { flexDirection: 'row', paddingVertical: 16 },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 11, paddingHorizontal: 16 },
  moneyText: { color: C.text, fontSize: 14, fontWeight: '600' },
  moneyGo: { color: C.faint, fontSize: 20 },
  sumBox: { flex: 1, alignItems: 'center' },
  sumLine: { width: 1, backgroundColor: C.border },
  sumLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  sumValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },

  draft: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amber, borderRadius: 16, padding: 12, marginBottom: 14 },
  draftEmoji: { fontSize: 22, marginRight: 10 },
  draftTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  draftSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  draftX: { color: C.faint, fontSize: 16, paddingHorizontal: 4 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 10 },
  section: { color: C.text, fontSize: 18, fontWeight: '700' },
  sectionLink: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },

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
  emptyBtn: { backgroundColor: C.accent, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 22, marginTop: 18 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
