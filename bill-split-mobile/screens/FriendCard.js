import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pulse from './Pulse';
import { activeLabel } from '../services/active';
import { profileCard } from '../services/friends';
import { avatarUrl, instaUrl, linkedinUrl } from '../services/profile';
import { levelOf } from '../services/xp';
import { C } from '../services/theme';

// 👤 A friend's profile card: photo, bio, level, links, plans together
export default function FriendCard({ userId, onClose }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setP(null);
    setError('');
    profileCard(userId).then(setP).catch((e) => setError(e.message));
  }, [userId]);

  const st = p && activeLabel(p.last_seen);
  const lv = p && levelOf(p.xp || 0);

  return (
    <Modal visible={!!userId} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          {!p && !error ? <ActivityIndicator color={C.accentSoft} style={styles.mv} /> : null}
          {error ? <Text style={styles.faint}>{error}</Text> : null}
          {p ? (
            <View style={styles.center}>
              <Pulse name={p.name} uri={avatarUrl(p.avatar_path)} on={st && st.now} size={96} />
              <Text style={styles.name}>{p.name}</Text>
              {st ? <Text style={[styles.status, st.now && styles.on]}>{st.now ? '🟢 ' : ''}{st.text}</Text> : null}
              {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{lv.emoji}</Text>
                  <Text style={styles.statLabel}>{lv.name}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{p.plans_together}</Text>
                  <Text style={styles.statLabel}>Plans together</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{p.friends}</Text>
                  <Text style={styles.statLabel}>Friends</Text>
                </View>
              </View>

              <View style={styles.links}>
                {p.instagram ? (
                  <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(instaUrl(p.instagram))}>
                    <Text style={styles.linkText}>📸 @{p.instagram}</Text>
                  </TouchableOpacity>
                ) : null}
                {p.linkedin ? (
                  <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(linkedinUrl(p.linkedin))}>
                    <Text style={styles.linkText}>💼 LinkedIn</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.faint}>On Vibe Out since {p.joined}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 40 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16 },
  mv: { marginVertical: 40 },
  center: { alignItems: 'center' },
  name: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 12 },
  status: { color: C.faint, fontSize: 13, marginTop: 3 },
  on: { color: C.green, fontWeight: '600' },
  bio: { color: C.sub, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  stats: { flexDirection: 'row', marginTop: 18, width: '100%' },
  stat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingVertical: 12, marginHorizontal: 4 },
  statNum: { color: C.text, fontSize: 20, fontWeight: '700' },
  statLabel: { color: C.faint, fontSize: 11, marginTop: 3 },
  links: { flexDirection: 'row', marginTop: 16 },
  link: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14, marginHorizontal: 5 },
  linkText: { color: C.text, fontSize: 14, fontWeight: '600' },
  faint: { color: C.faint, fontSize: 12, marginTop: 14 },
});
