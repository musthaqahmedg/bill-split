import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { show } from '../services/names';
import { badgeOf, listParties, liveOf, partyLink, setLiveStatus } from '../services/parties';
import { C, F, STICK } from '../services/theme';
import { countdown, planBucket, sortPlans } from '../services/when';

// 👥 Squad tab (new UX): who's pulling up tonight and what they're up to, live.
// Shows tonight's room (or the next one), each friend's status, and your own quick status buttons.
const HUES = [C.lime, C.pink, C.violet, C.cyan, '#FFD84D', '#7CFFB2', '#FF8A3D', '#FFB3D9'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];

function statusOf(m) {
  const live = liveOf(m);
  if (live === 'home') return '🏠 home safe';
  if (live === 'here') return '📍 here!';
  if (live === 'omw') return '🚶 on my way';
  if (m.is_driver) return '🚗 sober driver tonight';
  if (m.rsvp === 'in') return '🙌 coming';
  if (m.rsvp === 'maybe') return '🤔 maybe';
  if (m.rsvp === 'out') return "😢 can't make it";
  return '⏳ hasn’t replied yet';
}

const MY = [
  ['omw', '🚶 On my way'],
  ['here', '📍 Here'],
  ['home', '🏠 Home safe'],
];

export default function SquadScreen({ onOpen, onRooms, onMemories, onPlan }) {
  const [plans, setPlans] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = () => listParties().then(setPlans).catch(() => setPlans([]));
  useEffect(() => {
    load();
  }, []);

  if (!plans) {
    return (
      <View style={[styles.page, { justifyContent: 'center' }]}>
        <ActivityIndicator color={C.lime} />
      </View>
    );
  }
  const live = sortPlans(plans.filter((p) => planBucket(p) === 'live'), 'upcoming');
  const next = sortPlans(plans.filter((p) => planBucket(p) === 'upcoming'), 'upcoming');
  const room = live[0] || next[0];
  const members = room ? room.party_members || [] : [];
  const me = members.find((m) => m.name === 'Me');

  const setMine = async (status) => {
    try {
      await setLiveStatus(room, me.id, status);
      load();
    } catch (e) {
      Alert.alert("Couldn't update", e.message);
    }
  };
  const invite = () => Share.share({ message: `Pull up 🤟 ${room.title}${room.place ? ` at ${room.place}` : ''}. Join here: ${partyLink(room)}` }).catch(() => {});

  return (
    <View style={styles.page}>
      <NightSky height={240} />
      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.lime} />}
      >
        <Text style={styles.title}>SQUAD</Text>
        <Text style={styles.kicker}>{room ? (live[0] ? 'LIVE STATUS FOR TONIGHT.' : `NEXT UP · ${countdown(room).toUpperCase()}`) : 'YOUR CREW, LIVE ON THE NIGHT.'}</Text>

        {room ? (
          <>
            <TouchableOpacity style={styles.room} onPress={() => onOpen(room.id)} activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomTitle} numberOfLines={1}>{room.title}</Text>
                <Text style={styles.roomMeta} numberOfLines={1}>{[room.place, countdown(room)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={styles.roomGo}>OPEN ›</Text>
            </TouchableOpacity>

            {members.map((m) => {
              const badge = badgeOf(m, members, room);
              return (
                <View key={m.id} style={styles.member}>
                  <View style={[styles.face, { backgroundColor: hue(m.name) }]}>
                    <Text style={styles.faceText}>{show(m.name).slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {show(m.name)}
                      {badge ? <Text style={styles.badge}>  {badge}</Text> : null}
                    </Text>
                    <Text style={styles.status}>{statusOf(m)}</Text>
                  </View>
                </View>
              );
            })}

            {me ? (
              <>
                <Text style={styles.section}>YOUR STATUS</Text>
                <View style={styles.myRow}>
                  {MY.map(([k, label]) => {
                    const on = liveOf(me) === k;
                    return (
                      <TouchableOpacity key={k} style={[styles.myBtn, on && styles.myOn]} onPress={() => setMine(k)} activeOpacity={0.85}>
                        <Text style={[styles.myText, on && { color: C.onLime }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <TouchableOpacity style={styles.invite} onPress={invite} activeOpacity={0.85}>
              <Text style={styles.inviteTitle}>💌 Invite more friends</Text>
              <Text style={styles.inviteSub}>Share the room link on WhatsApp</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>No squad out yet</Text>
            <Text style={styles.emptySub}>Start a room, add your people, and you'll see everyone's status here on the night.</Text>
            <TouchableOpacity style={styles.start} onPress={onPlan} activeOpacity={0.85}>
              <Text style={styles.startText}>START A ROOM →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.links}>
          <TouchableOpacity style={[styles.link, { backgroundColor: C.lime }]} onPress={onRooms} activeOpacity={0.85}>
            <Text style={styles.linkText}>ROOMS →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.link, { backgroundColor: C.pink }]} onPress={onMemories} activeOpacity={0.85}>
            <Text style={styles.linkText}>MEMORIES →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontFamily: F.display, color: C.text, fontSize: 40 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11, marginTop: 4, marginBottom: 16 },
  room: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.violet, borderRadius: 20, padding: 16, marginBottom: 14, ...STICK },
  roomTitle: { fontFamily: F.display, color: C.onLime, fontSize: 18 },
  roomMeta: { color: C.onLime, fontSize: 13, fontWeight: '700', marginTop: 2, opacity: 0.8 },
  roomGo: { fontFamily: F.pixel, color: C.onLime, fontSize: 11, marginLeft: 8 },
  member: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  face: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  faceText: { fontFamily: F.bold, color: C.onLime, fontSize: 14 },
  name: { color: C.text, fontSize: 16, fontWeight: '800' },
  badge: { color: C.sub, fontSize: 12, fontWeight: '600' },
  status: { color: C.text, fontSize: 14, marginTop: 3, opacity: 0.85 },
  section: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 14, marginBottom: 8 },
  myRow: { flexDirection: 'row', justifyContent: 'space-between' },
  myBtn: { flex: 1, borderWidth: 2, borderColor: C.lime, borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginHorizontal: 3 },
  myOn: { backgroundColor: C.lime },
  myText: { color: C.lime, fontSize: 12, fontWeight: '900' },
  invite: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed' },
  inviteTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  inviteSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  empty: { backgroundColor: C.card, borderRadius: 24, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontFamily: F.display, color: C.text, fontSize: 20, marginTop: 8 },
  emptySub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 4 },
  start: { backgroundColor: C.lime, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', marginTop: 16, ...STICK },
  startText: { color: C.onLime, fontSize: 15, fontWeight: '900' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  link: { width: '48.5%', borderRadius: 18, paddingVertical: 16, alignItems: 'center', ...STICK },
  linkText: { fontFamily: F.display, color: C.onLime, fontSize: 15 },
});
