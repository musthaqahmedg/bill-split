import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';

// 🎵 Song requests: anyone in the plan adds a song, everyone votes 👍, the top ones rise.
// Friends do the same from the invite website. Play opens Spotify / YouTube search.

const q = (s) => encodeURIComponent([s.title, s.artist].filter(Boolean).join(' '));

export default function SpaceSongs({ party }) {
  const me = (party.party_members || []).find((m) => m.name === 'Me');
  const token = party.share_token;
  const [songs, setSongs] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_party_songs', { p_token: token });
    setSongs(Array.isArray(data) ? data : []);
  }, [token]);
  useEffect(() => { load().catch(() => setSongs([])); }, [load]);

  const add = async () => {
    if (!title.trim() || !me || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('add_party_song', { p_token: token, p_member: me.id, p_title: title, p_artist: artist });
    setBusy(false);
    if (error) return Alert.alert("Couldn't add", error.message);
    setTitle('');
    setArtist('');
    load();
  };

  const vote = async (s, on) => {
    if (!me) return;
    // show it straight away, then save
    setSongs((list) => list.map((x) => (x.id === s.id ? { ...x, votes: x.votes + (on ? 1 : -1), voters: on ? [...x.voters, me.id] : x.voters.filter((v) => v !== me.id) } : x)));
    const { error } = await supabase.rpc('vote_party_song', { p_token: token, p_member: me.id, p_song: s.id, p_on: on });
    if (error) load();
  };

  const remove = (s) =>
    Alert.alert('Remove this song?', s.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await supabase.rpc('remove_party_song', { p_token: token, p_member: me.id, p_song: s.id });
          load();
        },
      },
    ]);

  const play = (s) =>
    Alert.alert(s.title, 'Play it on…', [
      { text: '🟢 Spotify', onPress: () => Linking.openURL(`https://open.spotify.com/search/${q(s)}`).catch(() => {}) },
      { text: '▶️ YouTube', onPress: () => Linking.openURL(`https://www.youtube.com/results?search_query=${q(s)}`).catch(() => {}) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  if (!songs) return <ActivityIndicator color={C.lime} style={{ marginVertical: 24 }} />;

  return (
    <View>
      <Text style={styles.label}>ADD A SONG</Text>
      <View style={styles.addBox}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={80} placeholder="Song name"
          placeholderTextColor={C.faint} keyboardAppearance="dark" returnKeyType="next" />
        <TextInput style={[styles.input, styles.inputGap]} value={artist} onChangeText={setArtist} maxLength={60} placeholder="Artist (optional)"
          placeholderTextColor={C.faint} keyboardAppearance="dark" returnKeyType="done" onSubmitEditing={add} />
        <TouchableOpacity style={[styles.addBtn, (!title.trim() || busy) && styles.off]} onPress={add} disabled={!title.trim() || busy}>
          <Text style={styles.addText}>{busy ? 'Adding…' : '＋ Add to the queue'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>THE QUEUE · {songs.length} {songs.length === 1 ? 'SONG' : 'SONGS'} · MOST VOTES FIRST</Text>
      {songs.length ? (
        <View style={styles.box}>
          {songs.map((s, i) => {
            const mine = me && s.voters.includes(me.id);
            return (
              <View key={s.id} style={[styles.row, i > 0 && styles.line]}>
                <Text style={styles.rank}>{i + 1}</Text>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => play(s)} onLongPress={() => me && remove(s)} activeOpacity={0.7}>
                  <Text style={styles.title} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{[s.artist, s.added_by_name ? `by ${s.added_by_name}` : null].filter(Boolean).join(' · ')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.vote, mine && styles.voteOn]} onPress={() => vote(s, !mine)} hitSlop={6} accessibilityLabel={mine ? 'Remove your vote' : 'Vote for this song'}>
                  <Text style={[styles.voteText, mine && { color: C.onLime }]}>👍 {s.votes}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.empty}>No songs yet. Add the first one — friends can add and vote from their invite link too 🎶</Text>
      )}
      {songs.length ? <Text style={styles.hint}>Tap a song to play it · hold to remove</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 14, marginBottom: 8 },
  addBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12 },
  input: { backgroundColor: C.cardHi, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: C.text, fontSize: 15 },
  inputGap: { marginTop: 8 },
  addBtn: { backgroundColor: C.lime, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  off: { backgroundColor: C.disabled },
  addText: { fontFamily: F.display, color: C.onLime, fontSize: 14 },
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  line: { borderTopWidth: 1, borderTopColor: C.border },
  rank: { width: 24, color: C.faint, fontSize: 15, fontWeight: '900' },
  title: { color: C.text, fontSize: 15, fontWeight: '800' },
  sub: { color: C.sub, fontSize: 13, marginTop: 2 },
  vote: { borderWidth: 1, borderColor: C.lime, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, marginLeft: 8 },
  voteOn: { backgroundColor: C.lime },
  voteText: { color: C.lime, fontSize: 13, fontWeight: '900' },
  empty: { color: C.sub, fontSize: 14, lineHeight: 20 },
  hint: { color: C.faint, fontSize: 13, marginTop: 8 },
});
