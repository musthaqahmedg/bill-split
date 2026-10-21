import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listBills } from '../services/bills';
import { show } from '../services/names';
import { C } from '../services/theme';
import FriendsRow from './FriendsRow';
import { useUnread } from '../services/notifications';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function HomeScreen({ onNewBill, onProfile, onOpenBill, onParties, onFriends, onNotifications }) {
  const [unread] = useUnread();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const archived = bills.filter((b) => b.status === 'archived');
  const active = bills.filter((b) => b.status !== 'archived');
  const visible = showArchived ? archived : active;

  const renderBill = ({ item }) => {
    const when = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const people = item.bill_participants || [];
    return (
      <TouchableOpacity style={styles.card} onPress={() => onOpenBill(item.id)}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{item.title || 'Night out'}</Text>
          <Text style={styles.cardTotal}>{inr(item.total)}</Text>
        </View>
        <Text style={styles.cardMeta}>
          {when}  ·  {people.length} {people.length === 1 ? 'person' : 'people'}
          {item.paid_mode === 'unpaid' ? '  ·  ⏳ Not paid yet' : ''}
        </Text>
        <View style={styles.people}>
          {people.map((p) => {
            const payer = Number(p.paid_amount) > 0 || (!item.paid_mode && p.name === 'Me'); // 💳 paid the restaurant
            return (
              <Text key={p.name} style={[styles.person, (p.paid_at || payer) && styles.personPaid]}>
                {payer ? '💳 ' : p.paid_at ? '✅ ' : ''}{show(p.name)} {inr(p.amount_due)}
              </Text>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{showArchived ? 'Archived' : 'Your Bills'}</Text>
        <View style={styles.headerBtns}>
          {onNotifications ? (
            <TouchableOpacity style={[styles.profileBtn, styles.partyBtn]} onPress={onNotifications}>
              <Text style={styles.profileIcon}>🔔</Text>
              {unread ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.plansBtn} onPress={onParties} activeOpacity={0.85}>
            <Text style={styles.plansText}>🎉 Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={onProfile}>
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!showArchived && onFriends ? <FriendsRow onOpen={() => onFriends(false)} onAdd={() => onFriends(true)} /> : null}

      {(archived.length > 0 || showArchived) && (
        <TouchableOpacity style={styles.switch} onPress={() => setShowArchived(!showArchived)}>
          <Text style={styles.switchText}>
            {showArchived ? '← Back to your bills' : `📦 Archived (${archived.length})`}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderBill}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{showArchived ? 'No archived bills' : 'No bills yet'}</Text>
              {!showArchived && <Text style={styles.emptySub}>Scan a receipt to get started</Text>}
            </View>
          )
        }
        contentContainerStyle={visible.length === 0 && styles.emptyList}
      />

      {!showArchived && (
        <TouchableOpacity style={styles.button} onPress={onNewBill}>
          <Text style={styles.buttonText}>+ New Bill</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: C.text },
  profileBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 20 },
  headerBtns: { flexDirection: 'row' },
  partyBtn: { marginRight: 10 },
  bellBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  plansBtn: { height: 34, borderRadius: 17, paddingHorizontal: 14, marginRight: 10, justifyContent: 'center', backgroundColor: C.accent },
  plansText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  switch: { alignSelf: 'flex-start', backgroundColor: C.card, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 12 },
  switchText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: '800', flex: 1, marginRight: 10, color: C.text },
  cardTotal: { fontSize: 17, fontWeight: '800', color: C.accentSoft },
  cardMeta: { color: C.faint, fontSize: 13, marginTop: 4 },
  people: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  person: { backgroundColor: C.cardHi, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6, fontSize: 13, color: C.sub, overflow: 'hidden' },
  personPaid: { backgroundColor: C.greenBg, color: C.green },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: 18, color: C.sub },
  emptySub: { fontSize: 14, color: C.faint, marginTop: 6 },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 30 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});