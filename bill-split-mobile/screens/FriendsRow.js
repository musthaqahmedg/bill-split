import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pulse from './Pulse';
import { activeLabel } from '../services/active';
import { friendsAtParties, myFriends } from '../services/friends';
import { friendsBirthdays, whenText } from '../services/birthday';
import { avatarUrl } from '../services/profile';
import { C } from '../services/theme';

// Home: "Your circle" card. Overlapping faces, who's vibing now, and ＋ to add friends.
export default function FriendsRow({ onOpen, onAdd }) {
  const [list, setList] = useState(null);
  const [atParty, setAtParty] = useState({});
  const [bdays, setBdays] = useState([]);

  useEffect(() => {
    const load = () => {
      myFriends().then((l) => setList(l || [])).catch(() => setList([]));
      friendsAtParties().then(setAtParty).catch(() => {});
      friendsBirthdays().then(setBdays).catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  if (list === null) return null;
  const requests = list.filter((f) => f.status === 'pending' && f.incoming).length;
  const friends = list.filter((f) => f.status === 'accepted').map((f) => ({ ...f, st: activeLabel(f.last_seen) }));
  const active = friends.filter((f) => f.st && f.st.now);
  const faces = [...active, ...friends.filter((f) => !(f.st && f.st.now))].slice(0, 4);

  let line;
  if (!friends.length) line = 'Add friends to see who’s vibing';
  else if (!active.length) line = `${friends.length} friend${friends.length === 1 ? '' : 's'} · nobody vibing now`;
  else line = `${active[0].name.split(' ')[0]}${active.length > 1 ? ` +${active.length - 1}` : ''} vibing now`;
  // 🎉 Someone's at a plan today? That's more fun to show.
  const partying = friends.find((f) => atParty[f.user_id]);
  if (partying) line = `🎉 ${partying.name.split(' ')[0]}: ${atParty[partying.user_id].label}`;
  // 🎂 A birthday this week beats everything (treat incoming!)
  const soon = bdays.find((b) => b.days_until <= 7);
  const bdayLine = soon ? `🎂 ${soon.name.split(' ')[0]}'s birthday · ${whenText(soon.days_until)}` : null;
  if (bdayLine) line = bdayLine;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onOpen}>
      <View style={styles.faces}>
        {faces.length ? (
          faces.map((f, i) => (
            <Pulse key={f.user_id} name={f.name} uri={avatarUrl(f.avatar_path)} on={f.st && f.st.now} size={38} style={{ marginLeft: i ? -12 : 0, zIndex: 10 - i }} />
          ))
        ) : (
          <Text style={styles.empty}>👫</Text>
        )}
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>Your circle</Text>
        <Text style={[styles.line, active.length > 0 && styles.lineOn, bdayLine && styles.lineBday]} numberOfLines={1}>
          {active.length && !bdayLine && !partying ? '🟢 ' : ''}{line}
        </Text>
      </View>
      <TouchableOpacity style={styles.add} onPress={onAdd} hitSlop={8}>
        <Text style={styles.plus}>＋</Text>
        {requests ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requests}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
  },
  faces: { flexDirection: 'row', alignItems: 'center', marginRight: 12, minWidth: 38 },
  empty: { fontSize: 26 },
  flex: { flex: 1 },
  title: { color: C.text, fontSize: 15, fontWeight: '600' },
  line: { color: C.faint, fontSize: 13, marginTop: 2 },
  lineOn: { color: C.green, fontWeight: '500' },
  lineBday: { color: C.pink, fontWeight: '600' },
  add: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  plus: { color: '#fff', fontSize: 20, marginTop: -1 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
