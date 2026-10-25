import { LinearGradient } from '../components/SafeGradient';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { billsForParty } from '../services/bills';
import { saveNight } from '../services/safety';
import { crewLocations, distText, km, sharingFor, startLive, stopLive } from '../services/liveLocation';
import { supabase } from '../services/supabaseClient';
import { kindOf } from '../services/partyKinds';
import { BADGES, LIVE, badgeOf, liveOf, setBadge, setLiveStatus } from '../services/parties';
import { show } from '../services/names';
import { C, F, G } from '../services/theme';
import NightCheck from './NightCheck';
import PartyGames from './PartyGames';
import PartyPhotos from './PartyPhotos';
import NightRecap from './NightRecap';
import QuickAdd from './QuickAdd';

// 🌙 Night Mode: everything you need DURING the night on one dark, simple screen.
// Crew status · chat · photos · games · split the bill · ride home · share location · I'm home safe
const HUES = ['#9B5CFF', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA'];
const hue = (name) => HUES[((name || '?').charCodeAt(0) || 0) % HUES.length];
const clock = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function NightMode({ party, visible, onClose, onChat, onSplit, onChanged }) {
  const [now, setNow] = useState(clock());
  const [games, setGames] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [badgeFor, setBadgeFor] = useState(null); // 😎 giving someone a fun badge
  const [billSoFar, setBillSoFar] = useState(null); // 🧾 { total, mine, count } for bills split in this plan
  const [stopEdit, setStopEdit] = useState(false); // ➕ adding a stop
  const [stopName, setStopName] = useState('');
  const [stopTime, setStopTime] = useState('');
  const [homeSheet, setHomeSheet] = useState(false); // 🏠 Get me home safe
  const [recapOpen, setRecapOpen] = useState(false); // 🎬 story of the night
  const [spendOpen, setSpendOpen] = useState(false); // 💸 quick add a spend
  useEffect(() => {
    if (!visible || !party) return;
    billsForParty(party.id)
      .then((list) => {
        let total = 0;
        let mine = 0;
        list.forEach((b) => {
          total += Number(b.total) || 0;
          const me = (b.bill_participants || []).find((p) => p.name === 'Me');
          mine += me ? Number(me.amount_due) || 0 : 0;
        });
        setBillSoFar({ total: Math.round(total), mine: Math.round(mine), count: list.length });
      })
      .catch(() => setBillSoFar(null));
  }, [visible, party && party.id]);

  // 🗺️ Tonight's stops (timeline). First stop = the plan's place until you add more.
  const stops = party && Array.isArray(party.stops) && party.stops.length
    ? party.stops
    : party && party.place ? [{ name: party.place.split(',')[0].replace(/^My place 🏠 · .*/, 'My place 🏠'), time: '' }] : [];
  const saveStops = async (list) => {
    try {
      const { error } = await supabase.from('parties').update({ stops: list }).eq('id', party.id);
      if (error) throw error;
      onChanged && onChanged();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };
  const toggleStop = (i) => saveStops(stops.map((st, k) => (k === i ? { ...st, done: !st.done } : st)));
  const removeStop = (i) =>
    Alert.alert('Remove this stop?', stops[i].name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveStops(stops.filter((_, k) => k !== i)) },
    ]);
  const addStop = () => {
    const name = stopName.trim();
    if (!name) return;
    saveStops([...stops, { name: name.slice(0, 60), time: stopTime.trim().slice(0, 12) }]);
    setStopName('');
    setStopTime('');
    setStopEdit(false);
  };
  // 📍 Live location (like WhatsApp): crew positions refresh every 15s while Night Mode is open
  const [locs, setLocs] = useState([]);
  const [liveBusy, setLiveBusy] = useState(false);
  const [, setTickLive] = useState(0);
  useEffect(() => {
    if (!visible || !party || !party.share_token) return;
    const load = () => crewLocations(party).then(setLocs).catch(() => {});
    load();
    const t = setInterval(() => {
      load();
      setTickLive((x) => x + 1);
    }, 15000);
    return () => clearInterval(t);
  }, [visible, party && party.id]);
  const goLive = async (minutes) => {
    const me = (party.party_members || []).find((m) => m.name === 'Me');
    if (!me) return;
    setLiveBusy(true);
    try {
      await startLive(party, me.id, minutes);
      setLocs(await crewLocations(party));
    } catch (e) {
      Alert.alert("Couldn't share location", e.message);
    } finally {
      setLiveBusy(false);
    }
  };
  const endLive = async () => {
    const me = (party.party_members || []).find((m) => m.name === 'Me');
    try {
      await stopLive(party, me.id);
      setLocs(await crewLocations(party));
    } catch (e) {}
  };
  const ago = (t) => {
    const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
    return m < 1 ? 'just now' : `${m} min ago`;
  };

  // 👥 My live status: on my way → here → home
  const meMember = party && (party.party_members || []).find((m) => m.name === 'Me');
  const myLive = meMember ? liveOf(meMember) : null;
  const setMine = async (st) => {
    if (!meMember) return;
    if (st === 'home') return imHome();
    try {
      await setLiveStatus(party, meMember.id, st);
      onChanged && onChanged();
    } catch (e) {
      Alert.alert("Couldn't update", e.message);
    }
  };
  const imHome = async () => {
    setHomeSheet(false);
    try {
      const me = (party.party_members || []).find((m) => m.name === 'Me');
      await saveNight(party, me, { home_safe: true });
      onChanged && onChanged();
      Alert.alert('Home safe 🏠', 'Your crew can see you made it. Sleep well 😴');
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };
  const giveBadge = async (b) => {
    const m = badgeFor;
    setBadgeFor(null);
    try {
      await setBadge(m.id, b);
      onChanged && onChanged();
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    }
  };

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

          {/* 👥 Where am I? one tap so the crew knows */}
          {meMember ? (
            <View style={styles.statusRow}>
              {['omw', 'here', 'home'].map((st) => (
                <TouchableOpacity key={st} style={[styles.statusBtn, myLive === st && { backgroundColor: LIVE[st].color + '33', borderColor: LIVE[st].color }]} onPress={() => setMine(st)} activeOpacity={0.8}>
                  <Text style={styles.statusEmoji}>{LIVE[st].emoji}</Text>
                  <Text style={[styles.statusText, myLive === st && { color: LIVE[st].color }]}>{st === 'here' ? "I'm here" : st === 'omw' ? 'On my way' : 'Home safe'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* 📍 Live location */}
          {(() => {
            const me = (party.party_members || []).find((m) => m.name === 'Me');
            const mine = me && locs.find((l) => l.member_id === me.id);
            const local = sharingFor(party.id);
            const others = locs.filter((l) => !me || l.member_id !== me.id);
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>📍 Live location</Text>
                  {mine ? <Text style={[styles.cardSub, { color: C.green }]}>● Sharing</Text> : null}
                </View>
                {mine ? (
                  <View style={styles.liveMine}>
                    <Text style={styles.liveMineText}>
                      You're sharing until {new Date(mine.until).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      {!local ? ' (open the app to keep it updating)' : ''}
                    </Text>
                    <TouchableOpacity onPress={endLive} hitSlop={8}>
                      <Text style={styles.liveStop}>Stop</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.liveBtns}>
                    {[[15, '15 min'], [60, '1 hour'], [480, '8 hours']].map(([m, label]) => (
                      <TouchableOpacity key={m} style={styles.liveBtn} onPress={() => goLive(m)} disabled={liveBusy} activeOpacity={0.8}>
                        <Text style={styles.liveBtnText}>{liveBusy ? '…' : `Share ${label}`}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {others.length ? (
                  others.map((l) => (
                    <TouchableOpacity key={l.member_id} style={styles.liveRow} onPress={() => Linking.openURL(`https://maps.google.com/?q=${l.lat},${l.lng}`)} activeOpacity={0.7}>
                      <View style={[styles.liveFace, { backgroundColor: hue(l.name) }]}>
                        <Text style={styles.liveFaceText}>{show(l.name).charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.liveName}>{show(l.name)}</Text>
                        <Text style={styles.liveMeta}>
                          {mine ? distText(km({ lat: mine.lat, lng: mine.lng }, l)) + ' · ' : ''}updated {ago(l.updated_at)}
                        </Text>
                      </View>
                      <Text style={styles.liveMap}>Map ›</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.empty}>Nobody else is sharing yet. Share yours and the crew can follow you home 🏠</Text>
                )}
                <Text style={styles.livePrivacy}>🔒 Only this plan's crew sees it, only for the time you pick, and it's deleted when sharing ends.</Text>
              </View>
            );
          })()}

          {/* 🗺️ Tonight's stops */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Tonight's stops <Text style={styles.cardHint}>· tap when done</Text></Text>
              <TouchableOpacity onPress={() => setStopEdit(true)} hitSlop={8}>
                <Text style={styles.addStop}>＋ Add stop</Text>
              </TouchableOpacity>
            </View>
            {stops.length ? (
              stops.map((st, i) => {
                const current = !st.done && stops.slice(0, i).every((x) => x.done);
                return (
                  <TouchableOpacity key={i} style={styles.stop} onPress={() => toggleStop(i)} onLongPress={() => removeStop(i)} activeOpacity={0.7}>
                    <View style={styles.rail}>
                      <View style={[styles.dot, st.done && styles.dotDone, current && styles.dotNow]}>
                        {st.done ? <Text style={styles.dotTick}>✓</Text> : null}
                      </View>
                      {i < stops.length - 1 ? <View style={[styles.line, st.done && styles.lineDone]} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: i < stops.length - 1 ? 14 : 0 }}>
                      <Text style={[styles.stopName, st.done && styles.stopDone]} numberOfLines={1}>{st.name}</Text>
                      <Text style={[styles.stopMeta, current && { color: C.green }]}>
                        {current ? '● Now' : st.done ? 'Done' : 'Next'}{st.time ? ` · ${st.time}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.empty}>Add where you're going tonight: pre-drinks, dinner, the club, after-party…</Text>
            )}
          </View>

          {/* 👥 The crew tonight */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>The crew <Text style={styles.cardHint}>· tap to give a badge 😎</Text></Text>
              <Text style={styles.cardSub}>
                {(() => {
                  const c = { omw: 0, here: 0, home: 0 };
                  crew.forEach((m) => { const l = liveOf(m); if (l) c[l]++; });
                  const parts = [c.here && `📍 ${c.here} here`, c.omw && `🚶 ${c.omw} on the way`, c.home && `🏠 ${c.home} home`].filter(Boolean);
                  return parts.length ? parts.join(' · ') : `${crew.length} out tonight`;
                })()}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {crew.map((m) => (
                <TouchableOpacity key={m.id || m.name} style={styles.person} onPress={() => m.id && setBadgeFor(m)} activeOpacity={0.7}>
                  <View style={[styles.face, { backgroundColor: hue(m.name), borderWidth: 3, borderColor: liveOf(m) ? LIVE[liveOf(m)].color : 'transparent' }, m.home_at && styles.faceHome]}>
                    <Text style={styles.faceText}>{show(m.name).charAt(0).toUpperCase()}</Text>
                    <Text style={styles.badge}>{liveOf(m) ? LIVE[liveOf(m)].emoji : m.is_driver ? '🚗' : '🎉'}</Text>
                  </View>
                  <Text style={styles.personName} numberOfLines={1}>{show(m.name)}</Text>
                  {badgeOf(m, crew, party) ? <Text style={styles.personBadge} numberOfLines={2}>{badgeOf(m, crew, party)}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 🔲 Quick actions */}
          <View style={styles.grid}>
            <Tile emoji="💬" title="Chat" sub="Group chat" onPress={() => { onClose(); onChat && onChat(); }} />
            <Tile
              emoji="🧾"
              title={billSoFar && billSoFar.count ? `₹${billSoFar.total.toLocaleString('en-IN')} so far` : 'Split the bill'}
              sub={billSoFar && billSoFar.count ? `Your share ₹${billSoFar.mine.toLocaleString('en-IN')} · add a round` : 'Scan the receipt'}
              tint={C.accent}
              onPress={() => { onClose(); onSplit && onSplit(crew.map((m) => m.name), party.id); }}
            />
            <Tile emoji="🎮" title="Games" sub="Wheel · dares" onPress={() => setGames(true)} />
            <Tile emoji="🎬" title="Night recap" sub="The story of tonight" tint="#A855F7" onPress={() => setRecapOpen(true)} />
            <Tile emoji="💸" title="Add a spend" sub="Cab · snacks · entry" onPress={() => setSpendOpen(true)} />
            <Tile emoji="🚕" title="Ride home" sub="Uber · Ola · Rapido" tint={C.amber} onPress={ride} />
            <Tile emoji="📍" title={sharing ? 'Finding you…' : 'Share location'} sub="Send where you are" tint={C.green} onPress={shareLocation} />
            <Tile emoji="🆘" title="Emergency" sub="Call 112" tint={C.red} onPress={() => Alert.alert('Call 112?', 'India emergency number', [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', style: 'destructive', onPress: () => Linking.openURL('tel:112') }])} />
          </View>

          {/* 🏠 The big one: always one tap away */}
          <TouchableOpacity style={styles.homeBtn} onPress={() => setHomeSheet(true)} activeOpacity={0.85}>
            <LinearGradient colors={G.sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.homeText}>🏠 Get me home safe</Text>
            <Text style={styles.homeSub}>Ride · share location · I'm home</Text>
          </TouchableOpacity>

          {/* 🏠 Home safe check-in (and safe-night streak) */}
          <NightCheck party={party} onChanged={onChanged} />

          {/* 📸 Photos of the night */}
          <PartyPhotos party={party} />
        </ScrollView>
      </View>
      <PartyGames visible={games} onClose={() => setGames(false)} party={party} />
      <QuickAdd visible={spendOpen} onClose={() => setSpendOpen(false)} partyId={party.id} />
      <NightRecap visible={recapOpen} onClose={() => setRecapOpen(false)} party={party} photos={[]} />

      {/* ➕ Add a stop */}
      <Modal visible={stopEdit} transparent animationType="fade" onRequestClose={() => setStopEdit(false)}>
        <Pressable style={styles.overlay} onPress={() => setStopEdit(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>➕ Add a stop</Text>
            <TextInput style={styles.input} value={stopName} onChangeText={setStopName} placeholder="Where? e.g. Rooftop bar, Biryani place" placeholderTextColor={C.faint} keyboardAppearance="dark" autoFocus />
            <TextInput style={styles.input} value={stopTime} onChangeText={setStopTime} placeholder="When? e.g. 10:30 PM (optional)" placeholderTextColor={C.faint} keyboardAppearance="dark" />
            <TouchableOpacity style={styles.saveBtn} onPress={addStop}>
              <Text style={styles.saveText}>Add to tonight</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 🏠 Get me home safe */}
      <Modal visible={homeSheet} transparent animationType="fade" onRequestClose={() => setHomeSheet(false)}>
        <Pressable style={styles.overlay} onPress={() => setHomeSheet(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>🏠 Get me home safe</Text>
            <TouchableOpacity style={styles.option} onPress={() => { setHomeSheet(false); ride(); }}>
              <Text style={styles.optionText}>🚕 Book a ride home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => { setHomeSheet(false); shareLocation(); }}>
              <Text style={styles.optionText}>📍 Send my live location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.option, { borderColor: C.green }]} onPress={imHome}>
              <Text style={[styles.optionText, { color: C.green }]}>✅ I'm home safe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.option, { borderColor: C.red }]} onPress={() => { setHomeSheet(false); Linking.openURL('tel:112'); }}>
              <Text style={[styles.optionText, { color: C.red }]}>🆘 Call 112</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 😎 Pick a fun badge */}
      <Modal visible={!!badgeFor} transparent animationType="fade" onRequestClose={() => setBadgeFor(null)}>
        <Pressable style={styles.overlay} onPress={() => setBadgeFor(null)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Badge for {badgeFor ? show(badgeFor.name) : ''} 😎</Text>
            <View style={styles.badges}>
              {BADGES.map((b) => (
                <TouchableOpacity key={b} style={[styles.badgeChip, badgeFor && badgeFor.badge === b && styles.badgeOn]} onPress={() => giveBadge(b)}>
                  <Text style={styles.badgeText}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {badgeFor && badgeFor.badge ? (
              <TouchableOpacity onPress={() => giveBadge(null)}>
                <Text style={styles.clear}>Remove badge</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  liveBtns: { flexDirection: 'row', marginBottom: 6 },
  liveBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginHorizontal: 3 },
  liveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  liveMine: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green + '1F', borderRadius: 14, padding: 10, marginBottom: 6 },
  liveMineText: { color: C.text, fontSize: 13, fontWeight: '600', flex: 1 },
  liveStop: { color: C.red, fontSize: 14, fontWeight: '800', marginLeft: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border },
  liveFace: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  liveFaceText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  liveName: { color: C.text, fontSize: 15, fontWeight: '700' },
  liveMeta: { color: C.faint, fontSize: 12, marginTop: 2 },
  liveMap: { color: C.accentSoft, fontSize: 13, fontWeight: '700' },
  livePrivacy: { color: C.faint, fontSize: 11, marginTop: 8 },
  statusRow: { flexDirection: 'row', marginTop: 16 },
  statusBtn: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 10, marginHorizontal: 3 },
  statusEmoji: { fontSize: 20 },
  statusText: { color: C.sub, fontSize: 12, fontWeight: '700', marginTop: 3 },
  addStop: { color: C.accentSoft, fontSize: 14, fontWeight: '700' },
  stop: { flexDirection: 'row' },
  rail: { width: 26, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dotDone: { backgroundColor: C.green, borderColor: C.green },
  dotNow: { borderColor: C.green, backgroundColor: C.green + '33' },
  dotTick: { color: '#06281C', fontSize: 10, fontWeight: '900' },
  line: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 2 },
  lineDone: { backgroundColor: C.green },
  stopName: { color: C.text, fontSize: 16, fontWeight: '700' },
  stopDone: { color: C.faint, textDecorationLine: 'line-through' },
  stopMeta: { color: C.faint, fontSize: 12, marginTop: 2 },
  empty: { color: C.faint, fontSize: 13, lineHeight: 19 },
  homeBtn: { backgroundColor: '#F97316', borderRadius: 22, paddingVertical: 18, alignItems: 'center', marginTop: 4, marginBottom: 12, overflow: 'hidden' },
  homeText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  homeSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3, fontWeight: '600' },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, color: C.text, fontSize: 16, marginBottom: 10 },
  saveBtn: { backgroundColor: C.accent, borderRadius: 18, padding: 15, alignItems: 'center', marginTop: 4 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  option: { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 15, marginBottom: 10 },
  optionText: { color: C.text, fontSize: 16, fontWeight: '700' },
  page: { flex: 1, backgroundColor: '#07070A', paddingTop: 56 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  close: { color: C.sub, fontSize: 16, fontWeight: '600' },
  live: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 6 },
  liveText: { color: C.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  pad: { paddingHorizontal: 20, paddingBottom: 50 },
  kicker: { color: C.accentSoft, fontSize: 14, fontWeight: '700', marginTop: 6 },
  title: { fontFamily: F.display, color: C.text, fontSize: 29, marginTop: 4 },
  place: { color: C.sub, fontSize: 14, marginTop: 6 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginTop: 18 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: C.green, fontSize: 13, fontWeight: '600' },
  person: { alignItems: 'center', width: 72, marginRight: 4 },
  personBadge: { color: C.accentSoft, fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  cardHint: { color: C.faint, fontSize: 12, fontWeight: '500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontFamily: F.bold, color: C.text, fontSize: 19, marginBottom: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  badgeChip: { backgroundColor: C.cardHi, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  badgeOn: { backgroundColor: C.accent },
  badgeText: { color: C.text, fontSize: 14, fontWeight: '600' },
  clear: { color: C.red, fontSize: 14, textAlign: 'center', marginTop: 10 },
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
