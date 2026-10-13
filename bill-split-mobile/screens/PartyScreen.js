import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteParty, getParty, setMemberPaid } from '../services/parties';
import { real, show } from '../services/names';
import { getProfile } from '../services/profile';
import { C } from '../services/theme';

const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function PartyScreen({ partyId, onBack, onDeleted }) {
  const [party, setParty] = useState(null);
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

  const togglePaid = async (m) => {
    const paid = !m.paid_at;
    const stamp = paid ? new Date().toISOString() : null;
    const setStamp = (value) =>
      setParty((p) => ({ ...p, party_members: p.party_members.map((x) => (x.id === m.id ? { ...x, paid_at: value } : x)) }));
    setStamp(stamp);
    try {
      await setMemberPaid(m.id, paid);
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

  // One message for the whole group
  const shareAll = () =>
    Share.share({
      message:
        `🎉 ${party.title}${details ? `\n📍 ${details}` : ''}\n💰 Budget ${inr(party.budget)}\n\n` +
        members
          .map((m) => (Number(m.share) > 0 ? `${m.paid_at ? '✅' : '⏳'} ${real(m.name, myName)}: ${inr(m.share)}` : `${party.split_mode === 'free' && m.name === party.special_person ? '🎂' : '🎁'} ${real(m.name, myName)}: free`))
          .join('\n') +
        (myUpi ? `\n\nPay to UPI: ${myUpi}` : ''),
    });

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
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{party.title}</Text>
      {details ? <Text style={styles.meta}>📍 {details}</Text> : null}

      <ScrollView style={styles.list}>
        <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Budget</Text>
            <Text style={styles.sumBold}>{inr(party.budget)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>People</Text>
            <Text style={styles.sumLabel}>{members.length}</Text>
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

        <TouchableOpacity style={styles.shareBtn} onPress={shareAll}>
          <Text style={styles.shareText}>📣 Send to the group</Text>
        </TouchableOpacity>

        {members.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{show(m.name)}</Text>
              <Text style={styles.pay}>{inr(m.share)}</Text>
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
                ) : (
                  <>
                    <TouchableOpacity style={styles.markBtn} onPress={() => togglePaid(m)}>
                      <Text style={styles.markText}>Mark paid</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.remindBtn} onPress={() => remind(m)}>
                      <Text style={styles.remindText}>Remind</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
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
