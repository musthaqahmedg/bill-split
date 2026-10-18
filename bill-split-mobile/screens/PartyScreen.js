import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { deleteParty, getParty, partyLink, setCoveredBy, setHideBill, setMemberPaid, waNumber } from '../services/parties';
import AboutPlace from './AboutPlace';
import ActiveTag from './ActiveTag';
import BookingCard from './BookingCard';
import { useFriendsActive } from '../services/active';
import BringList from './BringList';
import NightCheck from './NightCheck';
import PartyPhotos from './PartyPhotos';
import PartyGames from './PartyGames';
import PartyBar from './PartyBar';
import KeyboardDone from './KeyboardDone';
import PopularHere from './PopularHere';
import { show } from '../services/names';
import { getProfile } from '../services/profile';
import { kindOf } from '../services/partyKinds';
import { C } from '../services/theme';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function PartyScreen({ partyId, onBack, onDeleted, onChat, onEdit, onShop, onTakeOut }) {
  const [gamesOpen, setGamesOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  const activeOf = useFriendsActive();
  const [party, setParty] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false); // tap the place → preview card
  const [myUpi, setMyUpi] = useState('');
  const [myName, setMyName] = useState(''); // your name from Profile, shown to friends

  useEffect(() => {
    getProfile()
      .then((p) => {
        setMyUpi((p && p.upi_id) || '');
        setMyName((p && p.name) || '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getParty(partyId).then(setParty).catch((e) => Alert.alert('Error', e.message));
  }, [partyId]);

  // Pull down to see who has answered
  const reload = async () => {
    setRefreshing(true);
    try {
      setParty(await getParty(partyId));
    } catch (e) {}
    setRefreshing(false);
  };

  if (!party) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={C.accentSoft} />
      </View>
    );
  }

  const members = party.party_members || [];
  // People who actually need to pay you (not you, and not anyone with a zero share)
  const owing = members.filter((m) => m.name !== 'Me' && Number(m.share) > 0);
  const tag = (m) => {
    if (Number(m.share) > 0) return null;
    if (party.split_mode === 'free' && m.name === party.special_person) return 'Birthday, goes free 🎂';
    if (party.split_mode === 'treat') return `Treated by ${party.special_person === 'Me' ? 'you' : party.special_person} 🎁`;
    return 'Nothing to pay';
  };
  const paidCount = owing.filter((m) => m.paid_at).length;
  const toCollect = owing.filter((m) => !m.paid_at).reduce((s, m) => s + Number(m.share), 0);

  // 🤝 Who paid for whom
  const coverOf = (m) => m.covered_by && members.find((x) => x.id === m.covered_by);
  const coveredBy = (m) => members.filter((x) => x.covered_by === m.id);
  const dueOf = (m) => (m.covered_by ? 0 : Number(m.share) || 0) + coveredBy(m).reduce((a, x) => a + (Number(x.share) || 0), 0);

  const pickCover = (m) =>
    Alert.alert(`Who paid for ${m.name}? 🤝`, 'Their share moves to that friend.', [
      ...members
        .filter((x) => x.id !== m.id && !x.covered_by)
        .slice(0, 6)
        .map((x) => ({
          text: x.name === 'Me' ? 'You (on the house 🎁)' : x.name,
          onPress: async () => {
            try {
              await setCoveredBy(m.id, x.id);
              if (x.name === 'Me') await setMemberPaid(m.id, true);
              reload();
            } catch (e) {
              Alert.alert("Couldn't save", e.message);
            }
          },
        })),
      ...(m.covered_by
        ? [{ text: 'Nobody (undo)', style: 'destructive', onPress: async () => { await setCoveredBy(m.id, null).catch(() => {}); reload(); } }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);

  const togglePaid = async (m) => {
    const paid = !m.paid_at;
    const stamp = paid ? new Date().toISOString() : null;
    const ids = [m.id, ...coveredBy(m).map((x) => x.id)]; // paying for friends settles them too
    const setStamp = (value) =>
      setParty((p) => ({ ...p, party_members: p.party_members.map((x) => (ids.includes(x.id) ? { ...x, paid_at: value } : x)) }));
    setStamp(stamp);
    try {
      for (const id of ids) await setMemberPaid(id, paid);
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
      setStamp(m.paid_at);
    }
  };

  const details = [party.party_date, party.place].filter(Boolean).join(' at ');

  const remind = (m) =>
    Share.share({
      message:
        `Hey ${m.name}! 🎉 ${party.title}${details ? ` (${details})` : ''}: your share is ${inr(m.share)}.` +
        (myUpi ? ` Please pay to UPI: ${myUpi} 🙏` : ' Please send it when you can 🙏'),
    });

  // One invite for any chat or WhatsApp group: friends open the link and tap "I'm in"
  const link = partyLink(party);
  const shareAll = () =>
    Share.share({
      message:
        `🎉 You're invited: ${party.title}${details ? `\n📍 ${details}` : ''}` +
        `${myName ? `\n🙋 Hosted by ${myName}` : ''}\n\nTap your name and tell us if you're coming 👇\n${link}`,
    });

  // Personal invite straight to one friend's WhatsApp
  const whatsapp = (m) => {
    const text = `Hey ${m.name}! 🎉 ${party.title}${details ? ` (${details})` : ''}. Are you in? Tap here 👇\n${link}`;
    Linking.openURL(`whatsapp://send?phone=${waNumber(m.phone)}&text=${encodeURIComponent(text)}`).catch(() =>
      Share.share({ message: text })
    );
  };

  const going = members.filter((m) => m.rsvp === 'in' || m.name === 'Me').length;
  const answered = members.filter((m) => m.rsvp && m.name !== 'Me').length;
  const BADGE = { in: '🙌 In', out: '😢 Out', maybe: '🤔 Maybe' };

  const requests = members.filter((m) => m.bill_requested_at && m.name !== 'Me');
  const toggleHide = async (hide) => {
    setParty((p) => ({ ...p, hide_bill: hide }));
    try {
      await setHideBill(party, hide, myName);
    } catch (e) {
      setParty((p) => ({ ...p, hide_bill: !hide }));
      Alert.alert("Couldn't save", e.message);
    }
  };

  const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  const confirmDelete = () =>
    Alert.alert('Delete this party?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteParty(party.id);
            onDeleted();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onEdit(party)}>
          <Text style={styles.edit}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{kindOf(party.kind).emoji} {party.title}</Text>
      {details ? (
        <TouchableOpacity onPress={() => party.place && setPlaceOpen(true)}>
          <Text style={styles.meta}>📍 {details}{party.place ? '  ›' : ''}</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={placeOpen} transparent animationType="slide" onRequestClose={() => setPlaceOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPlaceOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.placeSheet}>
            <View style={styles.handle} />
            <Text style={styles.placeTitle}>📍 {party.place}</Text>
            {party.party_date ? <Text style={styles.placeSub}>📅 {party.party_date}</Text> : null}
            <View style={styles.placeGap} />
            <ScrollView style={styles.sheetScroll}>
              <AboutPlace place={party.place || ''} />
              <PopularHere place={party.place || ''} quietIfEmpty={['trip', 'daytrip', 'wedding', 'house'].includes(party.kind)} />
            </ScrollView>
            <TouchableOpacity style={styles.mapsBtn} onPress={() => Linking.openURL(mapsUrl(party.place))}>
              <Text style={styles.mapsText}>🗺️ Open in Google Maps</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.accentSoft} />}>
        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Budget</Text>
            <Text style={styles.sumBold}>{inr(party.budget)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>People</Text>
            <Text style={styles.sumLabel}>{members.length}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Coming</Text>
            <Text style={styles.going}>🙌 {going} going · {answered} of {members.length - 1} answered</Text>
          </View>
        </View>

        {owing.length > 0 && (
          <View style={styles.settle}>
            <View style={styles.settleTop}>
              <Text style={styles.settleTitle}>💸 Collect shares</Text>
              <Text style={styles.settleCount}>{paidCount} of {owing.length} paid</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${(paidCount / owing.length) * 100}%` }]} />
            </View>
            <Text style={styles.settleNote}>
              {toCollect > 0 ? `${inr(toCollect)} still to collect` : "Everyone's paid 🎉"}
            </Text>
          </View>
        )}

        <View style={styles.hideBox}>
          <View style={styles.hideRow}>
            <View style={styles.flex}>
              <Text style={styles.hideTitle}>🙈 Hide amounts from friends</Text>
              <Text style={styles.hideSub}>{party.hide_bill ? 'Friends see "It\'s a treat" without prices' : 'Friends can see the budget and their share'}</Text>
            </View>
            <Switch value={!!party.hide_bill} onValueChange={toggleHide} trackColor={{ true: C.accent, false: C.border }} />
          </View>
          {requests.length > 0 && (
            <View style={styles.reqBox}>
              <Text style={styles.reqText}>🧾 {requests.map((r) => r.name).join(', ')} asked to see the bill</Text>
              {party.hide_bill && (
                <TouchableOpacity onPress={() => toggleHide(false)}>
                  <Text style={styles.reqBtn}>Show bill to everyone</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.chatBtn} onPress={onChat}>
          <Text style={styles.chatText}>💬 Open party chat</Text>
          <Text style={styles.chatHint}>Plan everything here with your friends</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gamesBtn} onPress={() => setGamesOpen(true)}>
          <Text style={styles.gamesText}>🎮 Party games</Text>
          <Text style={styles.gamesSub}>Spin the wheel · Truth or dare · Charades</Text>
        </TouchableOpacity>
        <PartyGames visible={gamesOpen} onClose={() => setGamesOpen(false)} party={party} />
        {['house', 'party', 'birthday', 'bachelor', 'match', 'nightout', 'trip'].includes(party.kind) ? (
          <TouchableOpacity style={styles.barBtn} onPress={() => setBarOpen(true)}>
            <Text style={styles.barTitle}>🍹 Drinks menu</Text>
            <Text style={styles.gamesSub}>Mocktails & cocktails · recipes · shopping list</Text>
          </TouchableOpacity>
        ) : null}
        <PartyBar visible={barOpen} onClose={() => setBarOpen(false)} party={party} />

        {!['trip', 'daytrip', 'wedding'].includes(party.kind) && onTakeOut ? (
          <BookingCard party={party} onTakeOut={() => onTakeOut(party)} />
        ) : null}
        <BringList party={party} />
        {['house', 'party', 'birthday', 'bachelor', 'match', 'trip', 'daytrip'].includes(party.kind) && onShop ? (
          <TouchableOpacity style={styles.shopBtn} onPress={onShop}>
            <Text style={styles.shopText}>🛒 Shop for this party</Text>
            <Text style={styles.shopHint}>Supermarkets and shops near you</Text>
          </TouchableOpacity>
        ) : null}
        <PartyPhotos party={party} />
        <NightCheck party={party} onChanged={reload} />

        <TouchableOpacity style={styles.shareBtn} onPress={shareAll}>
          <Text style={styles.shareText}>📨 Invite friends</Text>
          <Text style={styles.shareHint}>One link for WhatsApp groups or anyone. Friends answer and chat from it.</Text>
        </TouchableOpacity>

        {members.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.name}>{show(m.name)}</Text>
                {m.name !== 'Me' ? <ActiveTag status={activeOf(m)} /> : null}
                {coverOf(m) ? <Text style={styles.cover}>🤝 Covered by {show(coverOf(m).name)}</Text> : null}
                {coveredBy(m).length ? <Text style={styles.cover}>🤝 Paying for {coveredBy(m).map((x) => show(x.name)).join(', ')}</Text> : null}
              </View>
              <Text style={[styles.pay, m.covered_by && styles.payCovered]}>{inr(m.covered_by ? m.share : dueOf(m))}</Text>
            </View>
            {m.name !== 'Me' && (
              <View style={styles.rsvpRow}>
                <Text style={[styles.rsvp, m.rsvp === 'in' && styles.rsvpIn, m.rsvp === 'out' && styles.rsvpOut]}>
                  {m.rsvp ? BADGE[m.rsvp] : '⏳ No answer yet'}
                </Text>
                {m.phone ? (
                  <TouchableOpacity onPress={() => whatsapp(m)}>
                    <Text style={styles.wa}>💬 WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
            {tag(m) ? (
              <Text style={styles.line}>{tag(m)}</Text>
            ) : m.name === 'Me' ? (
              <Text style={styles.line}>{party.split_mode === 'treat' ? "You're treating everyone 🎁" : 'Your own share'}</Text>
            ) : (
              <View style={styles.payRow}>
                {m.paid_at ? (
                  <TouchableOpacity style={styles.paidBtn} onPress={() => togglePaid(m)}>
                    <Text style={styles.paidText}>✅ Paid</Text>
                  </TouchableOpacity>
                ) : m.covered_by ? (
                  <TouchableOpacity style={styles.remindBtn} onPress={() => pickCover(m)}>
                    <Text style={styles.remindText}>🤝 Change</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={styles.markBtn} onPress={() => togglePaid(m)}>
                      <Text style={styles.markText}>Mark paid</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.remindBtn} onPress={() => remind(m)}>
                      <Text style={styles.remindText}>Remind</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.remindBtn} onPress={() => pickCover(m)}>
                      <Text style={styles.remindText}>🤝</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete this party</Text>
        </TouchableOpacity>
      </ScrollView>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  edit: { color: C.accentSoft, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: C.text },
  meta: { color: C.faint, fontSize: 14, marginTop: 4 },
  list: { flex: 1, marginTop: 15 },
  summary: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 15 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: C.sub, fontSize: 14 },
  sumBold: { fontSize: 16, fontWeight: '800', color: C.text },
  settle: { backgroundColor: C.greenBg, borderRadius: 16, padding: 16, marginBottom: 15 },
  settleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settleTitle: { fontSize: 16, fontWeight: '800', color: C.green },
  settleCount: { fontSize: 14, fontWeight: '700', color: C.green },
  barBg: { height: 8, backgroundColor: '#1E5A44', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: C.green, borderRadius: 4 },
  settleNote: { color: C.sub, fontSize: 13, marginTop: 8 },
  shareBtn: { backgroundColor: C.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 15 },
  flex: { flex: 1 },
  hideBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  hideRow: { flexDirection: 'row', alignItems: 'center' },
  hideTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  hideSub: { color: C.faint, fontSize: 12, marginTop: 2, marginRight: 8 },
  reqBox: { backgroundColor: C.amberBg, borderRadius: 10, padding: 10, marginTop: 10 },
  reqText: { color: C.amber, fontSize: 13, fontWeight: '700' },
  reqBtn: { color: C.accentSoft, fontSize: 14, fontWeight: '800', marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  placeSheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
  placeTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  placeSub: { color: C.sub, fontSize: 14, marginTop: 4 },
  placeGap: { height: 14 },
  sheetScroll: { maxHeight: 460 },
  mapsBtn: { backgroundColor: C.cardHi, borderRadius: 14, padding: 14, alignItems: 'center' },
  mapsText: { color: C.accentSoft, fontSize: 16, fontWeight: '800' },
  barBtn: { backgroundColor: 'rgba(236,72,153,0.13)', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  barTitle: { color: C.pink, fontSize: 16, fontWeight: '800' },
  gamesBtn: { backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  gamesText: { color: '#F59E0B', fontSize: 16, fontWeight: '800' },
  gamesSub: { color: C.faint, fontSize: 12, marginTop: 3 },
  shopBtn: { backgroundColor: C.cardHi, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  cover: { color: C.accentSoft, fontSize: 12, fontWeight: '600', marginTop: 3 },
  payCovered: { textDecorationLine: 'line-through', color: C.faint },
  shopHint: { color: C.faint, fontSize: 12, marginTop: 3 },
  shopText: { color: C.text, fontSize: 16, fontWeight: '800' },
  chatBtn: { backgroundColor: C.pink, borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 12 },
  chatText: { color: '#2A0A1F', fontSize: 16, fontWeight: '800' },
  chatHint: { color: '#4A1035', fontSize: 12, marginTop: 3 },
  shareHint: { color: '#E9DDFF', fontSize: 12, marginTop: 4, textAlign: 'center' },
  going: { color: C.green, fontSize: 14, fontWeight: '700' },
  rsvpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  rsvp: { color: C.faint, fontSize: 13, fontWeight: '700' },
  rsvpIn: { color: C.green },
  rsvpOut: { color: C.red },
  wa: { color: C.green, fontSize: 13, fontWeight: '800' },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: C.text },
  pay: { fontSize: 20, fontWeight: '800', color: C.accentSoft },
  line: { color: C.faint, fontSize: 13, marginTop: 6 },
  payRow: { flexDirection: 'row', marginTop: 10 },
  markBtn: { backgroundColor: C.green, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  markText: { color: '#0B2A1F', fontSize: 14, fontWeight: '800' },
  remindBtn: { borderWidth: 1, borderColor: C.green, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  remindText: { color: C.green, fontSize: 14, fontWeight: '700' },
  paidBtn: { backgroundColor: C.greenBg, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  paidText: { color: C.green, fontSize: 14, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', paddingVertical: 20, marginBottom: 30 },
  deleteText: { color: C.red, fontSize: 16 },
});
