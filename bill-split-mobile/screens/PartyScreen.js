import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { deleteParty, getParty, partyLink, setCoveredBy, setHideBill, setMemberPaid, waNumber } from '../services/parties';
import AboutPlace from './AboutPlace';
import ActiveTag from './ActiveTag';
import BookingCard from './BookingCard';
import { useFriendsActive } from '../services/active';
import BringList from './BringList';
import NightCheck from './NightCheck';
import NightMode from './NightMode';
import PartyPhotos from './PartyPhotos';
import PartyGames from './PartyGames';
import PartyBar from './PartyBar';
import { isVenue } from '../services/menus';
import { MenuButton } from './MenuSheet';
import KeyboardDone from './KeyboardDone';
import PopularHere from './PopularHere';
import { show } from '../services/names';
import { getProfile } from '../services/profile';
import { kindOf } from '../services/partyKinds';
import { C, F } from '../services/theme';
import { countdown, planBucket } from '../services/when';
import VoteTab from './VoteTab';

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function PartyScreen({ partyId, onBack, onDeleted, onChat, onEdit, onShop, onTakeOut, onSplit }) {
  const [gamesOpen, setGamesOpen] = useState(false);
  const [nightOpen, setNightOpen] = useState(false); // 🌙 Night Mode
  const [barOpen, setBarOpen] = useState(false);
  const [tab, setTab] = useState('overview'); // 🗂️ Overview · Plan · Vote · Chat · Split
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

  const bucket = planBucket(party);
  const when = countdown(party);
  const crewNames = members.filter((m) => m.rsvp !== 'out').map((m) => m.name);
  const remindAll = () => {
    const due = owing.filter((m) => !m.paid_at && !m.covered_by);
    if (!due.length) return;
    Share.share({
      message:
        `💸 ${party.title}: quick reminder to settle up 🙏\n` +
        due.map((m) => `• ${m.name}: ${inr(dueOf(m))}`).join('\n') +
        (myUpi ? `\n\nPay to UPI: ${myUpi}` : '') + `\n\n${link}`,
    });
  };
  const TABS = [
    ['overview', 'Overview'],
    ['plan', 'Plan'],
    ['vote', 'Vote'],
    ['chat', 'Chat'],
    ['split', 'Split'],
  ];

  const PersonRow = ({ m, i }) => (
    <View style={styles.person}>
      <View style={[styles.face, { backgroundColor: FACES[i % FACES.length] }]}>
        <Text style={styles.faceText}>{show(m.name).slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.personName}>{show(m.name)}</Text>
        {m.name !== 'Me' ? <ActiveTag status={activeOf(m)} /> : <Text style={styles.personSub}>Host</Text>}
      </View>
      {m.name !== 'Me' ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rsvp, m.rsvp === 'in' && styles.rsvpIn, m.rsvp === 'out' && styles.rsvpOut]}>{m.rsvp ? BADGE[m.rsvp] : '⏳ No answer'}</Text>
          {m.phone ? (
            <TouchableOpacity onPress={() => whatsapp(m)} hitSlop={6}>
              <Text style={styles.wa}>💬 WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onEdit(party)}>
          <Text style={styles.edit}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>

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
              {isVenue(party) ? <MenuButton label="📋 See the full menu" onPress={() => { setPlaceOpen(false); setTimeout(() => setBarOpen(true), 350); }} /> : null}
            </ScrollView>
            <TouchableOpacity style={styles.mapsBtn} onPress={() => Linking.openURL(mapsUrl(party.place))}>
              <Text style={styles.mapsText}>🗺️ Open in Google Maps</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.lime} />} stickyHeaderIndices={[1]}>
        <View>
          <View style={[styles.kickerPill, bucket === 'live' && styles.kickerLive]}>
            <Text style={[styles.kickerText, bucket === 'live' && { color: C.onLime }]}>{bucket === 'live' ? '● LIVE TONIGHT' : `${kindOf(party.kind).emoji} ${when.toUpperCase()}`}</Text>
          </View>
          <Text style={styles.title}>{party.title}</Text>
          {details ? (
            <TouchableOpacity onPress={() => party.place && setPlaceOpen(true)}>
              <Text style={styles.meta}>📍 {details}{party.place ? '  ›' : ''}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.nightBtn} onPress={() => setNightOpen(true)} activeOpacity={0.85}>
            <Text style={styles.nightEmoji}>🌙</Text>
            <View style={styles.flex}>
              <Text style={styles.nightTitle}>START NIGHT MODE</Text>
              <Text style={styles.nightSub}>Squad radar · bill so far · get home safe</Text>
            </View>
            <Text style={styles.nightChev}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 🗂️ Room tabs */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabs}>
            {TABS.map(([k, label]) => (
              <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => (k === 'chat' ? onChat() : setTab(k))} activeOpacity={0.85}>
                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.tabBody}>
          {tab === 'overview' ? (
            <>
              <View style={styles.posters}>
                <View style={[styles.poster, { backgroundColor: C.lime }]}>
                  <Text style={styles.posterKicker}>BUDGET</Text>
                  <Text style={styles.posterBig}>{party.hide_bill ? '🙈' : inr(party.budget)}</Text>
                  <Text style={styles.posterSub}>{party.split_mode === 'treat' ? "It's a treat 🎁" : party.split_mode === 'free' ? 'Birthday goes free 🎂' : 'Split equally'}</Text>
                </View>
                <View style={[styles.poster, { backgroundColor: C.cyan }]}>
                  <Text style={styles.posterKicker}>GOING</Text>
                  <Text style={styles.posterBig}>{going}</Text>
                  <Text style={styles.posterSub}>{answered} of {members.length - 1} answered</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.invite} onPress={shareAll} activeOpacity={0.85}>
                <Text style={styles.inviteIcon}>👥</Text>
                <View style={styles.flex}>
                  <Text style={styles.inviteTitle}>INVITE MORE FRIENDS</Text>
                  <Text style={styles.inviteSub}>One link for WhatsApp groups. Friends answer and chat from it.</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.section}>The squad · {members.length}</Text>
              {members.map((m, i) => <PersonRow key={m.id} m={m} i={i} />)}

              <PartyPhotos party={party} />
              <NightCheck party={party} onChanged={reload} />
            </>
          ) : null}

          {tab === 'plan' ? (
            <>
              {!['trip', 'daytrip', 'wedding'].includes(party.kind) && onTakeOut ? <BookingCard party={party} onTakeOut={() => onTakeOut(party)} /> : null}
              <BringList party={party} />
              <View style={styles.tiles}>
                {['house', 'party', 'birthday', 'bachelor', 'match', 'trip', 'daytrip'].includes(party.kind) && onShop ? (
                  <TouchableOpacity style={[styles.tile, { backgroundColor: C.violet }]} onPress={onShop}>
                    <Text style={styles.tileEmoji}>🛒</Text>
                    <Text style={styles.tileTitle}>Shop for it</Text>
                    <Text style={styles.tileSub}>Shops near you</Text>
                  </TouchableOpacity>
                ) : null}
                {isVenue(party) || ['house', 'party', 'birthday', 'bachelor', 'match', 'nightout', 'trip'].includes(party.kind) ? (
                  <TouchableOpacity style={[styles.tile, { backgroundColor: C.pink }]} onPress={() => setBarOpen(true)}>
                    <Text style={styles.tileEmoji}>{isVenue(party) ? '🍽️' : '🍹'}</Text>
                    <Text style={styles.tileTitle}>{isVenue(party) ? 'The menu' : 'Drinks menu'}</Text>
                    <Text style={styles.tileSub}>{isVenue(party) ? 'Real prices' : 'Mocktails first'}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.tile, { backgroundColor: '#FFD84D' }]} onPress={() => setGamesOpen(true)}>
                  <Text style={styles.tileEmoji}>🎮</Text>
                  <Text style={styles.tileTitle}>Party games</Text>
                  <Text style={styles.tileSub}>Wheel · dares · hot seat</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {tab === 'vote' ? <VoteTab party={party} /> : null}

          {tab === 'split' ? (
            <>
              {onSplit ? (
                <TouchableOpacity style={styles.splitBtn} onPress={() => onSplit(crewNames, party.id)} activeOpacity={0.85}>
                  <Text style={styles.splitText}>📸 SCAN & SPLIT A BILL</Text>
                  <Text style={styles.splitSub}>The squad is already added</Text>
                </TouchableOpacity>
              ) : null}

              {owing.length > 0 && (
                <View style={styles.settle}>
                  <View style={styles.settleTop}>
                    <Text style={styles.settleTitle}>SETTLE UP</Text>
                    <Text style={styles.settleCount}>{paidCount} of {owing.length} settled</Text>
                  </View>
                  <View style={styles.segs}>
                    {owing.map((m) => (
                      <View key={m.id} style={[styles.seg, m.paid_at && styles.segOn]} />
                    ))}
                  </View>
                  <Text style={styles.settleNote}>{toCollect > 0 ? `${inr(toCollect)} still to collect` : "Everyone's paid 🎉"}</Text>
                  {toCollect > 0 ? (
                    <TouchableOpacity style={styles.requestBtn} onPress={remindAll} activeOpacity={0.85}>
                      <Text style={styles.requestText}>💸 SEND REQUESTS</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              <View style={styles.hideBox}>
                <View style={styles.hideRow}>
                  <View style={styles.flex}>
                    <Text style={styles.hideTitle}>🙈 Hide amounts from friends</Text>
                    <Text style={styles.hideSub}>{party.hide_bill ? 'Friends see "It\'s a treat" without prices' : 'Friends can see the budget and their share'}</Text>
                  </View>
                  <Switch value={!!party.hide_bill} onValueChange={toggleHide} trackColor={{ true: C.lime, false: C.border }} />
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

              {members.map((m, i) => (
                <View key={m.id} style={[styles.card, m.paid_at && styles.cardPaid]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.face, { backgroundColor: FACES[i % FACES.length] }]}>
                      <Text style={styles.faceText}>{show(m.name).slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{show(m.name)}</Text>
                      {coverOf(m) ? <Text style={styles.cover}>🤝 Covered by {show(coverOf(m).name)}</Text> : null}
                      {coveredBy(m).length ? <Text style={styles.cover}>🤝 Paying for {coveredBy(m).map((x) => show(x.name)).join(', ')}</Text> : null}
                    </View>
                    <Text style={[styles.pay, m.covered_by && styles.payCovered]}>{inr(m.covered_by ? m.share : dueOf(m))}</Text>
                  </View>
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
            </>
          ) : null}

          {tab === 'overview' ? (
            <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete this plan</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
      <NightMode party={party} visible={nightOpen} onClose={() => setNightOpen(false)} onChat={onChat} onSplit={onSplit} onChanged={reload} />
      <PartyGames visible={gamesOpen} onClose={() => setGamesOpen(false)} party={party} />
      <PartyBar visible={barOpen} onClose={() => setBarOpen(false)} party={party} />
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const FACES = ['#E2FF3B', '#FF4FA0', '#55E0F0', '#FF8A3D', '#A98BFF'];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: C.lime, fontSize: 16, marginBottom: 10 },
  edit: { color: C.lime, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  list: { flex: 1 },
  kickerPill: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  kickerLive: { backgroundColor: C.lime, borderColor: C.lime },
  kickerText: { color: C.sub, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.text, marginTop: 8 },
  meta: { color: C.sub, fontSize: 14, marginTop: 4 },
  nightBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.lime, borderRadius: 20, padding: 14, marginTop: 14 },
  nightEmoji: { fontSize: 26, marginRight: 12 },
  nightTitle: { color: C.onLime, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  nightSub: { color: C.onLime, opacity: 0.75, fontSize: 12, fontWeight: '600', marginTop: 2 },
  nightChev: { color: C.onLime, fontSize: 26, marginLeft: 8 },
  tabsWrap: { backgroundColor: C.bg, paddingTop: 14, paddingBottom: 10 },
  tabs: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  tabOn: { backgroundColor: C.lime },
  tabText: { color: C.sub, fontSize: 13, fontWeight: '800' },
  tabTextOn: { color: C.onLime },
  tabBody: { paddingTop: 4 },
  posters: { flexDirection: 'row', marginBottom: 10 },
  poster: { flex: 1, borderRadius: 20, padding: 14, marginHorizontal: 3, minHeight: 110 },
  posterKicker: { color: C.onLime, fontSize: 10, fontWeight: '900', letterSpacing: 1, opacity: 0.7 },
  posterBig: { fontFamily: F.display, color: C.onLime, fontSize: 26, marginTop: 6 },
  posterSub: { color: C.onLime, fontSize: 12, fontWeight: '700', marginTop: 4, opacity: 0.8 },
  invite: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.violet, borderRadius: 20, padding: 16, marginBottom: 14 },
  inviteIcon: { fontSize: 26, marginRight: 12 },
  inviteTitle: { fontFamily: F.display, color: C.onLime, fontSize: 15 },
  inviteSub: { color: C.onLime, opacity: 0.8, fontSize: 12, fontWeight: '600', marginTop: 3 },
  section: { color: C.text, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  person: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 10, marginBottom: 8 },
  face: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  faceText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  personName: { color: C.text, fontSize: 15, fontWeight: '800' },
  personSub: { color: C.lime, fontSize: 12, fontWeight: '700', marginTop: 2 },
  rsvp: { color: C.faint, fontSize: 13, fontWeight: '700' },
  rsvpIn: { color: C.lime },
  rsvpOut: { color: C.red },
  wa: { color: C.green, fontSize: 12, fontWeight: '800', marginTop: 3 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  tile: { width: '48.5%', borderRadius: 20, padding: 14, marginBottom: 10, minHeight: 110 },
  tileEmoji: { fontSize: 26 },
  tileTitle: { fontFamily: F.display, color: C.onLime, fontSize: 15, marginTop: 8 },
  tileSub: { color: C.onLime, opacity: 0.75, fontSize: 12, fontWeight: '700', marginTop: 2 },
  splitBtn: { backgroundColor: C.lime, borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 12 },
  splitText: { color: C.onLime, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  splitSub: { color: C.onLime, opacity: 0.75, fontSize: 12, fontWeight: '600', marginTop: 2 },
  settle: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginBottom: 12 },
  settleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settleTitle: { color: C.pink, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  settleCount: { color: C.text, fontSize: 14, fontWeight: '800' },
  segs: { flexDirection: 'row', marginTop: 12 },
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.cardHi, marginRight: 4 },
  segOn: { backgroundColor: C.lime },
  settleNote: { color: C.sub, fontSize: 13, marginTop: 10 },
  requestBtn: { backgroundColor: C.pink, borderRadius: 14, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  requestText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  hideBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  hideRow: { flexDirection: 'row', alignItems: 'center' },
  hideTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  hideSub: { color: C.faint, fontSize: 12, marginTop: 2, marginRight: 8 },
  reqBox: { backgroundColor: C.amberBg, borderRadius: 10, padding: 10, marginTop: 10 },
  reqText: { color: C.amber, fontSize: 13, fontWeight: '700' },
  reqBtn: { color: C.lime, fontSize: 14, fontWeight: '800', marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  placeSheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
  placeTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  placeSub: { color: C.sub, fontSize: 14, marginTop: 4 },
  placeGap: { height: 14 },
  sheetScroll: { maxHeight: 460 },
  mapsBtn: { backgroundColor: C.cardHi, borderRadius: 14, padding: 14, alignItems: 'center' },
  mapsText: { color: C.lime, fontSize: 16, fontWeight: '800' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12, marginBottom: 10 },
  cardPaid: { borderColor: C.lime + '55' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: C.text },
  cover: { color: C.lime, fontSize: 12, fontWeight: '600', marginTop: 3 },
  pay: { fontFamily: F.bold, fontSize: 18, color: C.text },
  payCovered: { textDecorationLine: 'line-through', color: C.faint },
  line: { color: C.faint, fontSize: 13, marginTop: 8 },
  payRow: { flexDirection: 'row', marginTop: 10 },
  markBtn: { backgroundColor: C.lime, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  markText: { color: C.onLime, fontSize: 14, fontWeight: '900' },
  remindBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  remindText: { color: C.text, fontSize: 14, fontWeight: '700' },
  paidBtn: { backgroundColor: C.lime + '22', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 14 },
  paidText: { color: C.lime, fontSize: 14, fontWeight: '800' },
  deleteBtn: { alignItems: 'center', paddingVertical: 20, marginBottom: 30 },
  deleteText: { color: C.red, fontSize: 15 },
});
