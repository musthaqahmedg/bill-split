import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const ago = (t) => {
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const EMOJI = { bug: '🐞', idea: '💡', love: '❤️' };
const SEV = [
  ['blocker', '🔴 Blocker', '#F87171'],
  ['major', '🟠 Major', '#FBBF24'],
  ['minor', '🟢 Minor', '#34D399'],
];

// 🐞 Team only: every bug note and idea from testers, with a ✅ Fixed tick
export default function BugListScreen({ onBack }) {
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('open');
  const [refreshing, setRefreshing] = useState(false);
  const [photo, setPhoto] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.rpc('bug_list_v2');
    if (error) Alert.alert('Error', error.message);
    setList(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const toggle = async (b) => {
    const next = b.status === 'fixed' ? 'new' : 'fixed';
    setList((l) => l.map((x) => (x.id === b.id ? { ...x, status: next } : x)));
    const { error } = await supabase.from('feedback').update({ status: next }).eq('id', b.id);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      load();
    }
  };

  // 🚦 how bad is it? (Blocker = must fix before launch)
  const setSeverity = async (b, sev) => {
    const next = b.severity === sev ? null : sev;
    setList((l) => l.map((x) => (x.id === b.id ? { ...x, severity: next } : x)));
    const { error } = await supabase.from('feedback').update({ severity: next }).eq('id', b.id);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      load();
    }
  };

  const openPhoto = async (path) => {
    const { data, error } = await supabase.storage.from('feedback').createSignedUrl(path, 600);
    if (error) return Alert.alert('Photo', error.message);
    setPhoto(data.signedUrl);
  };

  const shown = (list || []).filter((b) => (tab === 'open' ? b.status !== 'fixed' : b.status === 'fixed'));
  const openCount = (list || []).filter((b) => b.status !== 'fixed').length;
  const blockers = (list || []).filter((b) => b.status !== 'fixed' && b.severity === 'blocker').length;

  return (
    <View style={styles.page}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>🐞 Bug reports</Text>
      {blockers ? <Text style={styles.blockers}>🔴 {blockers} blocker{blockers === 1 ? '' : 's'} to fix before launch</Text> : null}

      <View style={styles.tabs}>
        {[['open', `Open · ${openCount}`], ['fixed', 'Fixed ✅']].map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {list === null ? (
        <ActivityIndicator color={C.accentSoft} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pad}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.accentSoft} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {!shown.length ? <Text style={styles.empty}>{tab === 'open' ? 'Nothing open 🎉' : 'Nothing fixed yet'}</Text> : null}
          {shown.map((b) => (
            <View key={b.id} style={[styles.card, b.status === 'fixed' && styles.cardFixed]}>
              <View style={styles.top}>
                <Text style={styles.who}>{EMOJI[b.kind] || '📝'} {b.name}</Text>
                <Text style={styles.when}>{ago(b.created_at)}</Text>
              </View>
              <Text style={styles.msg}>{b.message}</Text>
              <Text style={styles.meta}>
                {b.screen ? `📍 ${b.screen}` : ''}{b.device ? `  ·  📱 ${b.device}` : ''}{b.app_version ? `  ·  v${b.app_version}` : ''}
              </Text>
              {b.kind === 'bug' ? (
                <View style={styles.sevRow}>
                  {SEV.map(([k, label, color]) => (
                    <TouchableOpacity key={k} onPress={() => setSeverity(b, k)} style={[styles.sev, b.severity === k && { backgroundColor: color, borderColor: color }]}>
                      <Text style={[styles.sevText, b.severity === k && styles.sevTextOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <View style={styles.actions}>
                {b.photo_path ? (
                  <TouchableOpacity style={styles.ghost} onPress={() => openPhoto(b.photo_path)}>
                    <Text style={styles.ghostText}>📸 Screenshot</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.fix, b.status === 'fixed' && styles.fixOn]} onPress={() => toggle(b)}>
                  <Text style={[styles.fixText, b.status === 'fixed' && styles.fixTextOn]}>{b.status === 'fixed' ? '✅ Fixed' : 'Mark fixed'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPhoto(null)}>
          {photo ? <Image source={{ uri: photo }} style={styles.big} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 18 },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 6 },
  title: { color: C.text, fontSize: 28, fontWeight: '700', marginBottom: 12 },
  blockers: { color: '#F87171', fontSize: 14, fontWeight: '700', marginTop: -6, marginBottom: 10 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3, marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  tabTextOn: { color: C.text },
  pad: { paddingBottom: 60 },
  empty: { color: C.faint, fontSize: 15, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardFixed: { opacity: 0.6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  who: { color: C.text, fontSize: 15, fontWeight: '700' },
  when: { color: C.faint, fontSize: 12 },
  msg: { color: C.text, fontSize: 15, lineHeight: 21 },
  meta: { color: C.faint, fontSize: 12, marginTop: 8 },
  sevRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  sev: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 9 },
  sevText: { color: C.faint, fontSize: 12, fontWeight: '600' },
  sevTextOn: { color: '#0E0E13' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 8 },
  ghost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  ghostText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  fix: { backgroundColor: C.green, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  fixOn: { backgroundColor: C.greenBg },
  fixText: { color: '#0B2A1F', fontSize: 13, fontWeight: '800' },
  fixTextOn: { color: C.green },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 16 },
  big: { width: '100%', height: '85%' },
});
