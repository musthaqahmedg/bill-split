import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listBills } from '../services/bills';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function HomeScreen({ onNewBill, onLogout, onOpenBill }) {
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
        <Text style={styles.cardMeta}>{when}  ·  {people.length} {people.length === 1 ? 'person' : 'people'}</Text>
        <View style={styles.people}>
          {people.map((p) => (
            <Text key={p.name} style={[styles.person, p.paid_at && styles.personPaid]}>
              {p.paid_at ? '✅ ' : ''}{p.name} {inr(p.amount_due)}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{showArchived ? 'Archived' : 'Your Bills'}</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold' },
  logout: { color: '#007AFF', fontSize: 16 },
  switch: { alignSelf: 'flex-start', backgroundColor: '#F2F2F7', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 12 },
  switchText: { color: '#555', fontSize: 14, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: 'bold', flex: 1, marginRight: 10 },
  cardTotal: { fontSize: 17, fontWeight: 'bold', color: '#007AFF' },
  cardMeta: { color: '#999', fontSize: 13, marginTop: 4 },
  people: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  person: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6, fontSize: 13, color: '#333', overflow: 'hidden' },
  personPaid: { backgroundColor: '#E3F6E8', color: '#1E8E3E' },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#999' },
  emptySub: { fontSize: 14, color: '#bbb', marginTop: 6 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 30 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});