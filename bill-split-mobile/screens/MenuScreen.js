import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NightSky from '../components/NightSky';
import { C, F } from '../services/theme';

// 🗂️ Everything in VibeOut on one page, as big tiles, so nobody gets lost (Gautham's "menu / index" idea)
export default function MenuScreen({ go, onBack }) {
  const SECTIONS = [
    {
      title: 'PLAN THE NIGHT',
      items: [
        { key: 'plan', emoji: '🎉', name: 'Plan a night', sub: 'Pick a vibe, invite friends', color: C.lime },
        { key: 'rooms', emoji: '💬', name: 'My rooms', sub: 'Vote, chat, split', color: C.violet },
        { key: 'nearby', emoji: '🧭', name: 'Nearby', sub: 'Cafés, restaurants, bars', color: C.cyan },
        { key: 'groups', emoji: '👥', name: 'Groups', sub: 'Your regular squads', color: '#FFB3D9' },
      ],
    },
    {
      title: 'SPLIT & MONEY',
      items: [
        { key: 'scan', emoji: '📷', name: 'Snap a bill', sub: 'Split it to the rupee', color: C.pink },
        { key: 'money', emoji: '👛', name: 'My money', sub: 'Budget and spends', color: '#FFD84D' },
        { key: 'spend', emoji: '💸', name: 'Add a spend', sub: 'Cab, snacks, entry', color: '#7CFFB2' },
      ],
    },
    {
      title: 'DURING THE NIGHT',
      items: [
        { key: 'rooms', emoji: '🌙', name: 'Night Mode', sub: 'Open a room, tap Start', color: C.violet },
        { key: 'rooms', emoji: '🎮', name: 'Party games', sub: 'Inside any room', color: '#FF8A3D' },
        { key: 'memories', emoji: '📸', name: 'Memories', sub: 'Every night as a story', color: C.lime },
      ],
    },
    {
      title: 'PEOPLE & YOU',
      items: [
        { key: 'friends', emoji: '🫶', name: 'Friends', sub: "Who's out tonight", color: C.cyan },
        { key: 'notifications', emoji: '🔔', name: 'Notifications', sub: 'Invites, reminders', color: '#FFB3D9' },
        { key: 'profile', emoji: '👤', name: 'Profile', sub: 'Name, UPI, settings', color: '#FFD84D' },
        { key: 'yourData', emoji: '🔒', name: 'Your data', sub: 'Privacy, download, delete', color: C.pink },
        { key: 'help', emoji: '💡', name: 'Help & chat', sub: 'Ask us anything', color: '#7CFFB2' },
        { key: 'tour', emoji: '🧭', name: 'Take the tour', sub: '20-second walkthrough', color: C.lime },
      ],
    },
  ];

  return (
    <View style={styles.page}>
      <NightSky height={240} />
      <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.kicker}>● EVERYTHING IN VIBEOUT</Text>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.lead}>Tap anything to jump straight there.</Text>
        {SECTIONS.map((sec) => (
          <View key={sec.title}>
            <Text style={styles.section}>{sec.title}</Text>
            <View style={styles.grid}>
              {sec.items.map((it) => (
                <TouchableOpacity key={it.name} style={[styles.tile, { backgroundColor: it.color }]} onPress={() => go(it.key)} activeOpacity={0.85}>
                  <Text style={styles.emoji}>{it.emoji}</Text>
                  <Text style={styles.name}>{it.name}</Text>
                  <Text style={styles.sub}>{it.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pad: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  back: { color: C.lime, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  title: { fontFamily: F.display, color: C.text, fontSize: 36, marginTop: 4 },
  lead: { color: C.sub, fontSize: 14, marginTop: 2, marginBottom: 6 },
  section: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 18, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', borderRadius: 20, padding: 14, marginBottom: 10, minHeight: 112, borderRightWidth: 3, borderBottomWidth: 4, borderRightColor: '#F7F7F9', borderBottomColor: '#F7F7F9' },
  emoji: { fontSize: 28 },
  name: { fontFamily: F.display, color: C.onLime, fontSize: 15, marginTop: 8 },
  sub: { color: C.onLime, opacity: 0.75, fontSize: 12, fontWeight: '600', marginTop: 2 },
});
