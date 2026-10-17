import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const ago = (t) => {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ICON = { open: '👀', 'saved a bill': '🧾', 'created a plan': '🎉', 'booked a table': '🍽️', 'sent a message': '💬', 'saved a place': '⭐' };

// 📊 Developer analytics (only you): users, activity, what people use, live feed
export default function ActivityScreen({ onBack }) {
  const [tab, setTab] = useState('overview');
  const [a, setA] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [an, ev] = await Promise.all([supabase.rpc('get_analytics'), supabase.rpc('get_activity', { p_limit: 150 })]);
    if (an.error || ev.error) setError((an.error || ev.error).message);
    else {
      setError('');
      setA(an.data);
      setEvents(ev.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_events' }, () => load())
      .subscribe();
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [load]);

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
      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.sub}>Only you can see this</Text>

      <View style={styles.tabs}>
        {[['overview', 'Overview'], ['users', 'Users'], ['live', `Live${onlineList.length ? ` · ${onlineList.length} 🟢` : ''}`]].map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accentSoft} />} contentContainerStyle={styles.pad}>
        {a && tab === 'overview' && <Overview a={a} />}
        {a && tab === 'users' && <Users a={a} />}
        {tab === 'live' && <Live events={events} onlineList={onlineList} />}
      </ScrollView>
    </View>
  );
}

function Tile({ n, label, tone }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileNum, tone && { color: tone }]}>{n}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Bars({ rows, labelKey, max }) {
  return rows.map((r) => (
    <View key={r[labelKey]} style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{r[labelKey]}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(4, (r.n / max) * 100)}%` }]} />
      </View>
      <Text style={styles.barNum}>{r.n}</Text>
    </View>
  ));
}

function Overview({ a }) {
  const maxDay = Math.max(1, ...a.daily.map((d) => d.users));
  const maxScreen = Math.max(1, ...a.top_screens.map((s) => s.n));
  const maxAction = Math.max(1, ...a.top_actions.map((s) => s.n));
  return (
    <View>
      <Text style={styles.section}>USERS</Text>
      <View style={styles.tiles}>
        <Tile n={a.online_now} label="Online now" tone={C.green} />
        <Tile n={a.active_today} label="Active today" />
        <Tile n={a.active_7d} label="Active 7 days" />
      </View>
      <View style={styles.tiles}>
        <Tile n={a.users_total} label="Total users" />
        <Tile n={a.users_new_7d} label="New this week" />
        <Tile n={a.guests_total} label="Invited guests" />
      </View>

      <Text style={styles.section}>ACTIVE USERS · LAST 7 DAYS</Text>
      <View style={styles.chart}>
        {a.daily.map((d) => (
          <View key={d.day} style={styles.col}>
            <Text style={styles.colNum}>{d.users || ''}</Text>
            <View style={[styles.colBar, { height: Math.max(3, (d.users / maxDay) * 90) }, !d.users && styles.colEmpty]} />
            <Text style={styles.colLabel}>{d.day.split(' ')[0]}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>WHAT PEOPLE MADE</Text>
      <View style={styles.tiles}>
        <Tile n={a.bills_total} label="🧾 Bills" />
        <Tile n={a.plans_total} label="🎉 Plans" />
        <Tile n={a.rsvps_total} label="✋ RSVPs" />
      </View>
      <View style={styles.tiles}>
        <Tile n={a.bookings_total} label="🍽️ Bookings" />
        <Tile n={a.checkins_total} label="🏠 Check-ins" />
        <Tile n={a.messages_total} label="💬 Messages" />
      </View>

      <Text style={styles.section}>MOST OPENED SCREENS · 30 DAYS</Text>
      {a.top_screens.length ? <Bars rows={a.top_screens} labelKey="screen" max={maxScreen} /> : <Text style={styles.faint}>No data yet</Text>}

      <Text style={styles.section}>TOP ACTIONS · 30 DAYS</Text>
      {a.top_actions.length ? <Bars rows={a.top_actions} labelKey="action" max={maxAction} /> : <Text style={styles.faint}>No data yet</Text>}
      <Text style={styles.note}>Screens and actions are counted from 17 Oct (when tracking started).</Text>
    </View>
  );
}

function Users({ a }) {
  return a.users.map((u) => {
    const on = u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 3 * 60 * 1000;
    return (
      <View key={u.id} style={styles.userRow}>
        <View style={[styles.dot, { backgroundColor: on ? C.green : 'rgba(255,255,255,0.2)' }]} />
        <View style={styles.flex}>
          <Text style={styles.userName} numberOfLines={1}>{u.who}</Text>
          <Text style={styles.faint}>Joined {u.joined} · seen {ago(u.last_seen)}</Text>
        </View>
        <Text style={styles.userStats}>🧾 {u.bills}  🎉 {u.plans}  👆 {u.events}</Text>
      </View>
    );
  });
}

function Live({ events, onlineList }) {
  return (
    <View>
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
      {events.length === 0 && <Text style={styles.faint}>No activity yet.</Text>}
      {events.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.icon}>{ICON[e.action] || '👆'}</Text>
          <Text style={[styles.text, styles.flex]} numberOfLines={2}>
            <Text style={styles.bold}>{e.who}</Text> {e.action === 'open' ? `opened ${e.screen}` : e.action}
            {e.detail ? <Text style={styles.faint}> · {e.detail}</Text> : null}
          </Text>
          <Text style={styles.time}>{ago(e.at)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 16 },
  back: { color: C.accentSoft, fontSize: 17 },
  title: { fontSize: 34, fontWeight: '700', color: C.text, marginTop: 14 },
  sub: { color: C.faint, fontSize: 13, marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  tabTextOn: { color: C.text },
  pad: { paddingBottom: 40 },
  section: { color: C.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  tiles: { flexDirection: 'row', marginBottom: 8 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 12, marginHorizontal: 3, alignItems: 'center' },
  tileNum: { color: C.text, fontSize: 24, fontWeight: '700' },
  tileLabel: { color: C.faint, fontSize: 11, marginTop: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 130, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  colNum: { color: C.sub, fontSize: 11, marginBottom: 3 },
  colBar: { width: 16, borderRadius: 5, backgroundColor: C.accent },
  colEmpty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  colLabel: { color: C.faint, fontSize: 11, marginTop: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  barLabel: { color: C.text, fontSize: 13, width: 110 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.accent },
  barNum: { color: C.sub, fontSize: 12, width: 34, textAlign: 'right' },
  note: { color: C.faint, fontSize: 11, marginTop: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  userName: { color: C.text, fontSize: 15, fontWeight: '600' },
  userStats: { color: C.sub, fontSize: 12, marginLeft: 8 },
  onlineBox: { backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 14, padding: 12, marginBottom: 12 },
  onlineTitle: { color: C.green, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  onlineRow: { color: C.text, fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  icon: { fontSize: 18, width: 30 },
  flex: { flex: 1 },
  text: { color: C.text, fontSize: 14 },
  bold: { fontWeight: '700' },
  faint: { color: C.faint, fontSize: 12 },
  time: { color: C.faint, fontSize: 12, marginLeft: 8 },
  error: { color: C.red, fontSize: 13, marginBottom: 8 },
});
