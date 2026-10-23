import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Modal, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { show } from '../services/names';
import { kindOf } from '../services/partyKinds';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const { width: W, height: H } = Dimensions.get('window');
const SLIDE_MS = 3800;
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

// 🎬 The night as an Instagram-style story: who came, photos, who brought what, chat, money, home safe
export default function NightRecap({ visible, onClose, party, photos }) {
  const [slides, setSlides] = useState([]);
  const [i, setI] = useState(0);
  const bar = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // Build the slides from everything that happened
  useEffect(() => {
    if (!visible) return;
    setI(0);
    let alive = true;
    (async () => {
      const [list, chat] = await Promise.all([
        supabase.rpc('get_party_list', { p_token: party.share_token }).then((r) => r.data || [], () => []),
        supabase.rpc('get_party_chat', { p_token: party.share_token }).then((r) => r.data || [], () => []),
      ]);
      if (!alive) return;
      const k = kindOf(party.kind);
      const members = party.party_members || [];
      const came = members.filter((m) => m.rsvp === 'in' || m.name === 'Me');
      const out = [];
      out.push({ bg: k.color || C.accent, emoji: k.emoji, big: party.title, small: [party.party_date, party.place && party.place.replace(/^My place 🏠 · .*/, 'My place 🏠')].filter(Boolean).join(' · ') || 'The night recap' });
      out.push({ bg: '#EC4899', emoji: '🙌', big: `${came.length} ${came.length === 1 ? 'legend' : 'legends'} showed up`, names: came.map((m) => show(m.name)) });
      for (const p of (photos || []).slice(0, 6)) out.push({ bg: '#000', photo: p.url, small: `📸 ${p.uploader_name}` });
      const brought = list.filter((x) => x.claimed_name);
      if (brought.length) out.push({ bg: '#22D3EE', emoji: '🛒', big: 'Who brought what', lines: brought.slice(0, 6).map((x) => `${x.name.split(' · ')[0]} — ${x.claimed_name === 'Me' ? 'host' : x.claimed_name}`) });
      const msgs = chat.filter((m) => m.kind === 'text' && !m.poll_id).length;
      const polls = chat.filter((m) => m.poll_id).length;
      if (msgs || polls) out.push({ bg: '#7C5CFF', emoji: '💬', big: `${msgs} messages`, small: polls ? `and ${polls} poll${polls === 1 ? '' : 's'} 📊` : 'The group chat was busy' });
      const budget = Number(party.budget) || 0;
      if (party.split_mode === 'treat') out.push({ bg: '#F59E0B', emoji: '🎁', big: 'It was a treat!', small: 'Someone paid for everyone 💜' });
      else if (budget) {
        const owing = members.filter((m) => m.name !== 'Me' && Number(m.share) > 0);
        const paid = owing.filter((m) => m.paid_at).length;
        out.push({ bg: '#34D399', emoji: '💸', big: inr(budget), small: owing.length ? `${paid} of ${owing.length} paid up ${paid === owing.length ? '✅' : '⏳'}` : 'Split, no fights 😎' });
      }
      const home = members.filter((m) => m.home_at).length;
      const driver = members.find((m) => m.is_driver);
      if (home || driver) out.push({ bg: '#60A5FA', emoji: '🏠', big: `${home} got home safe`, small: driver ? `🛡️ ${show(driver.name)} was the driver. Legend.` : 'Safe nights only 💙' });
      out.push({ bg: '#0E0E13', emoji: '✨', big: 'What a night', small: 'Planned on Vibe Out', end: true });
      setSlides(out);
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  // Progress bar + auto next
  useEffect(() => {
    if (!visible || !slides.length) return;
    bar.setValue(0);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    const a = Animated.timing(bar, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    a.start(({ finished }) => {
      if (finished && i < slides.length - 1) setI(i + 1);
    });
    return () => a.stop();
  }, [i, slides, visible]);

  const s = slides[i];
  const share = () => {
    const text = slides
      .filter((x) => !x.photo)
      .map((x) => [x.emoji, x.big, x.small, x.names && x.names.join(', '), x.lines && x.lines.join('\n')].filter(Boolean).join(' '))
      .join('\n');
    Share.share({ message: `🎬 ${party.title}: the recap\n\n${text}` });
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: s ? s.bg : '#000' }]}>
        {s && s.photo ? <Image source={{ uri: s.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}

        <View style={styles.bars}>
          {slides.map((_, k) => (
            <View key={k} style={styles.track}>
              <Animated.View
                style={[styles.fill, { width: k < i ? '100%' : k > i ? '0%' : bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
              />
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Tap left = back, right = next */}
        <View style={styles.taps} pointerEvents="box-none">
          <TouchableOpacity style={styles.tapHalf} onPress={() => setI(Math.max(0, i - 1))} />
          <TouchableOpacity style={styles.tapHalf} onPress={() => (i < slides.length - 1 ? setI(i + 1) : onClose())} />
        </View>

        {s ? (
          <Animated.View style={[styles.center, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
            {s.emoji ? <Text style={styles.emoji}>{s.emoji}</Text> : null}
            {s.big ? <Text style={styles.big}>{s.big}</Text> : null}
            {s.names ? <Text style={styles.names}>{s.names.join('  ·  ')}</Text> : null}
            {s.lines ? s.lines.map((l) => <Text key={l} style={styles.line}>{l}</Text>) : null}
            {s.small ? <Text style={[styles.small, s.photo && styles.photoCaption]}>{s.small}</Text> : null}
            {s.end ? (
              <TouchableOpacity style={styles.shareBtn} onPress={share}>
                <Text style={styles.shareText}>Share the recap 🚀</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : (
          <Text style={styles.small}>Loading the night…</Text>
        )}

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bars: { position: 'absolute', top: 54, left: 10, right: 10, flexDirection: 'row', zIndex: 5 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#fff' },
  close: { position: 'absolute', top: 66, right: 16, zIndex: 10, padding: 8 },
  closeText: { color: '#fff', fontSize: 20 },
  center: { alignItems: 'center', paddingHorizontal: 30, width: W },
  emoji: { fontSize: 84 },
  big: { color: '#fff', fontSize: 34, fontWeight: '800', textAlign: 'center', marginTop: 12, letterSpacing: -0.5 },
  small: { color: 'rgba(255,255,255,0.85)', fontSize: 17, textAlign: 'center', marginTop: 10, fontWeight: '500' },
  photoCaption: { position: 'absolute', top: H * 0.38, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },
  names: { color: '#fff', fontSize: 18, textAlign: 'center', marginTop: 16, lineHeight: 28, fontWeight: '600' },
  line: { color: '#fff', fontSize: 17, marginTop: 8, fontWeight: '500' },
  shareBtn: { marginTop: 28, backgroundColor: '#fff', borderRadius: 24, paddingVertical: 13, paddingHorizontal: 26, zIndex: 20 },
  shareText: { color: '#0E0E13', fontSize: 16, fontWeight: '700' },
  taps: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', top: 110, bottom: 140 },
  tapHalf: { flex: 1 },
});
