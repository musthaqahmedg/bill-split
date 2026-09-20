import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen({ onNewBill, onLogout }) {
  const bills = [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Bills</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTotal}>Rs {item.total}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bills yet</Text>
            <Text style={styles.emptySub}>Scan a receipt to get started</Text>
          </View>
        }
        contentContainerStyle={bills.length === 0 && styles.emptyList}
      />

      <TouchableOpacity style={styles.button} onPress={onNewBill}>
        <Text style={styles.buttonText}>+ New Bill</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  logout: { color: '#007AFF', fontSize: 16 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 15, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardTotal: { fontSize: 14, color: '#666', marginTop: 4 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#999' },
  emptySub: { fontSize: 14, color: '#bbb', marginTop: 6 },
  button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 30 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});