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

  const tag = (f) => {
    if (atParty[f.user_id]) return { t: '🎉 ' + atParty[f.user_id].label.replace(/^At /, ''), c: C.pink };
    const b = bdays.find((x) => x.user_id === f.user_id && x.days_until <= 7);
    if (b) return { t: '🎂 ' + whenText(b.days_until), c: C.pink };
    if (f.st && f.st.now) return { t: 'Vibing', c: C.lime };
    if (f.st) return { t: f.st.text.replace('Active ', ''), c: C.faint };
    return { t: 'Offline', c: C.faint };
  };

  // 📡 Home (Final UX): "Inner circle radar". Faces with live status underneath, and an Invite slot.
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onOpen}>
      <View style={styles.top}>
        <Text style={styles.kicker}>◎  INNER CIRCLE RADAR</Text>
        {active.length ? (
          <View style={styles.activePill}>
            <Text style={styles.activeText}>{active.length} Active</Text>
          </View>
        ) : friends.length ? (
          <Text style={styles.count}>{friends.length} friends</Text>
        ) : null}
      </View>
      {bdayLine ? <Text style={styles.bday} numberOfLines={1}>{bdayLine}</Text> : null}
      <View style={styles.row}>
        {faces.map((f) => {
          const tg = tag(f);
          return (
            <View key={f.user_id} style={styles.person}>
              <Pulse name={f.name} uri={avatarUrl(f.avatar_path)} on={f.st && f.st.now} size={50} />
              <Text style={styles.name} numberOfLines={1}>{f.name.split(' ')[0]}</Text>
              <Text style={[styles.tag, { color: tg.c }]} numberOfLines={1}>{tg.t}</Text>
            </View>
          );
        })}
        <TouchableOpacity style={styles.person} onPress={onAdd} hitSlop={6}>
          <View style={styles.invite}>
            <Text style={styles.plus}>＋</Text>
            {requests ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requests}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.name}>{requests ? 'Requests' : 'Invite'}</Text>
          <Text style={[styles.tag, { color: C.faint }]}>{friends.length ? '+ Link' : 'Add friends'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 22, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: C.text, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  activePill: { backgroundColor: C.lime + '22', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  activeText: { color: C.lime, fontSize: 11, fontWeight: '900' },
  count: { color: C.faint, fontSize: 12, fontWeight: '700' },
  bday: { color: C.pink, fontSize: 13, fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', marginTop: 12 },
  person: { width: '20%', alignItems: 'center' },
  name: { color: C.text, fontSize: 12, fontWeight: '700', marginTop: 6, maxWidth: 64 },
  tag: { fontSize: 10, fontWeight: '700', marginTop: 1, maxWidth: 64 },
  invite: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  plus: { color: C.sub, fontSize: 22 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.bg },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
