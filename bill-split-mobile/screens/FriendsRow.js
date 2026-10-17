import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from './FriendsScreen';
import { activeLabel } from '../services/active';
import { myFriends } from '../services/friends';
import { C } from '../services/theme';

// Home screen: friends in a row, active ones first with a green dot (like Instagram)
export default function FriendsRow({ onOpen }) {
  const [list, setList] = useState([]);

  useEffect(() => {
    const load = () => myFriends().then((l) => setList(l || [])).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const requests = list.filter((f) => f.status === 'pending' && f.incoming).length;
  const friends = list
    .filter((f) => f.status === 'accepted')
    .map((f) => ({ ...f, st: activeLabel(f.last_seen) }))
    .sort((a, b) => (b.st && b.st.now ? 1 : 0) - (a.st && a.st.now ? 1 : 0));
  const activeCount = friends.filter((f) => f.st && f.st.now).length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {activeCount ? `🟢 ${activeCount} friend${activeCount === 1 ? '' : 's'} active now` : 'Friends'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity style={styles.item} onPress={onOpen}>
          <View style={styles.add}>
            <Text style={styles.plus}>＋</Text>
            {requests ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requests}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.name}>{requests ? 'Requests' : 'Add'}</Text>
        </TouchableOpacity>
        {friends.map((f) => (
          <TouchableOpacity key={f.user_id} style={styles.item} onPress={onOpen}>
            <View style={[styles.ring, f.st && f.st.now && styles.ringOn]}>
              <Avatar name={f.name} on={f.st && f.st.now} size={50} />
            </View>
            <Text style={styles.name} numberOfLines={1}>{f.name.split(' ')[0]}</Text>
            <Text style={[styles.when, f.st && f.st.now && styles.whenOn]}>
              {f.st ? (f.st.now ? 'now' : f.st.text.replace('Active ', '')) : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { color: C.faint, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  item: { alignItems: 'center', marginRight: 14, width: 60 },
  add: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  plus: { color: C.text, fontSize: 22 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ring: { padding: 2, borderRadius: 30, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: C.green },
  name: { color: C.text, fontSize: 12, marginTop: 5, maxWidth: 60 },
  when: { color: C.faint, fontSize: 10, marginTop: 1 },
  whenOn: { color: C.green, fontWeight: '600' },
});
