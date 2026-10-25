import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearBadge } from '../services/push';
import { ICON, listNotifications, markAllRead, onNotification, openNotification } from '../services/notifications';
import { C, F } from '../services/theme';

const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

// 🔔 All notifications. Opening this marks them as read.
export default function NotificationsScreen({ onBack }) {
  const [list, setList] = useState(null);

  const load = useCallback(() => listNotifications().then(setList).catch(() => setList([])), []);
  useEffect(() => {
    load().then(() => markAllRead());
    clearBadge();
    return onNotification(() => load().then(() => markAllRead()));
  }, [load]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Notifications</Text>
      <FlatList
        data={list || []}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={list === null} onRefresh={load} tintColor={C.accentSoft} />}
        renderItem={({ item: n }) => (
          <TouchableOpacity style={[styles.row, !n.read_at && styles.unread]} onPress={() => openNotification(n)}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>{ICON[n.kind] || '🔔'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
            </View>
            <Text style={styles.time}>{ago(n.created_at)}</Text>
            {!n.read_at ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          list && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.body}>Friend requests, party chat and RSVPs show up here.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.pad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 16 },
  back: { color: C.accentSoft, fontSize: 17 },
  title: { fontFamily: F.display, fontSize: 32, color: C.text, marginTop: 14, marginBottom: 12 },
  pad: { paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14, marginBottom: 4 },
  unread: { backgroundColor: 'rgba(139,92,246,0.12)' },
  iconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 20 },
  flex: { flex: 1 },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  body: { color: C.sub, fontSize: 13, marginTop: 2 },
  time: { color: C.faint, fontSize: 12, marginLeft: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginLeft: 6 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
});
