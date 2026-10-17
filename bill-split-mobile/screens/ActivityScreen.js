import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ICON = { open: '👀', 'saved a bill': '🧾', 'created a plan': '🎉', 'booked a table': '🍽️', 'sent a message': '💬', 'saved a place': '⭐' };

// 📊 Live activity (founders only): who's in the app right now and what they're doing
export default function ActivityScreen({ onBack }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase.rpc('get_activity', { p_limit: 150 });
    if (e) setError(e.message);
    else setEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // New taps arrive live
    const ch = supabase
      .channel('activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_events' }, () => load())
      .subscribe();
    const t = setInterval(() => setTick((x) => x + 1), 30000); // refresh "2m ago"
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [load]);

  // Online now = did something in the last 3 minutes
  const online = {};
  for (const e of events) {
    if (Date.now() - new Date(e.at).getTime() < 3 * 60 * 1000 && !online[e.user_id]) online[e.user_id] = e;
  }
  const onlineList = Object.values(online);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.sub}>Live · only you and Gautham can see this</Text>

      <View style={styles.onlineBox}>
        <Text style={styles.onlineTitle}>🟢 Online now ({onlineList.length})</Text>
        {onlineList.length === 0 ? (
          <Text style={styles.faint}>Nobody right now</Text>
        ) : (
          onlineList.map((e) => (
            <Text key={e.user_id} style={styles.onlineRow}>
              <Text style={styles.bold}>{e.who}</Text> · on {e.screen}
            </Text>
          ))
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={events}
        keyExtractor={(e) => String(e.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />}
        renderItem={({ item: e }) => (
          <View style={styles.row}>
            <Text style={styles.icon}>{ICON[e.action] || '👆'}</Text>
            <View style={styles.flex}>
              <Text style={styles.text} numberOfLines={2}>
                <Text style={styles.bold}>{e.who}</Text> {e.action === 'open' ? `opened ${e.screen}` : e.action}
                {e.detail ? <Text style={styles.faint}> · {e.detail}</Text> : null}
              </Text>
            </View>
            <Text style={styles.time}>{ago(e.at)}</Text>
          </View>
        )}
        ListEmptyComponent={!loading && <Text style={styles.faint}>No activity yet. It shows up as people use the app.</Text>}
        contentContainerStyle={styles.pad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 16 },
  back: { color: C.accentSoft, fontSize: 17 },
  title: { fontSize: 34, fontWeight: '700', color: C.text, marginTop: 14 },
  sub: { color: C.faint, fontSize: 13, marginBottom: 14 },
  onlineBox: { backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 14, padding: 12, marginBottom: 12 },
  onlineTitle: { color: C.green, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  onlineRow: { color: C.text, fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  icon: { fontSize: 18, width: 30 },
  flex: { flex: 1 },
  text: { color: C.text, fontSize: 14 },
  bold: { fontWeight: '700' },
  faint: { color: C.faint, fontSize: 13 },
  time: { color: C.faint, fontSize: 12, marginLeft: 8 },
  error: { color: C.red, fontSize: 13, marginBottom: 8 },
  pad: { paddingBottom: 40 },
});
