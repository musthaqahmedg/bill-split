import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { kindOf } from '../services/partyKinds';
import { show } from '../services/names';
import { C } from '../services/theme';
import NightCheck from './NightCheck';
import PartyGames from './PartyGames';
import PartyPhotos from './PartyPhotos';

// 🌙 Night Mode: everything you need DURING the night on one dark, simple screen.
// Crew status · chat · photos · games · split the bill · ride home · share location · I'm home safe
const HUES = ['#7C5CFF', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];
const clock = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function NightMode({ party, visible, onClose, onChat, onSplit, onChanged }) {
  const [now, setNow] = useState(clock());
  const [games, setGames] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setNow(clock());
    const t = setInterval(() => setNow(clock()), 30000);
    return () => clearInterval(t);
  }, [visible]);

  if (!party) return null;
  const crew = (party.party_members || []).filter((m) => m.rsvp !== 'out');
  const home = crew.filter((m) => m.home_at).length;

  const shareLocation = async () => {
    setSharing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Location off', 'Allow location to share where you are.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;
      await Share.share({ message: `📍 I'm here right now: https://maps.google.com/?q=${lat},${lng}` });
    } catch (e) {
      Alert.alert("Couldn't get your location", e.message);
    } finally {
      setSharing(false);
    }
  };

  const ride = () =>
    Alert.alert('🚕 Get a ride home', 'Pick an app', [
      { text: 'Uber', onPress: () => Linking.openURL('https://m.uber.com/ul/?action=setPickup&pickup=my_location') },
      { text: 'Ola', onPress: () => Linking.openURL('https://book.olacabs.com/') },
      { text: 'Rapido', onPress: () => Linking.openURL('https://www.rapido.bike/') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const Tile = ({ emoji, title, sub, onPress, tint }) => (
    <TouchableOpacity style={[styles.tile, tint && { backgroundColor: tint + '1F', borderColor: tint + '55' }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={styles.tileTitle}>{title}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.top}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>✕ Exit</Text>
          </TouchableOpacity>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · {now}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>🌙 Night Mode</Text>
          <Text style={styles.title} numberOfLines={2}>{kindOf(party.kind).emoji} {party.title}</Text>
          {party.place ? <Text style={styles.place} numberOfLines={1}>📍 {party.place.replace(/^My place 🏠 · .*/, 'My place 🏠')}</Text> : null}

          {/* 👥 The crew tonight */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>The crew</Text>
              <Text style={styles.cardSub}>{home ? `🏠 ${home}/${crew.length} home safe` : `${crew.length} out tonight`}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {crew.map((m) => (
                <View key={m.id || m.name} style={styles.person}>
                  <View style={[styles.face, { backgroundColor: hue(m.name) }, m.home_at && styles.faceHome]}>
                    <Text style={styles.faceText}>{show(m.name).charAt(0).toUpperCase()}</Text>
                    <Text style={styles.badge}>{m.home_at ? '🏠' : m.is_driver ? '🚗' : '🎉'}</Text>
                  </View>
                  <Text style={styles.personName} numberOfLines={1}>{show(m.name)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* 🔲 Quick actions */}
          <View style={styles.grid}>
            <Tile emoji="💬" title="Chat" sub="Group chat" onPress={() => { onClose(); onChat && onChat(); }} />
            <Tile emoji="🧾" title="Split the bill" sub="Scan the receipt" tint={C.accent} onPress={() => { onClose(); onSplit && onSplit(crew.map((m) => m.name)); }} />
            <Tile emoji="🎮" title="Games" sub="Wheel · dares" onPress={() => setGames(true)} />
            <Tile emoji="🚕" title="Ride home" sub="Uber · Ola · Rapido" tint={C.amber} onPress={ride} />
            <Tile emoji="📍" title={sharing ? 'Finding you…' : 'Share location'} sub="Send where you are" tint={C.green} onPress={shareLocation} />
            <Tile emoji="🆘" title="Emergency" sub="Call 112" tint={C.red} onPress={() => Alert.alert('Call 112?', 'India emergency number', [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', style: 'destructive', onPress: () => Linking.openURL('tel:112') }])} />
          </View>

          {/* 🏠 Home safe check-in (and safe-night streak) */}
          <NightCheck party={party} onChanged={onChanged} />

          {/* 📸 Photos of the night */}
          <PartyPhotos party={party} />
        </ScrollView>
      </View>
      <PartyGames visible={games} onClose={() => setGames(false)} party={party} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#07070A', paddingTop: 56 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  close: { color: C.sub, fontSize: 16, fontWeight: '600' },
  live: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 6 },
  liveText: { color: C.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  pad: { paddingHorizontal: 20, paddingBottom: 50 },
  kicker: { color: C.accentSoft, fontSize: 14, fontWeight: '700', marginTop: 6 },
  title: { color: C.text, fontSize: 30, fontWeight: '800', marginTop: 4 },
  place: { color: C.sub, fontSize: 14, marginTop: 6 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginTop: 18 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: C.green, fontSize: 13, fontWeight: '600' },
  person: { alignItems: 'center', width: 64, marginRight: 6 },
  face: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  faceHome: { opacity: 0.55 },
  faceText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  badge: { position: 'absolute', right: -4, bottom: -4, fontSize: 15 },
  personName: { color: C.sub, fontSize: 12, marginTop: 6, maxWidth: 62 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 },
  tile: { width: '48.5%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginBottom: 10 },
  tileEmoji: { fontSize: 26 },
  tileTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  tileSub: { color: C.sub, fontSize: 12, marginTop: 2 },
});
