import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pulse from './Pulse';
import { supportThreads } from '../services/support';
import { C, F } from '../services/theme';

const ago = (t) => {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

// 🛟 Team only: everyone who wrote to "Chat with us"
export default function SupportInbox({ onBack, onOpen }) {
  const [list, setList] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = () => supportThreads().then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.page}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Support inbox</Text>
      {list === null ? (
        <ActivityIndicator color={C.accentSoft} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.accentSoft} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {!list.length ? <Text style={styles.empty}>No messages yet 🌙</Text> : null}
          {list.map((t) => (
            <TouchableOpacity key={t.user_id} style={styles.row} onPress={() => onOpen({ userId: t.user_id, name: t.name })}>
              <Pulse name={t.name} size={42} />
              <View style={styles.flex}>
                <View style={styles.line1}>
                  <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.ago}>{ago(t.last_at)}</Text>
                </View>
                <Text style={[styles.last, t.needs_reply && styles.lastNew]} numberOfLines={1}>{t.last_body}</Text>
              </View>
              {t.needs_reply ? <View style={styles.dot} /> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 18 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 6 },
  title: { fontFamily: F.display, color: C.text, fontSize: 26, marginBottom: 12 },
  pad: { paddingBottom: 40 },
  empty: { color: C.faint, fontSize: 15, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  flex: { flex: 1, marginLeft: 12 },
  line1: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: C.text, fontSize: 15, fontWeight: '600', flex: 1 },
  ago: { color: C.faint, fontSize: 12, marginLeft: 8 },
  last: { color: C.faint, fontSize: 13, marginTop: 2 },
  lastNew: { color: C.text, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accentSoft, marginLeft: 8 },
});
