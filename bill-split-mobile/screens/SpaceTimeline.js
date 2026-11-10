import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';

// 🕒 Timeline: the night, step by step — plan made → who's in → votes → booking → bills → paid → photos → home safe

const time = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (d) => {
  const t = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function SpaceTimeline({ party }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let live = true;
    supabase
      .rpc('get_party_timeline', { p_token: party.share_token })
      .then(({ data }) => live && setList(Array.isArray(data) ? data : []))
      .catch(() => live && setList([]));
    return () => { live = false; };
  }, [party.share_token, party.id]);

  if (!list) return <ActivityIndicator color={C.lime} style={{ marginVertical: 24 }} />;

  let lastDay = null;
  return (
    <View style={styles.wrap}>
      {list.map((e, i) => {
        const d = new Date(e.at);
        const day = dayLabel(d);
        const head = day !== lastDay ? day : null;
        lastDay = day;
        const last = i === list.length - 1;
        return (
          <View key={`${e.kind}-${e.at}-${i}`}>
            {head ? <Text style={styles.day}>{head.toUpperCase()}</Text> : null}
            <View style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.dot, last && styles.dotNow]}><Text style={styles.emoji}>{e.emoji}</Text></View>
                {!last ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.body}>
                <Text style={styles.text}>{e.text}</Text>
                <Text style={styles.time}>{time(d)}</Text>
              </View>
            </View>
          </View>
        );
      })}
      {list.length <= 1 ? (
        <Text style={styles.hint}>Votes, bookings, bills, payments and photos show up here as the night goes on.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4 },
  day: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row' },
  rail: { width: 40, alignItems: 'center' },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  dotNow: { borderColor: C.lime, borderWidth: 2 },
  emoji: { fontSize: 16 },
  line: { flex: 1, width: 2, backgroundColor: C.border, minHeight: 14 },
  body: { flex: 1, paddingLeft: 10, paddingBottom: 14, paddingTop: 6 },
  text: { color: C.text, fontSize: 15, fontWeight: '700' },
  time: { color: C.faint, fontSize: 13, marginTop: 2 },
  hint: { color: C.faint, fontSize: 13, marginTop: 10 },
});
