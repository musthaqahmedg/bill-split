import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listParties } from '../services/parties';
import { kindOf } from '../services/partyKinds';
import StreakCard from './StreakCard';
import { C } from '../services/theme';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function PartiesScreen({ onBack, onNewParty, onOpenParty, onGroups }) {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setTick((t) => t + 1);
    try {
      setParties(await listParties());
    } catch (e) {
      console.log('Could not load parties:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderParty = ({ item }) => {
    const members = item.party_members || [];
    const owing = members.filter((m) => m.name !== 'Me' && Number(m.share) > 0);
    const paid = owing.filter((m) => m.paid_at).length;
    return (
      <TouchableOpacity style={styles.card} onPress={() => onOpenParty(item.id)}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{kindOf(item.kind).emoji} {item.title}</Text>
          <Text style={styles.cardTotal}>{inr(item.budget)}</Text>
        </View>
        <Text style={styles.cardMeta}>
          {[item.party_date, item.place].filter(Boolean).join('  ·  ') || 'No date yet'}
        </Text>
        <Text style={styles.cardPaid}>
          {members.length} people  ·  {item.split_mode === 'treat' ? 'Treat 🎁' : `${paid} of ${owing.length} paid`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>
      <View style={styles.topRow}>
        <Text style={styles.title}>Plans 🎉</Text>
        <TouchableOpacity style={styles.groupsBtn} onPress={onGroups}>
          <Text style={styles.groupsText}>👥 Groups</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Parties, trips, movies, weddings: plan it all with friends</Text>

      <FlatList
        data={parties}
        keyExtractor={(item) => item.id}
        renderItem={renderParty}
        ListHeaderComponent={<StreakCard refreshKey={tick} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No parties yet</Text>
              <Text style={styles.emptySub}>Plan one and split the budget upfront</Text>
            </View>
          )
        }
        contentContainerStyle={parties.length === 0 && styles.emptyList}
      />

      <TouchableOpacity style={styles.button} onPress={onNewParty}>
        <Text style={styles.buttonText}>+ Plan something</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupsBtn: { backgroundColor: C.cardHi, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14 },
  groupsText: { color: C.accentSoft, fontSize: 14, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', color: C.text },
  sub: { color: C.faint, fontSize: 14, marginTop: 4, marginBottom: 15 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: '800', flex: 1, marginRight: 10, color: C.text },
  cardTotal: { fontSize: 17, fontWeight: '800', color: C.accentSoft },
  cardMeta: { color: C.faint, fontSize: 13, marginTop: 4 },
  cardPaid: { color: C.green, fontSize: 13, fontWeight: '700', marginTop: 8 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: 18, color: C.sub },
  emptySub: { fontSize: 14, color: C.faint, marginTop: 6 },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 30 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});